import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { createOAuthClient } from '@/lib/google/oauth';
import { google } from 'googleapis';

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

// GET /api/gmail/attachments?messageId=xxx
export async function GET(request: NextRequest) {
  const messageId = request.nextUrl.searchParams.get('messageId');
  if (!messageId) return NextResponse.json({ error: 'messageId가 필요합니다.' }, { status: 400 });

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

  const { data: msg } = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const attachments: GmailAttachment[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function collectAttachments(parts: any[] | null | undefined) {
    if (!parts) return;
    for (const part of parts) {
      const filename = part.filename ?? '';
      const attachmentId = part.body?.attachmentId ?? '';
      if (filename && attachmentId) {
        attachments.push({
          id: attachmentId,
          filename,
          mimeType: part.mimeType ?? 'application/octet-stream',
          size: part.body?.size ?? 0,
        });
      }
      if (part.parts) collectAttachments(part.parts);
    }
  }

  collectAttachments(msg.payload?.parts ?? []);

  return NextResponse.json({ attachments });
}
