import { google, gmail_v1 } from 'googleapis';
import type { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createOAuthClient } from './oauth';

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

export interface GmailClientResult {
  gmail: gmail_v1.Gmail;
  email: string;
  scope: string;
}

/**
 * 저장된 OAuth 토큰으로 인증된 Gmail 클라이언트를 생성한다.
 * - 토큰 만료 시 googleapis가 자동 갱신하고, 갱신분을 DB에 반영('tokens' 이벤트).
 * - 사용자 본인의 토큰으로만 동작하므로 타인 메일함 접근은 원천적으로 불가.
 * 연결이 없으면 null 반환.
 */
export async function getGmailClientForUser(
  admin: AdminClient,
  userId: string,
): Promise<GmailClientResult | null> {
  const { data: conn } = await admin
    .from('user_google_connections')
    .select('access_token, refresh_token, token_expiry, email, scope')
    .eq('user_id', userId)
    .single();

  if (!conn) return null;

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
  return { gmail, email: conn.email ?? '', scope: conn.scope ?? '' };
}
