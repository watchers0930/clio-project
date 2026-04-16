/**
 * 계약서 파일 내 조항 교체 + 파일 재생성
 * DOCX: PizZip으로 word/document.xml 직접 조작
 * HWPX: adm-zip으로 Contents/content.hml 직접 조작
 */

import type { ApplyTarget } from '@/lib/types/contract-suggest';

export interface ReplacementResult {
  buffer: Buffer;
  notFound: string[];  // 원문을 파일에서 찾지 못한 item_key 목록
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * DOCX word/document.xml에서 원문 발췌를 찾아 수정 제안문으로 교체
 */
export async function replaceClausesInDocx(
  originalBuffer: Buffer,
  targets: ApplyTarget[],
  excerpts: Record<string, string>,
): Promise<ReplacementResult> {
  const PizZip = (await import('pizzip')).default;

  const zip = new PizZip(originalBuffer);
  let xml = zip.files['word/document.xml'].asText();
  const notFound: string[] = [];

  for (const target of targets) {
    const original = excerpts[target.item_key];
    if (!original) continue;

    const escapedOriginal = escapeXml(original);
    const escapedRevised = escapeXml(target.revised);

    if (xml.includes(escapedOriginal)) {
      xml = xml.replace(escapedOriginal, escapedRevised);
    } else if (xml.includes(original)) {
      // XML 이스케이프 없이 그대로 있는 경우 (일부 docx 파일)
      xml = xml.replace(original, escapedRevised);
    } else {
      notFound.push(target.item_key);
    }
  }

  zip.file('word/document.xml', xml);
  return {
    buffer: zip.generate({ type: 'nodebuffer' }) as Buffer,
    notFound,
  };
}

/**
 * HWPX Contents/content.hml에서 원문 발췌를 찾아 수정 제안문으로 교체
 */
export async function replaceClausesInHwpx(
  originalBuffer: Buffer,
  targets: ApplyTarget[],
  excerpts: Record<string, string>,
): Promise<ReplacementResult> {
  const AdmZip = (await import('adm-zip')).default;

  const zip = new AdmZip(originalBuffer);
  const entry = zip.getEntry('Contents/content.hml');
  if (!entry) {
    throw new Error('HWPX 파일에서 content.hml을 찾을 수 없습니다.');
  }

  let xml = zip.readAsText('Contents/content.hml');
  const notFound: string[] = [];

  for (const target of targets) {
    const original = excerpts[target.item_key];
    if (!original) continue;

    if (xml.includes(original)) {
      xml = xml.replace(original, target.revised);
    } else {
      notFound.push(target.item_key);
    }
  }

  zip.updateFile('Contents/content.hml', Buffer.from(xml, 'utf-8'));
  return {
    buffer: zip.toBuffer(),
    notFound,
  };
}
