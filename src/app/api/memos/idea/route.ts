import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import OpenAI from 'openai';

interface MemoRow {
  id: string;
  title: string;
  content: string | null;
  created_by: string;
}

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY 미설정');
  return new OpenAI({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });
    }
    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    const body = await request.json() as { memoIds?: string[] };
    const memoIds = body.memoIds;
    if (!Array.isArray(memoIds) || memoIds.length < 2) {
      return NextResponse.json({ success: false, error: '2개 이상의 메모를 선택하세요' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: memosRaw, error } = await admin
      .from('memos')
      .select('id, title, content, created_by')
      .in('id', memoIds);

    if (error || !memosRaw) {
      return NextResponse.json({ success: false, error: '메모 조회 실패' }, { status: 500 });
    }

    const memos = (memosRaw as unknown as MemoRow[]).filter((m) => m.created_by === authUserId);
    if (memos.length < 2) {
      return NextResponse.json({ success: false, error: '권한 없는 메모 포함' }, { status: 403 });
    }

    const memoContext = memos
      .map((m, i) => `[메모 ${i + 1}] ${m.title}\n${m.content ?? '(내용 없음)'}`)
      .join('\n\n');

    const openai = getOpenAI();
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      messages: [
        {
          role: 'system',
          content: `당신은 창의적인 아이디어 기획자입니다.
여러 메모를 분석하여 연결고리를 찾고, 논리적이고 실행 가능한 아이디어를 제안합니다.
반드시 다음 마크다운 구조로 작성하세요:

## 💡 아이디어 제목
(한 줄 핵심 아이디어)

## 핵심 개념
(메모들을 연결하는 공통 인사이트 2-3문장)

## 실행 방안
- 구체적 실행 단계 3-5개

## 기대 효과
(이 아이디어로 얻을 수 있는 가치)`,
        },
        {
          role: 'user',
          content: `다음 메모들을 분석하여 논리적으로 연결된 아이디어를 제안해주세요:\n\n${memoContext}`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '생성 오류' })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[memos/idea/POST]', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
