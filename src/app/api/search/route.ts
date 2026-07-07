import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { summarizeText } from '@/lib/ai/summarize';
import { filterAccessibleDocumentRows, filterAccessibleFileRows, getUserRoleInfo } from '@/lib/permissions';

const SEARCH_AI_SUMMARY_ENABLED = process.env.ENABLE_SEARCH_AI_SUMMARY === 'true';

interface SearchResultItem {
  id: string;
  name: string;
  excerpt: string;
  relevance: number;
  fileType: string;
  department: string;
  date: string;
  aiSummary: string;
  sourceType: 'file' | 'document';
  relationLabel?: string | null;
  originDocumentId?: string | null;
  originDocumentTitle?: string | null;
}

interface SearchContext {
  role: string;
  departmentName: string;
  documentScopeLabel: string;
  departmentFilterLabel: string;
  availableDepartments: string[];
}

interface AuditLogRow {
  details: Record<string, unknown> | null;
  created_at: string;
}

interface FileRow { id: string; name: string; type: string | null; department_id: string | null; created_at: string; uploaded_by: string | null; source?: string | null }
interface DocRow {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  created_by: string | null;
  origin_document_id?: string | null;
  origin_context?: string | null;
  templates: { name: string } | null;
}
interface WorkLogRow { id: string; log_date: string; done: string | null; plan: string | null; note: string | null }
interface DeptRow { id: string; name: string }
interface UserRow { id: string; department_id: string | null }

function formatOriginLabel(originContext: string | null | undefined) {
  return ({
    meeting_minutes: '회의 기반 문서',
    meeting_followup: '회의 후속 문서',
    report_update: '업데이트 보고서',
    report_draft: '보고서 초안',
    shared_followup: '공유 문서 기반 후속',
    document_followup: '기준 문서 기반 후속',
  } as Record<string, string>)[originContext ?? ''] ?? null;
}

const FILE_TYPE_MAP: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'audio/m4a': 'M4A',
  'text/markdown': 'MD',
};

function getFileType(mimeType: string | null, fileName: string): string {
  if (mimeType && FILE_TYPE_MAP[mimeType]) return FILE_TYPE_MAP[mimeType];
  return fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
}

async function buildCreatorDepartmentMap(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  deptMap: Map<string, string>,
  creatorIds: Array<string | null | undefined>,
) {
  const ids = [...new Set(creatorIds.filter((id): id is string => !!id))];
  const creatorDeptMap = new Map<string, string>();

  if (ids.length === 0) return creatorDeptMap;

  const { data: userRows } = await admin.from('users').select('id, department_id').in('id', ids);
  for (const user of (userRows as UserRow[] ?? [])) {
    creatorDeptMap.set(user.id, deptMap.get(user.department_id ?? '') ?? '미분류');
  }

  return creatorDeptMap;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, department, fileType } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ results: [], total: 0 });
    }

    // macOS NFD → NFC 정규화 (한글 검색 호환)
    const normalizedQuery = query.normalize('NFC');
    const queryTokens = normalizedQuery.toLowerCase().split(/\s+/).filter(Boolean);

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
      admin = sb; // admin 초기화 실패 시 sb로 폴백
    }

    // 부서 맵
    const { data: depts } = await sb.from('departments').select('id, name');
    const deptMap = new Map<string, string>((depts ?? []).map((d: DeptRow) => [d.id, d.name] as [string, string]));
    const deptIdByName = new Map<string, string>((depts ?? []).map((d: DeptRow) => [d.name, d.id] as [string, string]));
    const searchContext: SearchContext = {
      role: roleInfo.role,
      departmentName: deptMap.get(roleInfo.department_id ?? '') ?? '미배정',
      documentScopeLabel: roleInfo.role === 'admin'
        ? '관리자 권한으로 접근 가능한 전체 문서 범위에서 검색합니다.'
        : roleInfo.department_id
          ? `본인 문서와 ${deptMap.get(roleInfo.department_id) ?? '소속 부서'}에 공유된 문서만 검색합니다.`
          : '본인 문서와 직접 공유된 문서만 검색합니다.',
      departmentFilterLabel: roleInfo.role === 'admin'
        ? '전체 부서를 기준으로 결과를 다시 좁힐 수 있습니다.'
        : '검색 후 접근 가능한 부서만 필터에 남습니다.',
      availableDepartments: ['전체'],
    };

    const fileResults: SearchResultItem[] = [];
    const docResultsMap = new Map<string, SearchResultItem>(); // id → item (중복 방지)

    // ── ① 문서·업무일지 텍스트 검색 + 청크 수 확인 병렬 실행 ──
    // title만 검색 (content 포함 시 다른 문서 내용에서 false-positive 발생)
    const orTitle = queryTokens.map((t: string) => `title.ilike.%${t}%`).join(',');
    const orWorkLog = queryTokens.map((t: string) => `done.ilike.%${t}%,plan.ilike.%${t}%,note.ilike.%${t}%,log_date.ilike.%${t}%`).join(',');

    // "업무일지" 타입 자체를 검색하는 경우: done/plan/note에 해당 단어가 없으므로 최근 일지로 폴백
    const isWorkLogTypeSearch = queryTokens.some((t: string) => t === '업무일지' || t === '업무' || t === '일지');

    const [{ data: textDocs }, { data: workLogs }, { count: chunkCount }, { count: docEmbedCount }] = await Promise.all([
      admin.from('documents')
        .select('id, title, content, created_at, created_by, origin_document_id, origin_context, templates:template_id(name)')
        .is('parent_id', null)
        .or(orTitle)
        .limit(15),
      isWorkLogTypeSearch
        // 타입 검색: 최근 업무일지 반환 (내용 필터 없이)
        ? admin.from('work_logs').select('id, log_date, done, plan, note').order('log_date', { ascending: false }).limit(10)
        // 내용 검색: done/plan/note 텍스트 매칭
        : admin.from('work_logs').select('id, log_date, done, plan, note').or(orWorkLog).limit(10),
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
    );
    const textOriginIds = [...new Set(typedTextDocs.map((doc) => doc.origin_document_id).filter((id): id is string => !!id))];
    const { data: textOriginDocs } = textOriginIds.length > 0
      ? await admin.from('documents').select('id, title').in('id', textOriginIds)
      : { data: [] };
    const textOriginTitleMap = new Map(((textOriginDocs ?? []) as Array<{ id: string; title: string }>).map((doc) => [doc.id, doc.title]));
    const textDocCreatorDeptMap = await buildCreatorDepartmentMap(
      admin,
      deptMap,
      typedTextDocs.map((doc) => doc.created_by),
    );
    for (const d of typedTextDocs) {
      const titleLower = d.title.toLowerCase();
      let score = 0;
      for (const token of queryTokens) score += (titleLower.split(token).length - 1) * 30;
      docResultsMap.set(d.id, {
        id: d.id,
        name: d.title,
        excerpt: (d.content ?? '').slice(0, 200),
        relevance: Math.min(85, Math.max(40, score + 50)),
        fileType: d.templates?.name ?? 'AI문서',
        department: textDocCreatorDeptMap.get(d.created_by ?? '') ?? '미분류',
        date: d.created_at.split('T')[0],
        aiSummary: '',
        sourceType: 'document',
        relationLabel: formatOriginLabel(d.origin_context ?? null),
        originDocumentId: d.origin_document_id ?? null,
        originDocumentTitle: d.origin_document_id ? (textOriginTitleMap.get(d.origin_document_id) ?? null) : null,
      });
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
            ? admin.rpc('match_document_embeddings', { query_embedding: embeddingStr, match_count: 15, match_threshold: 0.45 })
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
            .from('files').select('id, name, type, department_id, created_at, uploaded_by, source').in('id', Array.from(fileMap.keys()));
          const accessibleFiles = await filterAccessibleFileRows(
            supabase,
            authUserId,
            roleInfo.role,
            roleInfo.department_id,
            (files as FileRow[] ?? []),
          );
          for (const f of accessibleFiles) {
            const match = fileMap.get(f.id);
            fileResults.push({
              id: f.id,
              name: f.name,
              excerpt: match?.content?.slice(0, 200) ?? '',
              relevance: Math.round((match?.similarity ?? 0) * 100),
              fileType: getFileType(f.type, f.name),
              department: deptMap.get(f.department_id ?? '') ?? '미분류',
              date: f.created_at.split('T')[0],
              aiSummary: '',
              sourceType: 'file',
              dataSource: f.source === 'gmail' ? 'gmail' : 'upload',
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
            .select('id, title, content, created_at, created_by, origin_document_id, origin_context, templates:template_id(name)')
            .in('id', docIds)
            .is('parent_id', null);

          const typedVecDocs = await filterAccessibleDocumentRows(
            supabase,
            authUserId,
            roleInfo.role,
            roleInfo.department_id,
            (vecDocs as DocRow[] ?? []),
          );
          const vecOriginIds = [...new Set(typedVecDocs.map((doc) => doc.origin_document_id).filter((id): id is string => !!id))];
          const { data: vecOriginDocs } = vecOriginIds.length > 0
            ? await admin.from('documents').select('id, title').in('id', vecOriginIds)
            : { data: [] };
          const vecOriginTitleMap = new Map(((vecOriginDocs ?? []) as Array<{ id: string; title: string }>).map((doc) => [doc.id, doc.title]));
          const creatorDeptMap = await buildCreatorDepartmentMap(
            admin,
            deptMap,
            typedVecDocs.map((doc) => doc.created_by),
          );

          for (const d of typedVecDocs) {
            const similarity = docSimMap.get(d.id) ?? 0;
            const vecRelevance = Math.round(similarity * 100);
            const existing = docResultsMap.get(d.id);
            // 이미 텍스트 검색 결과가 있으면 relevance만 높은 걸로 갱신
            if (existing) {
              existing.relevance = Math.max(existing.relevance, vecRelevance);
              existing.department = creatorDeptMap.get(d.created_by ?? '') ?? existing.department;
              existing.relationLabel = existing.relationLabel ?? formatOriginLabel(d.origin_context ?? null);
              existing.originDocumentId = existing.originDocumentId ?? d.origin_document_id ?? null;
              existing.originDocumentTitle = existing.originDocumentTitle ?? (d.origin_document_id ? (vecOriginTitleMap.get(d.origin_document_id) ?? null) : null);
            } else {
              docResultsMap.set(d.id, {
                id: d.id,
                name: d.title,
                excerpt: (d.content ?? '').slice(0, 200),
                relevance: vecRelevance,
                fileType: d.templates?.name ?? 'AI문서',
                department: creatorDeptMap.get(d.created_by ?? '') ?? '미분류',
                date: d.created_at.split('T')[0],
                aiSummary: '',
                sourceType: 'document',
                relationLabel: formatOriginLabel(d.origin_context ?? null),
                originDocumentId: d.origin_document_id ?? null,
                originDocumentTitle: d.origin_document_id ? (vecOriginTitleMap.get(d.origin_document_id) ?? null) : null,
              });
            }
          }
        }
      } catch (err) {
        console.error('[search] vector search error:', err);
      }
    }

    // ── ④ 파일 텍스트 검색 폴백 (벡터 결과 없을 때) ──
    if (fileResults.length === 0) {
      let fileQuery = sb
        .from('files').select('id, name, type, department_id, created_at, uploaded_by')
        .or(queryTokens.map((t: string) => `name.ilike.%${t}%`).join(','));
      if (department && department !== '전체') {
        const deptId = deptIdByName.get(department);
        if (deptId) fileQuery = fileQuery.eq('department_id', deptId);
      }
      const { data: matchedFiles } = await fileQuery.limit(15);
      const accessibleMatchedFiles = await filterAccessibleFileRows(
        supabase,
        authUserId,
        roleInfo.role,
        roleInfo.department_id,
        (matchedFiles as FileRow[] ?? []),
      );
      for (const f of accessibleMatchedFiles) {
        const nameLower = f.name.toLowerCase();
        let score = 0;
        for (const token of queryTokens) score += (nameLower.split(token).length - 1) * 25;
        fileResults.push({
          id: f.id,
          name: f.name,
          excerpt: `${f.name} 파일입니다.`,
          relevance: Math.min(85, Math.max(30, score + 50)),
          fileType: getFileType(f.type, f.name),
          department: deptMap.get(f.department_id ?? '') ?? '미분류',
          date: f.created_at.split('T')[0],
          aiSummary: '',
          sourceType: 'file',
        });
      }
    }

    // ── ⑤ 결과 병합 + 필터 ──
    let results: SearchResultItem[] = [...fileResults, ...Array.from(docResultsMap.values())];

    if (department && department !== '전체') {
      results = results.filter((r) => r.department === department);
    }
    if (fileType && fileType !== '전체') {
      results = results.filter((r) => r.sourceType === 'document' || r.fileType === fileType);
    }

    results.sort((a, b) => b.relevance - a.relevance);
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
