import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createOAuthClient } from '@/lib/google/oauth';
import { chunkText } from '@/lib/ai/chunk-text';
import { generateAndStoreChunks } from '@/lib/ai/embeddings';
import { extractText } from '@/lib/ai/extract-text';
import { parseMessagePayload, type AttachmentMeta } from '@/lib/google/gmail-message';
import { google, gmail_v1 } from 'googleapis';

// 받은편지함 기준, 최근 6개월, 자동 발송(구글알리미·프로모션·업데이트·소셜) 제외
const GMAIL_QUERY = 'in:inbox newer_than:6m -category:promotions -category:updates -category:social -from:googlealerts-noreply@google.com -from:noreply@google.com -from:no-reply@accounts.google.com';
const MAX_SYNC_COUNT = 100; // 한 번에 최근 100개까지만 동기화
const DEFAULT_BUDGET_MS = 50_000; // Vercel 60초 제한 대비 여유
export const AUTO_COOLDOWN_MS = 10 * 60 * 1000; // 자동 동기화 쿨다운 10분
// 첨부파일 본문 파싱 대상 (텍스트 추출 가능한 형식)
const ATTACHMENT_EXTS = ['pdf', 'docx', 'dotx', 'xlsx', 'pptx', 'txt', 'csv', 'tsv', 'md', 'hwp', 'hwpx'];
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 첨부 10MB 초과는 건너뜀
const MAX_ATTACHMENTS_PER_MAIL = 5;

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

/** 동기화 처리 중 발생하는, 호출측에서 코드로 분기해야 하는 오류 */
export class GmailSyncError extends Error {
  code: 'NOT_CONNECTED';
  constructor(code: 'NOT_CONNECTED', message: string) {
    super(message);
    this.name = 'GmailSyncError';
    this.code = code;
  }
}

export interface GmailSyncOptions {
  /** true면 쿨다운(10분) 내 재호출 시 즉시 스킵 */
  auto?: boolean;
  /** true면 기존 Gmail 파일·청크를 모두 삭제 후 처음부터 재인덱싱 */
  reindex?: boolean;
  /** 이 시간(ms)을 초과하면 남은 메일은 다음 회차로 넘기고 중단 (증분이라 안전) */
  budgetMs?: number;
}

export interface GmailSyncOutcome {
  synced: number;
  errors: number;
  skipped: boolean;
}

// 첨부파일 다운로드 + 텍스트 추출 (지원 형식만)
async function extractAttachmentsText(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string,
  attachments: AttachmentMeta[],
): Promise<{ names: string[]; texts: string[] }> {
  const names: string[] = [];
  const texts: string[] = [];
  let processed = 0;

  for (const att of attachments) {
    names.push(att.filename);
    if (processed >= MAX_ATTACHMENTS_PER_MAIL) continue;
    const ext = att.filename.split('.').pop()?.toLowerCase() ?? '';
    if (!ATTACHMENT_EXTS.includes(ext)) continue;
    if (att.size > MAX_ATTACHMENT_BYTES) continue;

    try {
      const { data } = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: att.attachmentId,
      });
      if (!data.data) continue;
      const buf = Buffer.from(data.data, 'base64url');
      const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      const extracted = await extractText(arrayBuffer, att.mimeType, att.filename);
      if (extracted.trim()) {
        texts.push(`[첨부파일: ${att.filename}]\n${extracted}`);
        processed++;
      }
    } catch (err) {
      console.warn(`[gmail/sync] 첨부 파싱 실패 (${att.filename}):`, err instanceof Error ? err.message : err);
    }
  }

  return { names, texts };
}

/**
 * 특정 사용자의 Gmail 받은편지함(최근 6개월)을 증분 동기화한다.
 * 세션에 의존하지 않고 userId만으로 동작하므로, 검색화면(수동/자동)과 cron이 공유한다.
 * @throws {GmailSyncError} Gmail 미연결 시
 * @throws {Error} invalid_grant·권한부족 등 Google API 오류 (호출측에서 메시지 변환/스킵)
 */
export async function syncGmailForUser(
  admin: AdminClient,
  userId: string,
  opts: GmailSyncOptions = {},
): Promise<GmailSyncOutcome> {
  const { auto = false, reindex = false, budgetMs = DEFAULT_BUDGET_MS } = opts;

  // 토큰 조회
  const { data: conn } = await admin
    .from('user_google_connections')
    .select('email, access_token, refresh_token, token_expiry, last_synced_at')
    .eq('user_id', userId)
    .single();

  if (!conn) throw new GmailSyncError('NOT_CONNECTED', 'Gmail이 연결되어 있지 않습니다.');

  // 자동 동기화 쿨다운: 최근 10분 내 동기화됐으면 스킵
  if (auto && conn.last_synced_at) {
    const elapsed = Date.now() - new Date(conn.last_synced_at).getTime();
    if (elapsed < AUTO_COOLDOWN_MS) {
      return { synced: 0, errors: 0, skipped: true };
    }
  }

  // OAuth 클라이언트 세팅
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

  // 재인덱싱: 기존 Gmail 파일과 청크를 모두 삭제하고 처음부터 다시 인덱싱
  if (reindex) {
    const { data: oldFiles } = await admin
      .from('files')
      .select('id')
      .eq('uploaded_by', userId)
      .eq('source', 'gmail');
    const oldIds = (oldFiles ?? []).map((f: { id: string }) => f.id);
    if (oldIds.length > 0) {
      await admin.from('file_chunks').delete().in('file_id', oldIds);
      await admin.from('files').delete().in('id', oldIds);
    }
  }

  // 이미 동기화된 external_id 목록 (증분) — 재인덱싱 시에는 위에서 삭제되어 비어 있음
  const { data: existing } = await admin
    .from('files')
    .select('external_id')
    .eq('uploaded_by', userId)
    .eq('source', 'gmail');
  const existingIds = new Set((existing ?? []).map((r) => r.external_id));

  let synced = 0;
  let errors = 0;
  const startedAt = Date.now();

  // 최근 100개만 대상 (최신순). 증분: 이미 동기화된 메일은 스킵.
  const listData: gmail_v1.Schema$ListMessagesResponse = (await gmail.users.messages.list({
    userId: 'me',
    maxResults: MAX_SYNC_COUNT,
    q: GMAIL_QUERY,
  })).data;
  const messages = listData.messages ?? [];

  for (const msg of messages) {
    if (Date.now() - startedAt > budgetMs) break;
    if (!msg.id || existingIds.has(msg.id)) continue;

    try {
      const { data: full } = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
      const { subject, from, date, textParts, attachments } = parseMessagePayload(full);
      // internalDate(서버 수신 기준 epoch ms)를 실제 발송일로 사용. Date 헤더보다 신뢰 가능.
      const sourceDate = full.internalDate ? new Date(Number(full.internalDate)).toISOString() : null;
      const { names, texts } = await extractAttachmentsText(gmail, msg.id, attachments);

      const header = [`제목: ${subject}`, `보낸 사람: ${from}`, `날짜: ${date}`].join('\n');
      const bodyText = textParts.join('\n');
      const attachmentNote = names.length > 0 ? `\n\n첨부파일: ${names.join(', ')}` : '';
      const attachmentBody = texts.length > 0 ? `\n\n${texts.join('\n\n')}` : '';
      const fullText = `${header}\n\n${bodyText}${attachmentNote}${attachmentBody}`.trim();

      if (!fullText) continue;

      const { data: fileRow, error: fileErr } = await admin.from('files').insert({
        name: subject.slice(0, 200),
        type: 'message/email',
        size: fullText.length,
        uploaded_by: userId,
        status: 'indexed',
        storage_path: null,
        scope: 'company',
        source: 'gmail',
        external_id: msg.id,
        source_date: sourceDate,
        department_id: null,
      }).select('id').single();

      if (fileErr || !fileRow) { errors++; continue; }

      const chunks = chunkText(fullText);
      await generateAndStoreChunks(admin, fileRow.id, chunks);
      existingIds.add(msg.id);
      synced++;
    } catch (err) {
      console.error(`[gmail/sync] message ${msg.id}:`, err);
      errors++;
    }
  }

  await admin.from('user_google_connections').update({ last_synced_at: new Date().toISOString() }).eq('user_id', userId);

  return { synced, errors, skipped: false };
}
