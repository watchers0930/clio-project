import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateEmbedding } from '@/lib/ai/embeddings';
import OpenAI from 'openai';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * POST /api/chat
 * body: { message: string, history: ChatMessage[], fileIds?: string[] }
 * 벡터 검색 → 컨텍스트 구성 → GPT-4o 답변 생성
 */
export async function POST(request: NextRequest) {
  try {
    const { message, history = [], fileIds } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: '메시지를 입력해 주세요.' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OpenAI API 키가 설정되지 않았습니다.' }, { status: 503 });

    // 1. 내 파일 목록 조회 (메타데이터 질문 대응)
    const { data: userFiles } = await supabase
      .from('files')
      .select('id, name, created_at, size')
      .eq('uploaded_by', authUserId)
      .order('created_at', { ascending: false })
      .limit(50);

    const myFileIds = new Set((userFiles ?? []).map((f: { id: string }) => f.id));

    // 2. 벡터 검색 (내 파일 청크만)
    const embedding = await generateEmbedding(message);
    const { data: chunks } = await supabase.rpc('match_file_chunks', {
      query_embedding: embedding,
      match_count: 12,
      match_threshold: 0.25,
    });

    // 3. 내 파일에 속한 청크만 필터 + fileIds 필터 (선택)
    let relevantChunks = ((chunks ?? []) as Array<{ file_id: string; content: string }>).filter(
      (c) => myFileIds.has(c.file_id),
    );
    if (Array.isArray(fileIds) && fileIds.length > 0) {
      relevantChunks = relevantChunks.filter((c) => fileIds.includes(c.file_id));
    }

    // 4. 컨텍스트 구성 (파일명 포함)
    let context = '';
    let sourceFileIds: string[] = [];

    if (relevantChunks.length > 0) {
      const uniqueFileIds = [...new Set(relevantChunks.map((c) => c.file_id))];
      sourceFileIds = uniqueFileIds;

      const fileNameMap = new Map(
        (userFiles ?? []).map((f: { id: string; name: string }) => [f.id, f.name]),
      );

      context = relevantChunks
        .map((c) => `[${fileNameMap.get(c.file_id) ?? '문서'}]\n${c.content}`)
        .join('\n\n---\n\n');
    }

    // 5. 파일 목록 컨텍스트 (최근 20개 — 메타데이터 질문 대응)
    const fileListContext =
      (userFiles ?? []).length > 0
        ? (userFiles ?? [])
            .slice(0, 20)
            .map((f: { name: string; created_at: string }, i: number) => {
              const date = new Date(f.created_at).toLocaleDateString('ko-KR');
              return `${i + 1}. ${f.name} (등록일: ${date})`;
            })
            .join('\n')
        : '등록된 파일이 없습니다.';

    // 6. 시스템 프롬프트 구성
    const systemPrompt = context
      ? `당신은 CLIO 문서관리 시스템의 AI 어시스턴트입니다. 아래 참고 문서와 파일 목록을 바탕으로 사용자의 질문에 한국어로 정확하게 답변하세요. 문서에 없는 내용은 솔직하게 모른다고 말하세요.\n\n[등록된 파일 목록]\n${fileListContext}\n\n[참고 문서 내용]\n${context}`
      : `당신은 CLIO 문서관리 시스템의 AI 어시스턴트입니다. 관련 문서 내용을 찾지 못했지만 아래 파일 목록 정보를 바탕으로 답변할 수 있습니다.\n\n[등록된 파일 목록]\n${fileListContext}`;

    // 7. GPT-4o-mini 호출
    const openai = new OpenAI({ apiKey });
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.slice(-8).map((m: ChatMessage) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 800,
      temperature: 0.3,
    });

    const answer = completion.choices[0]?.message?.content ?? '답변을 생성할 수 없습니다.';

    return NextResponse.json({ answer, sourceFileIds });
  } catch (err) {
    console.error('[chat]', err);
    return NextResponse.json({ error: '답변 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
