import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, SearchResult } from '@/lib/supabase/types';
import { mockSearchChunks, files, departments } from '@/lib/mock-data';

export async function POST(request: NextRequest) {
  try {
    const { query, department_id, limit: reqLimit } = await request.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '검색어를 입력해주세요.' },
        { status: 400 },
      );
    }

    const maxResults = Math.min(20, Math.max(1, reqLimit ?? 10));
    const queryLower = query.toLowerCase();

    // Mock RAG search — simple keyword matching with fake relevance scores
    const scored = mockSearchChunks
      .map((chunk) => {
        const file = files.find((f) => f.id === chunk.file_id);
        if (!file) return null;

        // Filter by department if specified
        if (department_id && file.department_id !== department_id) return null;

        const contentLower = chunk.content.toLowerCase();
        const fileNameLower = file.name.toLowerCase();

        // Calculate a mock relevance score
        let score = 0;
        const queryTokens = queryLower.split(/\s+/);
        for (const token of queryTokens) {
          if (contentLower.includes(token)) score += 0.3;
          if (fileNameLower.includes(token)) score += 0.2;
        }
        // Add a random factor for realistic-looking results
        score += Math.random() * 0.1;
        score = Math.min(1, score);

        if (score < 0.05) return null;

        const dept = departments.find((d) => d.id === file.department_id);

        return {
          file_id: file.id,
          file_name: file.name,
          chunk_content: chunk.content,
          chunk_index: chunk.chunk_index,
          relevance_score: Math.round(score * 1000) / 1000,
          department: dept?.name ?? '',
        } satisfies SearchResult;
      })
      .filter(Boolean) as SearchResult[];

    scored.sort((a, b) => b.relevance_score - a.relevance_score);
    const results = scored.slice(0, maxResults);

    return NextResponse.json<ApiResponse<{ results: SearchResult[]; query: string; total: number }>>({
      success: true,
      data: { results, query, total: results.length },
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '검색 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
