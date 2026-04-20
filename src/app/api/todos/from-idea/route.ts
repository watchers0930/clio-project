import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  _openai = new OpenAI({ apiKey });
  return _openai;
}

interface ExtractedTodo {
  title: string;
  priority: 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const body = await request.json() as { ideaText?: string; groupName?: string };
    const { ideaText, groupName } = body;

    if (!ideaText || typeof ideaText !== 'string' || ideaText.trim().length === 0) {
      return NextResponse.json({ success: false, error: '아이디어 내용 필요' }, { status: 400 });
    }

    const openai = getOpenAI();

    const prompt = `다음 아이디어를 실행하기 위한 구체적인 할일 목록을 3~7개 추출하세요.
각 할일은 바로 실행 가능한 단위 행동이어야 합니다.
우선순위는 high(긴급·핵심), medium(일반), low(나중에) 중 하나입니다.

아이디어:
${ideaText}

다음 JSON 배열 형식으로만 응답하세요:
[
  { "title": "할일 제목", "priority": "high" | "medium" | "low" },
  ...
]`;

    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
    });

    const raw = res.choices[0]?.message?.content ?? '{"items":[]}';
    let todos: ExtractedTodo[] = [];

    try {
      const parsed = JSON.parse(raw) as { items?: ExtractedTodo[] } | ExtractedTodo[];
      todos = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
    } catch {
      return NextResponse.json({ success: false, error: 'AI 응답 파싱 실패' }, { status: 500 });
    }

    if (todos.length === 0) {
      return NextResponse.json({ success: false, error: '할일을 추출하지 못했습니다' }, { status: 422 });
    }

    const admin = createAdminSupabaseClient();
    const rows = todos.map((t) => ({
      title: String(t.title ?? '').slice(0, 200),
      priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
      status: 'active',
      user_id: authUserId,
      description: groupName ? `[${groupName}] 아이디어에서 생성` : '아이디어에서 생성',
    }));

    const { data, error } = await admin.from('todos').insert(rows).select('id, title, priority');
    if (error) {
      console.error('[todos/from-idea] insert error:', error.message);
      return NextResponse.json({ success: false, error: '할일 저장 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data, count: (data ?? []).length });
  } catch (err) {
    console.error('[todos/from-idea] error:', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
