import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { createOAuthClient } from '@/lib/google/oauth';
import { chunkText } from '@/lib/ai/chunk-text';
import { generateAndStoreChunks } from '@/lib/ai/embeddings';
import { google } from 'googleapis';

export const maxDuration = 60;

// 이메일 본문 + 첨부파일 텍스트를 합쳐서 가져옴
async function extractMessageText(gmail: ReturnType<typeof google.gmail>, messageId: string): Promise<{ text: string; subject: string; from: string; date: string; attachmentNames: string[] }> {
  const { data: msg } = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = msg.payload?.headers ?? [];
  const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? '(제목 없음)';
  const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? '';
  const date = headers.find((h) => h.name?.toLowerCase() === 'date')?.value ?? '';

  const attachmentNames: string[] = [];
  const textParts: string[] = [];

  function extractParts(parts: NonNullable<typeof msg.payload>['parts']) {
    if (!parts) return;
    for (const part of parts) {
      const mime = part.mimeType ?? '';
      const filename = part.filename ?? '';

      if (filename) attachmentNames.push(filename);

      if (mime === 'text/plain' && part.body?.data) {
        const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
        textParts.push(decoded);
      }

      if (part.parts) extractParts(part.parts);
    }
  }

  // 단일 파트인 경우
  if (msg.payload?.body?.data && msg.payload.mimeType === 'text/plain') {
    textParts.push(Buffer.from(msg.payload.body.data, 'base64').toString('utf-8'));
  }

  extractParts(msg.payload?.parts ?? []);

  const text = [`제목: ${subject}`, `보낸 사람: ${from}`, `날짜: ${date}`, '', ...textParts].join('\n');

  return { text, subject, from, date, attachmentNames };
}

// POST /api/gmail/sync — 최근 이메일 가져와서 임베딩
export async function POST(request: NextRequest) {
  try {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminSupabaseClient();

  // 토큰 조회
  const { data: conn } = await admin
    .from('user_google_connections')
    .select('email, access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .single();

  if (!conn) return NextResponse.json({ error: 'Gmail이 연결되어 있지 않습니다.' }, { status: 400 });

  // OAuth 클라이언트 세팅
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: conn.access_token,
    refresh_token: conn.refresh_token,
    expiry_date: conn.token_expiry ? new Date(conn.token_expiry).getTime() : undefined,
  });

  // 토큰 갱신 시 DB 업데이트
  oauth2Client.on('tokens', async (tokens) => {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (tokens.access_token) update.access_token = tokens.access_token;
    if (tokens.expiry_date) update.token_expiry = new Date(tokens.expiry_date).toISOString();
    await admin.from('user_google_connections').update(update).eq('user_id', userId);
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // 받은편지함 기준, 자동 발송(구글알리미·프로모션·업데이트·소셜) 제외
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 50,
    q: 'in:inbox -category:promotions -category:updates -category:social -from:googlealerts-noreply@google.com -from:noreply@google.com -from:no-reply@accounts.google.com',
  });
  const listData = listRes.data;

  const messages = listData.messages ?? [];
  if (messages.length === 0) {
    await admin.from('user_google_connections').update({ last_synced_at: new Date().toISOString() }).eq('user_id', userId);
    return NextResponse.json({ success: true, synced: 0 });
  }

  // 이미 동기화된 external_id 목록
  const { data: existing } = await admin
    .from('files')
    .select('external_id')
    .eq('uploaded_by', userId)
    .eq('source', 'gmail');

  const existingIds = new Set((existing ?? []).map((r) => r.external_id));

  let synced = 0;
  let errors = 0;
  const startedAt = Date.now();
  const BUDGET_MS = 45_000; // Vercel 60초 제한 대비 45초 내 종료

  for (const msg of messages) {
    if (Date.now() - startedAt > BUDGET_MS) break;
    if (!msg.id || existingIds.has(msg.id)) continue;

    try {
      const { text, subject, from, date, attachmentNames } = await extractMessageText(gmail, msg.id);

      if (!text.trim()) continue;

      // files 테이블에 가상 파일 등록
      const { data: fileRow, error: fileErr } = await admin.from('files').insert({
        name: subject.slice(0, 200),
        type: 'message/email',
        size: text.length,
        uploaded_by: userId,
        status: 'indexed',
        storage_path: null,
        scope: 'company',
        source: 'gmail',
        external_id: msg.id,
        department_id: null,
      }).select('id').single();

      if (fileErr || !fileRow) {
        errors++;
        continue;
      }

      // 청킹 + 임베딩
      const fullText = attachmentNames.length > 0
        ? `${text}\n\n첨부파일: ${attachmentNames.join(', ')}`
        : text;

      const chunks = chunkText(fullText);
      await generateAndStoreChunks(admin, fileRow.id, chunks);

      synced++;
    } catch (err) {
      console.error(`[gmail/sync] message ${msg.id}:`, err);
      errors++;
    }
  }

  await admin.from('user_google_connections').update({ last_synced_at: new Date().toISOString() }).eq('user_id', userId);

  return NextResponse.json({ success: true, synced, errors, total: messages.length });
  } catch (err) {
    console.error('[gmail/sync] 치명적 오류:', err);
    const msg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
