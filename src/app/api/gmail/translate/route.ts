import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { translateText, TRANSLATE_LANGS, MAX_TRANSLATE_LENGTH } from '@/lib/ai/translate';

export const maxDuration = 60;

// POST /api/gmail/translate  body: { text: string, targetLang: string }
// 이메일 본문 번역. 긴 본문 대응(청크 분할). 서버 인증 + 입력 검증.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });

    const userId = await getAuthUserId(supabase);
    if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { text?: unknown; targetLang?: unknown };
    const text = typeof body.text === 'string' ? body.text : '';
    const targetLang = typeof body.targetLang === 'string' ? body.targetLang : 'ko';

    if (!text.trim()) return NextResponse.json({ error: '번역할 내용이 없습니다.' }, { status: 400 });
    if (text.length > MAX_TRANSLATE_LENGTH * 2) {
      return NextResponse.json({ error: '번역할 내용이 너무 깁니다.' }, { status: 400 });
    }
    if (!TRANSLATE_LANGS[targetLang]) {
      return NextResponse.json({ error: '지원하지 않는 언어입니다.' }, { status: 400 });
    }

    const translated = await translateText(text, targetLang);
    return NextResponse.json(
      { success: true, translated },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '번역에 실패했습니다.';
    console.error('[gmail/translate] error:', message);
    const status = message.includes('설정') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
