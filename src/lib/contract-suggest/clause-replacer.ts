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
 * DOCX 단락(<w:p>) 수준에서 텍스트를 검색하여 교체
 * XML 태그가 텍스트를 여러 run으로 분산시켜 단순 includes가 실패할 때 사용
 */
function replaceByParagraph(
  xml: string,
  searchKey: string,
  escapedRevised: string,
): { xml: string; found: boolean } {
  const PARA_END = '</w:p>';
  let searchFrom = 0;

  while (searchFrom < xml.length) {
    const paraStart = xml.indexOf('<w:p', searchFrom);
    if (paraStart === -1) break;

    const paraEnd = xml.indexOf(PARA_END, paraStart);
    if (paraEnd === -1) break;

    const paraXml = xml.slice(paraStart, paraEnd + PARA_END.length);
    // XML 태그 제거 후 순수 텍스트 추출
    const plainText = paraXml.replace(/<[^>]+>/g, '');

    if (plainText.includes(searchKey)) {
      const newPara = `<w:p><w:r><w:t xml:space="preserve">${escapedRevised}</w:t></w:r></w:p>`;
      return {
        xml: xml.slice(0, paraStart) + newPara + xml.slice(paraEnd + PARA_END.length),
        found: true,
      };
    }

    searchFrom = paraEnd + PARA_END.length;
  }

  return { xml, found: false };
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

    // 1차: 직접 문자열 검색 (이스케이프 포함/미포함)
    if (xml.includes(escapedOriginal)) {
      xml = xml.replace(escapedOriginal, escapedRevised);
      continue;
    }
    if (xml.includes(original)) {
      xml = xml.replace(original, escapedRevised);
      continue;
    }

    // 2차: 단락 수준 검색 (XML 태그가 텍스트를 분산시킨 경우 대응)
    const searchKey = original.trim().slice(0, Math.min(30, original.length));
    const result = replaceByParagraph(xml, searchKey, escapedRevised);
    if (result.found) {
      xml = result.xml;
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
