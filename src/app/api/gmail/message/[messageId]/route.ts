import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { createOAuthClient } from '@/lib/google/oauth';
import { parseMessagePayload, getReadableBody } from '@/lib/google/gmail-message';
import { google } from 'googleapis';

export const maxDuration = 30;

// GET /api/gmail/message/[messageId] — 이메일 본문(평문) + 헤더 + 첨부 메타 조회
// 사용자의 OAuth 토큰으로만 조회 → 본인 메일함으로 범위 제한. 추가로 files 소유권 검증.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;
  if (!messageId) return NextResponse.json({ error: 'messageId가 필요합니다.' }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminSupabaseClient();

  // 소유권 검증: 이 사용자가 동기화한 Gmail 메일만 조회 허용
  const { data: ownedFile } = await admin
    .from('files')
    .select('id')
    .eq('uploaded_by', userId)
    .eq('source', 'gmail')
    .eq('external_id', messageId)
    .maybeSingle();

  if (!ownedFile) {
    return NextResponse.json({ error: '해당 이메일을 조회할 권한이 없습니다.' }, { status: 403 });
  }

  const { data: conn } = await admin
    .from('user_google_connections')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .single();

  if (!conn) return NextResponse.json({ error: 'Gmail이 연결되어 있지 않습니다.' }, { status: 400 });

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: conn.access_token,
    refresh_token: conn.refresh_token,
    expiry_date: conn.token_expiry ? new Date(conn.token_expiry).getTime() : undefined,
  });
  oauth2Client.on('tokens', async (tokens) => {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (tokens.access_token) update.access_token = tokens.access_token;
    if (tokens.expiry_date) update.token_expiry = new Date(tokens.expiry_date).toISOString();
    await admin.from('user_google_connections').update(update).eq('user_id', userId);
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const { data: full } = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    const parsed = parseMessagePayload(full);
    const body = getReadableBody(parsed);

    return NextResponse.json({
      subject: parsed.subject,
      from: parsed.from,
      date: parsed.date,
      body,
      attachments: parsed.attachments.map((a) => ({ id: a.attachmentId, filename: a.filename, size: a.size })),
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('invalid_grant')) {
      return NextResponse.json({ error: 'Gmail 연결이 만료되었습니다. 설정에서 다시 연결해 주세요.', code: 'invalid_grant' }, { status: 401 });
    }
    if (raw.includes('Not Found') || raw.includes('not found')) {
      return NextResponse.json({ error: '이메일을 찾을 수 없습니다. 메일함에서 삭제되었을 수 있습니다.' }, { status: 404 });
    }
    console.error('[gmail/message] error:', raw);
    return NextResponse.json({ error: '이메일을 불러오지 못했습니다.' }, { status: 500 });
  }
}
