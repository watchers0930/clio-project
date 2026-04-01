import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { summarizeText } from '@/lib/ai/summarize';

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

function getFileType(mimeType: string | null, fileName: string): string {
  if (mimeType && FILE_TYPE_MAP[mimeType]) return FILE_TYPE_MAP[mimeType];
  return fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
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

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ results: [], total: 0, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    // 부서 맵
    const { data: depts } = await supabase.from('departments').select('id, name');
    const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
    const deptIdByName = new Map((depts ?? []).map((d) => [d.name, d.id]));

    // file_chunks가 있는지 확인
    const { count: chunkCount } = await supabase
      .from('file_chunks')
      .select('id', { count: 'exact', head: true });

    let results: SearchResultItem[] = [];

    if ((chunkCount ?? 0) > 0) {
      // ── 벡터 검색 ──
      try {
        const queryEmbedding = await generateEmbedding(normalizedQuery);

        const { data: matches, error: rpcErr } = await supabase.rpc('match_file_chunks', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_count: 20,
          match_threshold: 0.3,
        });

        if (rpcErr) throw rpcErr;

        // file_id 기준 그루핑 (최고 유사도 청크)
        const fileMap = new Map<string, { similarity: number; content: string }>();
        for (const m of (matches ?? [])) {
          const existing = fileMap.get(m.file_id);
          if (!existing || m.similarity > existing.similarity) {
            fileMap.set(m.file_id, { similarity: m.similarity, content: m.content });
          }
        }

        if (fileMap.size > 0) {
          // files 테이블 JOIN
          const fileIds = Array.from(fileMap.keys());
          const { data: files } = await supabase
            .from('files')
            .select('id, name, type, department_id, created_at')
            .in('id', fileIds);

          results = (files ?? []).map((f) => {
            const match = fileMap.get(f.id);
            return {
              id: f.id,
              name: f.name,
              excerpt: match?.content?.slice(0, 200) ?? '',
              relevance: Math.round((match?.similarity ?? 0) * 100),
              fileType: getFileType(f.type, f.name),
              department: deptMap.get(f.department_id ?? '') ?? '미분류',
              date: f.created_at.split('T')[0],
              aiSummary: '', // 아래에서 채움
            };
          });
        }
      } catch (err) {
        console.error('[search] vector search error, falling back to text search:', err);
        // 벡터 검색 실패 시 아래 텍스트 검색으로 폴백
      }
    }

    // ── 텍스트 검색 폴백 (벡터 결과가 없을 때) ──
    if (results.length === 0) {
      const queryTokens = normalizedQuery.toLowerCase().split(/\s+/).filter(Boolean);

      let fileQuery = supabase
        .from('files')
        .select('*')
        .or(queryTokens.map((t) => `name.ilike.%${t}%`).join(','));

      if (department && department !== '전체') {
        const deptId = deptIdByName.get(department);
        if (deptId) fileQuery = fileQuery.eq('department_id', deptId);
      }

      const { data: matchedFiles } = await fileQuery.limit(20);

      results = (matchedFiles ?? []).map((f) => {
        const nameLower = f.name.toLowerCase();
        let score = 0;
        for (const token of queryTokens) {
          score += (nameLower.split(token).length - 1) * 25;
        }
        return {
          id: f.id,
          name: f.name,
          excerpt: `${f.name} 파일입니다.`,
          relevance: Math.min(99, Math.max(30, score + 50)),
          fileType: getFileType(f.type, f.name),
          department: deptMap.get(f.department_id ?? '') ?? '미분류',
          date: f.created_at.split('T')[0],
          aiSummary: '',
        };
      });
    }

    // 필터 적용
    if (department && department !== '전체') {
      results = results.filter((r) => r.department === department);
    }
    if (fileType && fileType !== '전체') {
      results = results.filter((r) => r.fileType === fileType);
    }

    // 관련도순 정렬 + 상위 10개
    results.sort((a, b) => b.relevance - a.relevance);
    results = results.slice(0, 10);

    // 상위 3개에 AI 요약 생성
    for (let i = 0; i < Math.min(3, results.length); i++) {
      if (results[i].excerpt && results[i].excerpt.length > 20) {
        try {
          results[i].aiSummary = await summarizeText(results[i].excerpt);
        } catch {
          results[i].aiSummary = `${results[i].name} 파일에 대한 요약입니다.`;
        }
      }
    }

    // audit_logs
    const authUserId = await getAuthUserId(supabase);
    if (authUserId) {
      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'search',
        target_type: 'search',
        details: { query: normalizedQuery, resultCount: results.length },
      }).then(() => {}, () => {});
    }

    return NextResponse.json({ results, total: results.length });
  } catch (err) {
    console.error('[search] error:', err);
    return NextResponse.json({ results: [], total: 0, error: '검색 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
