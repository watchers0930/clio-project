import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { mockSearchChunks, files, departments } from '@/lib/mock-data';

interface SearchResultItem {
  id: string;
  name: string;
  excerpt: string;
  relevance: number;
  fileType: string;
  department: string;
  date: string;
  aiSummary: string;
}

const FILE_TYPE_MAP: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'audio/m4a': 'M4A',
  'text/markdown': 'MD',
};

function getFileType(mimeType: string, fileName: string): string {
  if (FILE_TYPE_MAP[mimeType]) return FILE_TYPE_MAP[mimeType];
  const ext = fileName.split('.').pop()?.toUpperCase();
  return ext ?? 'FILE';
}

/* mock 전용 AI 요약 데이터 */
const AI_SUMMARIES: Record<string, string> = {
  'file-1': '2025년 사업계획서로, 매출 목표 500억원(전년 대비 25% 성장)을 설정하고, CLIO 도입을 통한 업무 효율화 30% 개선을 핵심 전략으로 제시합니다.',
  'file-2': '3월 월간 경영보고 문서로, 당월 경영 현황과 주요 성과 지표를 담고 있습니다.',
  'file-7': 'API 설계문서 v2로, RESTful 아키텍처 기반의 설계 원칙과 pgvector 벡터 검색 구조를 상세히 기술합니다.',
  'file-8': '코드리뷰 가이드라인으로, 타입 안전성, 에러 핸들링, 보안, 성능, 가독성 등 5가지 핵심 점검 항목을 다룹니다.',
  'file-13': '2025년 마케팅 전략 문서로, 콘텐츠 마케팅 강화와 B2B 시장 확대를 핵심 전략으로 합니다.',
  'file-15': '고객 설문조사 결과로, NPS 72점(전분기 대비 +8점)을 기록하였습니다.',
  'file-16': '2025년 취업규칙으로, 연차 휴가 산정 기준과 추가 휴가 규정을 담고 있습니다.',
  'file-17': '신입사원 온보딩 매뉴얼로, 4주간의 프로그램을 안내합니다.',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, department, fileType } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ results: [], total: 0 });
    }

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const queryLower = query.toLowerCase();
      const queryTokens = queryLower.split(/\s+/).filter(Boolean);

      // 부서 맵 조회
      const { data: depts } = await supabase.from('departments').select('id, name');
      const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
      const deptIdByName = new Map((depts ?? []).map((d) => [d.name, d.id]));

      // files 테이블에서 이름 기반 검색 (ilike)
      let fileQuery = supabase
        .from('files')
        .select('*')
        .or(queryTokens.map((t) => `name.ilike.%${t}%`).join(','));

      // 부서 필터
      if (department && department !== '전체') {
        const deptId = deptIdByName.get(department);
        if (deptId) fileQuery = fileQuery.eq('department_id', deptId);
      }

      const { data: matchedFiles, error } = await fileQuery.limit(20);
      if (error) throw error;

      // 관련도 점수 계산 (키워드 매칭 횟수 기반)
      let results: SearchResultItem[] = (matchedFiles ?? []).map((f) => {
        const fileName = f.original_name ?? f.name;
        const nameLower = fileName.toLowerCase();
        let score = 0;
        for (const token of queryTokens) {
          // 이름에서 매칭 횟수 카운트
          const matches = nameLower.split(token).length - 1;
          score += matches * 25;
        }
        const relevance = Math.min(99, Math.max(30, score + 50));

        const mimeType = f.mime_type ?? f.type ?? '';
        const ft = getFileType(mimeType, fileName);

        return {
          id: f.id,
          name: fileName,
          excerpt: `${fileName} 파일의 내용입니다.`,
          relevance,
          fileType: ft,
          department: deptMap.get(f.department_id) ?? '미분류',
          date: f.created_at.split('T')[0],
          aiSummary: `${fileName}에 대한 AI 요약입니다.`,
        };
      });

      // fileType 필터 (DB에 별도 컬럼 없으므로 클라이언트측 필터)
      if (fileType && fileType !== '전체') {
        results = results.filter((r) => r.fileType === fileType);
      }

      // 관련도 내림차순 정렬
      results.sort((a, b) => b.relevance - a.relevance);
      results = results.slice(0, 10);

      // audit_logs에 검색 기록 (실패 무시)
      try {
        await supabase.from('audit_logs').insert({
          user_id: 'user-1',
          action: 'search',
          target_type: 'search',
          target_id: '',
          details: { query },
        } as Record<string, unknown>);
      } catch { /* 무시 */ }

      return NextResponse.json({ results, total: results.length });
    }

    /* ── 폴백: mock 데이터 ── */
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter(Boolean);

    const fileScores = new Map<string, { score: number; bestChunk: string }>();

    for (const chunk of mockSearchChunks) {
      const file = files.find((f) => f.id === chunk.file_id);
      if (!file) continue;

      const contentLower = chunk.content.toLowerCase();
      const fileNameLower = file.name.toLowerCase();

      let score = 0;
      for (const token of queryTokens) {
        if (contentLower.includes(token)) score += 0.3;
        if (fileNameLower.includes(token)) score += 0.25;
      }
      if (score < 0.05) continue;

      const existing = fileScores.get(file.id);
      if (!existing || score > existing.score) {
        fileScores.set(file.id, { score, bestChunk: chunk.content });
      }
    }

    for (const file of files) {
      if (fileScores.has(file.id)) continue;
      const fileNameLower = file.name.toLowerCase();
      let nameScore = 0;
      for (const token of queryTokens) {
        if (fileNameLower.includes(token)) nameScore += 0.2;
      }
      if (nameScore > 0.05) {
        fileScores.set(file.id, {
          score: nameScore,
          bestChunk: `${file.name} 파일의 내용입니다.`,
        });
      }
    }

    let results: SearchResultItem[] = [];

    for (const [fileId, { score, bestChunk }] of fileScores) {
      const file = files.find((f) => f.id === fileId);
      if (!file) continue;

      const dept = departments.find((d) => d.id === file.department_id);
      const ft = getFileType(file.mime_type ?? '', file.original_name ?? file.name);

      if (department && department !== '전체' && dept?.name !== department) continue;
      if (fileType && fileType !== '전체' && ft !== fileType) continue;

      const relevance = Math.min(99, Math.round(score * 100 + Math.random() * 15 + 50));

      results.push({
        id: file.id,
        name: file.original_name ?? file.name,
        excerpt: bestChunk.length > 120 ? bestChunk.slice(0, 120) + '...' : bestChunk,
        relevance,
        fileType: ft,
        department: dept?.name ?? '미분류',
        date: file.created_at.split('T')[0],
        aiSummary: AI_SUMMARIES[file.id] ?? `${file.name} 파일에 대한 AI 요약입니다.`,
      });
    }

    results.sort((a, b) => b.relevance - a.relevance);
    results = results.slice(0, 10);

    return NextResponse.json({ results, total: results.length });
  } catch {
    return NextResponse.json({ results: [], total: 0, error: '검색 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
