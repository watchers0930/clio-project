import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { createOAuthClient } from '@/lib/google/oauth';
import { google } from 'googleapis';

// GET /api/gmail/attachment/[messageId]?attachmentId=xxx&filename=xxx
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;
  const attachmentId = request.nextUrl.searchParams.get('attachmentId');
  const filename = request.nextUrl.searchParams.get('filename') ?? 'attachment';

  if (!attachmentId) return NextResponse.json({ error: 'attachmentId가 필요합니다.' }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminSupabaseClient();
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

  const { data: attachment } = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  if (!attachment.data) {
    return NextResponse.json({ error: '첨부파일 데이터를 가져올 수 없습니다.' }, { status: 404 });
  }

  // base64url → Buffer
  const base64 = attachment.data.replace(/-/g, '+').replace(/_/g, '/');
  const buffer = Buffer.from(base64, 'base64');

  const safeFilename = encodeURIComponent(filename);

  return new NextResponse(buffer, {
    headers: {
      'Content-Disposition': `attachment; filename*=UTF-8''${safeFilename}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(buffer.length),
    },
  });
}
