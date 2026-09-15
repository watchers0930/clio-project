import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { getGmailClientForUser } from '@/lib/google/gmail-client';
import { searchGmailMessages, PREVIEW_LIMIT } from '@/lib/google/gmail-delete';

export const maxDuration = 60;

// 오검색으로 인한 대량 매칭·오삭제를 막기 위한 검색어 하한. 1글자 검색은 사실상 전체 매칭 위험.
const MIN_KEYWORD_LEN = 2;
const MAX_KEYWORD_LEN = 200;

// POST /api/gmail/search-messages — 키워드로 Gmail 메일함 전체를 실시간 검색해 미리보기 목록 반환
// body { keyword: string } — Gmail 검색 문법(from:, subject: 등) 사용 가능
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

    const userId = await getAuthUserId(supabase);
    if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    let keyword = '';
    try {
      const body = await request.json();
      keyword = typeof body?.keyword === 'string' ? body.keyword.trim() : '';
    } catch { /* body 없음 */ }

    if (keyword.length < MIN_KEYWORD_LEN) {
      return NextResponse.json({ error: `검색어는 ${MIN_KEYWORD_LEN}자 이상 입력해 주세요.` }, { status: 400 });
    }
    if (keyword.length > MAX_KEYWORD_LEN) {
      return NextResponse.json({ error: '검색어가 너무 깁니다.' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const client = await getGmailClientForUser(admin, userId);
    if (!client) return NextResponse.json({ error: 'Gmail이 연결되어 있지 않습니다.' }, { status: 400 });

    // 삭제 목적의 검색이므로 삭제 권한(gmail.modify)이 없으면 미리 재연결을 유도한다.
    if (!client.scope.includes('gmail.modify')) {
      return NextResponse.json(
        { error: '메일 삭제 권한이 없습니다. 설정에서 Gmail을 다시 연결해 주세요.', code: 'need_reconnect' },
        { status: 403 },
      );
    }

    const result = await searchGmailMessages(client.gmail, keyword, PREVIEW_LIMIT);
    return NextResponse.json({
      success: true,
      keyword,
      hits: result.hits,
      totalEstimate: result.totalEstimate,
      truncated: result.truncated,
      previewLimit: PREVIEW_LIMIT,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('invalid_grant')) {
      return NextResponse.json({ error: 'Gmail 연결이 만료되었습니다. 설정에서 다시 연결해 주세요.', code: 'invalid_grant' }, { status: 401 });
    }
    if (raw.includes('insufficient') || raw.includes('Insufficient') || raw.includes('ACCESS_TOKEN_SCOPE')) {
      return NextResponse.json({ error: '메일 삭제 권한이 없습니다. 설정에서 Gmail을 다시 연결해 주세요.', code: 'need_reconnect' }, { status: 403 });
    }
    console.error('[gmail/search-messages]', raw);
    return NextResponse.json({ error: '메일 검색에 실패했습니다.' }, { status: 500 });
  }
}
