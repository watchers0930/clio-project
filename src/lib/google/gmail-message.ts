import { gmail_v1 } from 'googleapis';

export interface AttachmentMeta {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ParsedMessage {
  subject: string;
  from: string;
  date: string;
  textParts: string[];
  htmlParts: string[];
  attachments: AttachmentMeta[];
}

/**
 * Gmail 메시지 payload에서 헤더(제목/보낸사람/날짜) + 본문(text·html) + 첨부 메타를 추출.
 * sync(인덱싱)와 message 조회 API가 공유한다.
 * - textParts: 인덱싱용(기존 동작 유지)
 * - htmlParts: text/plain이 없는 HTML-only 메일 본문 조회용 폴백
 */
export function parseMessagePayload(msg: gmail_v1.Schema$Message): ParsedMessage {
  const headers = msg.payload?.headers ?? [];
  const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? '(제목 없음)';
  const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? '';
  const date = headers.find((h) => h.name?.toLowerCase() === 'date')?.value ?? '';

  const attachments: AttachmentMeta[] = [];
  const textParts: string[] = [];
  const htmlParts: string[] = [];

  function decode(data: string) {
    return Buffer.from(data, 'base64').toString('utf-8');
  }

  function walk(parts: gmail_v1.Schema$MessagePart[] | undefined) {
    if (!parts) return;
    for (const part of parts) {
      const mime = part.mimeType ?? '';
      const filename = part.filename ?? '';

      if (filename && part.body?.attachmentId) {
        attachments.push({ attachmentId: part.body.attachmentId, filename, mimeType: mime, size: part.body.size ?? 0 });
      }
      if (mime === 'text/plain' && part.body?.data) {
        textParts.push(decode(part.body.data));
      }
      if (mime === 'text/html' && part.body?.data) {
        htmlParts.push(decode(part.body.data));
      }
      if (part.parts) walk(part.parts);
    }
  }

  if (msg.payload?.body?.data) {
    if (msg.payload.mimeType === 'text/plain') textParts.push(decode(msg.payload.body.data));
    else if (msg.payload.mimeType === 'text/html') htmlParts.push(decode(msg.payload.body.data));
  }
  walk(msg.payload?.parts ?? []);

  return { subject, from, date, textParts, htmlParts, attachments };
}

/**
 * HTML 본문을 읽기 좋은 평문으로 변환.
 * 외부 의존성 없이 스크립트/스타일 제거 → 블록 태그를 줄바꿈으로 → 태그 제거 → 엔티티 디코드.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|div|tr|table|ul|ol|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 본문 조회용 평문 본문. text/plain 우선, 없으면 HTML을 평문으로 변환.
 */
export function getReadableBody(parsed: Pick<ParsedMessage, 'textParts' | 'htmlParts'>): string {
  const text = parsed.textParts.join('\n').trim();
  if (text) return text;
  const html = parsed.htmlParts.join('\n').trim();
  return html ? htmlToPlainText(html) : '';
}
