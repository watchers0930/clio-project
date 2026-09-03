import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

/** 지원 대상 언어 (자막 번역 타깃) */
const LANG_NAMES: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文(简体)',
  es: 'Español',
  vi: 'Tiếng Việt',
};

/**
 * 화상회의 라이브 자막 번역 API
 * POST /api/meetings/translate  body: { text: string, targetLang: string }
 * 반환: { success, data: { translated } }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ success: false, error: '번역 미설정' }, { status: 503 });

    // 입력 검증
    const body = (await request.json().catch(() => ({}))) as { text?: unknown; targetLang?: unknown };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const targetLang = typeof body.targetLang === 'string' ? body.targetLang : 'ko';
    if (!text) return NextResponse.json({ success: false, error: '텍스트 없음' }, { status: 400 });
    if (text.length > 1000) return NextResponse.json({ success: false, error: '텍스트가 너무 깁니다' }, { status: 400 });
    const targetName = LANG_NAMES[targetLang];
    if (!targetName) return NextResponse.json({ success: false, error: '지원하지 않는 언어' }, { status: 400 });

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            `You are a real-time subtitle translator. Translate the user's text into ${targetName}. ` +
            `Output ONLY the translation with no quotes, no explanation. ` +
            `If the text is already in ${targetName}, return it unchanged.`,
        },
        { role: 'user', content: text },
      ],
    });

    const translated = completion.choices[0]?.message?.content?.trim() ?? '';
    return NextResponse.json(
      { success: true, data: { translated } },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    console.error('[meetings/translate/POST]', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ success: false, error: '번역 실패' }, { status: 500 });
  }
}
