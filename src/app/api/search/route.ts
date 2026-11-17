import { withMutation } from '@/lib/http/mutation-guard';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { summarizeText } from '@/lib/ai/summarize';
import { filterAccessibleDocumentRows, filterAccessibleFileRows, getUserRoleInfo } from '@/lib/permissions';
import { keywordFileSearch, getFileType, titleCoverageScore, type SearchResultItem } from '@/lib/search/keyword-file-search';
import { originContextLabel as formatOriginLabel } from '@/lib/documents/origin-context';
import { buildDocumentTextFilter, bodyHasAllTokens, buildIlikeAny, cleanSearchTokens, MAX_QUERY_LENGTH } from '@/lib/search/search-text-filter';
import { loadAccessibleOriginTitles } from '@/lib/search/search-origin-titles';
import { loadGrantedDocumentIds, searchDocumentsByText, vectorAccessArgs } from '@/lib/search/document-search';
import { buildCreatorDepartmentMap, toDocumentSearchItem, type DocRow } from '@/lib/search/document-results';
import { buildSearchContext } from '@/lib/search/search-context';

// 문서 텍스트 검색 후보 수 — 권한 필터 뒤 15건을 채우기 위해 넉넉히(권한 없는 문서가 자리를 다 차지하지 않게)
const DOC_SEARCH_COLUMNS = 'id, title, content, created_at, created_by, parent_id, version_number, origin_document_id, origin_context, templates:template_id(name)';

const SEARCH_AI_SUMMARY_ENABLED = process.env.ENABLE_SEARCH_AI_SUMMARY === 'true';

interface AuditLogRow {
  details: Record<string, unknown> | null;
  created_at: string;
}

interface FileRow { id: string; name: string; type: string | null; department_id: string | null; created_at: string; uploaded_by: string | null; source?: string | null; external_id?: string | null; source_date?: string | null }
interface WorkLogRow { id: string; log_date: string; done: string | null; plan: string | null; note: string | null }
interface DeptRow { id: string; name: string }



export async function POST(request: NextRequest) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const body = await request.json();
    const { query, department, fileType } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ results: [], total: 0 });
    }

    // macOS NFD → NFC 정규화 (한글 검색 호환), 길이 상한(임베딩·점수 계산 부담)
    const normalizedQuery = query.normalize('NFC').slice(0, MAX_QUERY_LENGTH);
    // 단어: '*' 제거·길이·개수 상한·중복 제거(lib/search/search-text-filter) — 모든 검색 조건이 이 단어로 만들어진다
    const queryTokens = cleanSearchTokens(normalizedQuery);
    if (queryTokens.length === 0) return NextResponse.json({ results: [], total: 0 });

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ results: [], total: 0, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ results: [], total: 0, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json({ results: [], total: 0, error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    // admin: documents/document_embeddings RLS 완전 우회 (검색은 전사 공용)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let admin: any;
    try {
      admin = createAdminSupabaseClient();
    } catch {
      // 사용자 세션으로 대신하면 서버 전용 표(document_embeddings 등)가 0건으로 보여 검색이 조용히 망가진다 — 설정 오류로 알린다
      return NextResponse.json({ results: [], total: 0, error: '검색 서버 설정이 필요합니다.' }, { status: 503 });
    }

    // 부서 맵
    const { data: depts } = await sb.from('departments').select('id, name');
    const deptMap = new Map<string, string>((depts ?? []).map((d: DeptRow) => [d.id, d.name] as [string, string]));
    const deptIdByName = new Map<string, string>((depts ?? []).map((d: DeptRow) => [d.name, d.id] as [string, string]));
    const searchContext = buildSearchContext(roleInfo, deptMap);

    const searchUser = { id: authUserId, role: roleInfo.role, departmentId: roleInfo.department_id ?? null };
    const grantedIds = await loadGrantedDocumentIds(admin, searchUser);
    const chainResultIds = new Map<string, string>(); // 버전 묶음(원본 id) → 결과 항목 id — 벡터(원본)와 텍스트(새 판) 중복 방지
    const fileResults: SearchResultItem[] = [];
    const docResultsMap = new Map<string, SearchResultItem>(); // id → item (중복 방지)

    // ── ① 문서·업무일지 텍스트 검색 + 청크 수 확인 병렬 실행 ──
    // 제목은 단어 하나라도, 본문은 모든 단어가 있어야 — 검색어는 조건 문법·와일드카드가 되지 않게 감싼다(lib/search/search-text-filter)
    const docTextFilter = buildDocumentTextFilter(queryTokens);
    // log_date 는 DATE 칸이라 ilike 가 오류(42883)를 내 업무일지 내용 검색 전체가 조용히 0건이었다(2026-11-17 운영 확인) — 글자 칸만
    const orWorkLog = buildIlikeAny(['done', 'plan', 'note'], queryTokens);

    // "업무일지" 타입 자체를 검색하는 경우: done/plan/note에 해당 단어가 없으므로 최근 일지로 폴백
    const isWorkLogTypeSearch = queryTokens.some((t: string) => t === '업무일지' || t === '업무' || t === '일지');

    const [{ data: textDocs }, { data: workLogs }, { count: chunkCount }, { count: docEmbedCount }] = await Promise.all([
      // 권한 조건을 조회 자체에 넣는다(볼 수 있는 문서가 후보 밖으로 밀리지 않게) — 새 버전까지 찾고 묶음마다 최신 판만
      docTextFilter
        ? searchDocumentsByText<DocRow>({ admin, user: searchUser, grantedIds, textFilter: docTextFilter, columns: DOC_SEARCH_COLUMNS })
          .then((data) => ({ data }))
        : Promise.resolve({ data: [] as Array<DocRow & { chainId: string }> }),
      // 업무일지는 사용자 세션으로 — RLS(본인 + 같은 부서 관리자)가 볼 수 있는 범위를 정한다(서버 권한으로 읽어 남의 일지가 보이던 문제)
      isWorkLogTypeSearch
        // 타입 검색: 최근 업무일지 반환 (내용 필터 없이)
        ? sb.from('work_logs').select('id, log_date, done, plan, note').order('log_date', { ascending: false }).limit(10)
        // 내용 검색: done/plan/note 텍스트 매칭
        : orWorkLog ? sb.from('work_logs').select('id, log_date, done, plan, note').or(orWorkLog).limit(10) : Promise.resolve({ data: [] }),
      sb.from('file_chunks').select('id', { count: 'exact', head: true }),
      admin.from('document_embeddings').select('id', { count: 'exact', head: true }),
    ]);

    // AI 생성 문서 텍스트 검색 결과 처리
    const typedTextDocs = await filterAccessibleDocumentRows(
      supabase,
      authUserId,
      roleInfo.role,
      roleInfo.department_id,
      (textDocs as DocRow[] ?? []),
    ); // 조회에서 이미 권한을 걸렀다 — 같은 규칙으로 한 번 더(방어)
    // 원본 문서 제목은 사용자가 볼 수 있는 원본만
    const textOriginTitleMap = await loadAccessibleOriginTitles(admin, supabase, searchUser, typedTextDocs.map((doc) => doc.origin_document_id ?? ''));
    const textDocCreatorDeptMap = await buildCreatorDepartmentMap(
      admin,
      deptMap,
      typedTextDocs.map((doc) => doc.created_by),
    );
    for (const d of typedTextDocs) {
      const titleLower = d.title.toLowerCase();
      let score = 0;
      for (const token of queryTokens) score += (titleLower.split(token).length - 1) * 30;
      if (bodyHasAllTokens(d.content, queryTokens)) score += 10; // 본문에 모든 단어 — 제목 일치(30점/단어)보다는 낮게
      chainResultIds.set(d.chainId ?? d.id, d.id);
      docResultsMap.set(d.id, toDocumentSearchItem(d, Math.min(85, Math.max(40, score + 50)), textDocCreatorDeptMap, textOriginTitleMap));
    }

    // 업무일지(work_logs) 검색 결과 처리
    const typedWorkLogs = workLogs as WorkLogRow[] ?? [];
    for (const w of typedWorkLogs) {
      const combined = [w.done, w.plan, w.note].filter(Boolean).join(' ');
      let score = 0;
      for (const token of queryTokens) {
        score += (w.log_date.includes(token) ? 40 : 0);
        score += (combined.toLowerCase().split(token).length - 1) * 15;
      }
      docResultsMap.set(`wl-${w.id}`, {
        id: `wl-${w.id}`,
        name: `업무일지 (${w.log_date})`,
        excerpt: (w.done ?? w.plan ?? '').slice(0, 200),
        relevance: Math.min(85, Math.max(40, score + 45)),
        fileType: '업무일지',
        department: '미분류',
        date: w.log_date,
        aiSummary: '',
        sourceType: 'document',
      });
    }

    // ── ③ 벡터 검색 (문서/파일 병렬) ──
    const hasVectorData = (chunkCount ?? 0) > 0 || (docEmbedCount ?? 0) > 0;
    if (hasVectorData) {
      try {
        const queryEmbedding = await generateEmbedding(normalizedQuery);
        const embeddingStr = JSON.stringify(queryEmbedding);

        const [fileMatchResult, docMatchResult] = await Promise.all([
          (chunkCount ?? 0) > 0
            ? sb.rpc('match_file_chunks', { query_embedding: embeddingStr, match_count: 30, match_threshold: 0.35 })
            : Promise.resolve({ data: [], error: null }),
          (docEmbedCount ?? 0) > 0 && !isWorkLogTypeSearch
            ? admin.rpc('match_document_embeddings', { query_embedding: embeddingStr, match_count: 15, match_threshold: 0.45, ...vectorAccessArgs(searchUser, grantedIds) })
            : Promise.resolve({ data: [], error: null }),
        ]);

        // 파일 벡터 결과 처리
        const fileChunkMatches: Array<{ file_id: string; similarity: number; content: string }> = fileMatchResult.data ?? [];
        const fileMap = new Map<string, { similarity: number; content: string }>();
        for (const m of fileChunkMatches) {
          const existing = fileMap.get(m.file_id);
          if (!existing || m.similarity > existing.similarity) {
            fileMap.set(m.file_id, { similarity: m.similarity, content: m.content });
          }
        }
        if (fileMap.size > 0) {
          const { data: files } = await sb
            .from('files').select('id, name, type, department_id, created_at, uploaded_by, source, external_id, source_date').in('id', Array.from(fileMap.keys()));
          const accessibleFiles = (await filterAccessibleFileRows(
            supabase,
            authUserId,
            roleInfo.role,
            roleInfo.department_id,
            (files as FileRow[] ?? []),
          ))
            // Gmail 메일은 본인이 동기화한 것만 노출(본문 열람이 소유자만 가능 → 발췌만 보이고 못 여는 모순 방지)
            .filter((f) => f.source !== 'gmail' || f.uploaded_by === authUserId);
          for (const f of accessibleFiles) {
            const match = fileMap.get(f.id);
            // 벡터 유사도와 제목 커버리지 점수 중 높은 쪽 사용.
            // (제목에 검색어가 다 들어있는데 벡터 유사도만 낮아 상위10에서 잘리는 문제 방지)
            const vecScore = Math.round((match?.similarity ?? 0) * 100);
            const nameScore = titleCoverageScore(f.name, queryTokens);
            fileResults.push({
              id: f.id,
              name: f.name,
              excerpt: match?.content?.slice(0, 200) ?? '',
              relevance: Math.max(vecScore, nameScore),
              fileType: getFileType(f.type, f.name),
              department: deptMap.get(f.department_id ?? '') ?? '미분류',
              // Gmail 등 외부 소스는 실제 원본 날짜(source_date) 우선, 없으면 동기화 시각으로 폴백
              date: (f.source_date ?? f.created_at).split('T')[0],
              aiSummary: '',
              sourceType: 'file',
              dataSource: f.source === 'gmail' ? 'gmail' : 'upload',
              externalId: f.external_id ?? null,
            });
          }
        }

        // 문서 벡터 결과 처리 (텍스트 결과 보강 — relevance 갱신)
        const docVecMatches: Array<{ document_id: string; similarity: number }> = docMatchResult.data ?? [];
        if (docVecMatches.length > 0) {
          const docIds = docVecMatches.map((m) => m.document_id);
          const docSimMap = new Map(docVecMatches.map((m) => [m.document_id, m.similarity]));

          const { data: vecDocs } = await admin
            .from('documents')
            .select(DOC_SEARCH_COLUMNS)
            .in('id', docIds)
            .is('parent_id', null);

          const typedVecDocs = await filterAccessibleDocumentRows(
            supabase,
            authUserId,
            roleInfo.role,
            roleInfo.department_id,
            (vecDocs as DocRow[] ?? []),
          );
          const vecOriginTitleMap = await loadAccessibleOriginTitles(admin, supabase, searchUser, typedVecDocs.map((doc) => doc.origin_document_id ?? ''));
          const creatorDeptMap = await buildCreatorDepartmentMap(
            admin,
            deptMap,
            typedVecDocs.map((doc) => doc.created_by),
          );

          for (const d of typedVecDocs) {
            const similarity = docSimMap.get(d.id) ?? 0;
            const vecRelevance = Math.round(similarity * 100);
            const existing = docResultsMap.get(chainResultIds.get(d.id) ?? d.id);
            // 이미 텍스트 검색 결과가 있으면 relevance만 높은 걸로 갱신
            if (existing) {
              existing.relevance = Math.max(existing.relevance, vecRelevance);
              existing.department = creatorDeptMap.get(d.created_by ?? '') ?? existing.department;
              existing.relationLabel = existing.relationLabel ?? formatOriginLabel(d.origin_context ?? null);
              existing.originDocumentId = existing.originDocumentId ?? d.origin_document_id ?? null;
              existing.originDocumentTitle = existing.originDocumentTitle ?? (d.origin_document_id ? (vecOriginTitleMap.get(d.origin_document_id) ?? null) : null);
            } else {
              docResultsMap.set(d.id, toDocumentSearchItem(d, vecRelevance, creatorDeptMap, vecOriginTitleMap));
            }
          }
        }
      } catch (err) {
        console.error('[search] vector search error:', err);
      }
    }

    // ── ④ 키워드(부분일치) 검색 — 파일명 + 본문(청크). 항상 실행 후 벡터 결과와 병합 ──
    // 짧은 단일 키워드(브랜드명·발신자명 등)는 벡터 유사도가 낮아 놓치므로 부분일치로 보강한다.
    const keywordResults = await keywordFileSearch({
      sb,
      supabase,
      queryTokens,
      department,
      deptIdByName,
      deptMap,
      authUserId,
      role: roleInfo.role,
      userDepartmentId: roleInfo.department_id,
      excludeIds: new Set(fileResults.map((r) => r.id)),
    });
    fileResults.push(...keywordResults);

    // ── ⑤ 결과 병합 + 필터 ──
    let results: SearchResultItem[] = [...fileResults, ...Array.from(docResultsMap.values())];

    if (department && department !== '전체') {
      results = results.filter((r) => r.department === department);
    }
    if (fileType && fileType !== '전체') {
      results = results.filter((r) => r.sourceType === 'document' || r.fileType === fileType);
    }

    // 같은 제목 접기: 제목이 같은 파일(반복 알림 메일 등)을 한 묶음으로 접되, 개별 건은 버리지 않는다.
    // 대표 = 가장 최신 발송일(동일 날짜면 관련도 높은 것). 나머지는 groupItems에 최신순 보존 → 프론트에서 펼쳐 개별 열람.
    const groups = new Map<string, { rep: SearchResultItem; members: SearchResultItem[] }>();
    const nonCollapsible: SearchResultItem[] = [];
    for (const r of results) {
      if (r.sourceType !== 'file') { nonCollapsible.push(r); continue; }
      const key = r.name.trim().toLowerCase();
      const g = groups.get(key);
      if (!g) { groups.set(key, { rep: r, members: [r] }); continue; }
      g.members.push(r);
      const isNewer = r.date > g.rep.date || (r.date === g.rep.date && r.relevance > g.rep.relevance);
      if (isNewer) g.rep = r;
    }
    results = [
      ...nonCollapsible,
      ...[...groups.values()].map(({ rep, members }) => {
        if (members.length === 1) return rep;
        const others = members
          .filter((m) => m.id !== rep.id)
          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        return {
          ...rep,
          relevance: Math.max(...members.map((m) => m.relevance)),
          duplicateCount: members.length,
          groupItems: others,
        };
      }),
    ];

    // 관련도(5점 단위로 묶음) 내림차순, 같은 묶음이면 최신 발송일 우선.
    const relBucket = (rel: number) => Math.round(rel / 5);
    results.sort((a, b) => (relBucket(b.relevance) - relBucket(a.relevance)) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    results = results.filter((r) => r.relevance >= 30);
    results = results.slice(0, 10);

    // 검색 1회당 결과 수만큼 OpenAI를 추가 호출하지 않도록 기본 비활성화.
    if (SEARCH_AI_SUMMARY_ENABLED) {
      await Promise.all(
        results.map(async (r) => {
          if (r.excerpt && r.excerpt.length > 20) {
            try {
              r.aiSummary = await summarizeText(r.excerpt);
            } catch {
              r.aiSummary = `${r.name}에 대한 요약입니다.`;
            }
          }
        })
      );
    } else {
      for (const result of results) {
        if (!result.excerpt || result.excerpt.length <= 20) continue;
        const compactExcerpt = result.excerpt.replace(/\s+/g, ' ').trim();
        result.aiSummary = compactExcerpt.length > 160
          ? `${compactExcerpt.slice(0, 157)}...`
          : compactExcerpt;
      }
    }

    let recentQueries: string[] = [];

    const { data: recentSearchLogs } = await sb
      .from('audit_logs')
      .select('details, created_at')
      .eq('user_id', authUserId)
      .eq('action', 'search')
      .order('created_at', { ascending: false })
      .limit(10);

    recentQueries = Array.from(
      new Set(
        ((recentSearchLogs as AuditLogRow[] | null) ?? [])
          .map((log) => String(log.details?.query ?? '').trim())
          .filter((item) => item && item !== normalizedQuery),
      ),
    ).slice(0, 5);

    const availableDepartments = Array.from(
      new Set(
        results
          .map((result) => result.department)
          .filter((deptName) => deptName && deptName !== '미분류'),
      ),
    ).sort((a, b) => a.localeCompare(b, 'ko'));
    if (roleInfo.department_id) {
      const baseDepartment = deptMap.get(roleInfo.department_id);
      if (baseDepartment && !availableDepartments.includes(baseDepartment)) {
        availableDepartments.unshift(baseDepartment);
      }
    }
    searchContext.availableDepartments = ['전체', ...availableDepartments];

    // audit_logs
    await sb.from('audit_logs').insert({
      user_id: authUserId,
      action: 'search',
      target_type: 'search',
      details: { query: normalizedQuery, resultCount: results.length },
    }).then(() => {}, () => {});

    return NextResponse.json({ results, total: results.length, recentQueries, searchContext });
  } catch (err) {
    console.error('[search] error:', err);
    return NextResponse.json({ results: [], total: 0, error: '검색 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
