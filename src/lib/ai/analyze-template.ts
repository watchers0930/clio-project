/**
 * CLIO: 템플릿 문서 구조 분석
 * DOCX/HWPX 파일에서 빈칸, 플레이스홀더, 밑줄 영역 자동 감지
 */

import PizZip from 'pizzip';

export interface DetectedPlaceholder {
  key: string;
  label: string;
  type: 'blank' | 'placeholder' | 'underline' | 'bracket';
  location: string;
  context?: string;
}

// 플레이스홀더 감지 패턴
const PLACEHOLDER_PATTERNS = [
  { regex: /\{\{([^}]+)\}\}/g, type: 'placeholder' as const },
  { regex: /\[\s*\]/g, type: 'bracket' as const },
  { regex: /\(\s*\)/g, type: 'bracket' as const },
  { regex: /_{3,}/g, type: 'underline' as const },
];

/**
 * XML 문자열에서 텍스트 노드 추출
 * <w:t> 또는 <hp:t> 내부 텍스트를 반환
 */
function extractTextNodes(xml: string, tagName: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'g');
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/**
 * XML 요소를 추출하는 유틸
 */
function extractElements(xml: string, tagName: string): string[] {
  const results: string[] = [];
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  let pos = 0;

  while (pos < xml.length) {
    const start = xml.indexOf(openTag, pos);
    if (start === -1) break;
    const end = xml.indexOf(closeTag, start);
    if (end === -1) break;
    results.push(xml.substring(start, end + closeTag.length));
    pos = end + closeTag.length;
  }
  return results;
}

/**
 * 텍스트에서 플레이스홀더 패턴 감지
 */
function detectPatterns(text: string, location: string, context?: string): DetectedPlaceholder[] {
  const results: DetectedPlaceholder[] = [];

  for (const pattern of PLACEHOLDER_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const label = pattern.type === 'placeholder'
        ? match[1].trim()
        : pattern.type === 'underline' ? '(밑줄 영역)' : '(빈 괄호)';

      results.push({
        key: `${pattern.type}_${location}_${match.index}`,
        label,
        type: pattern.type,
        location,
        context,
      });
    }
  }

  return results;
}

/**
 * 테이블 셀을 분석하여 빈칸 감지
 */
function analyzeTableCells(
  tableXml: string,
  tableIdx: number,
  rowTag: string,
  cellTag: string,
  textTag: string,
): DetectedPlaceholder[] {
  const results: DetectedPlaceholder[] = [];
  const rows = extractElements(tableXml, rowTag);

  // 첫 행에서 헤더 추출 (컨텍스트용)
  const firstRowCells = rows.length > 0 ? extractElements(rows[0], cellTag) : [];
  const headers = firstRowCells.map(cell => {
    const texts = extractTextNodes(cell, textTag);
    return texts.join('').trim();
  });

  rows.forEach((rowXml, rowIdx) => {
    const cells = extractElements(rowXml, cellTag);
    cells.forEach((cellXml, colIdx) => {
      const texts = extractTextNodes(cellXml, textTag);
      const cellText = texts.join('').trim();
      const location = `table:${tableIdx}:row:${rowIdx}:col:${colIdx}`;
      const header = headers[colIdx] || undefined;

      // 빈 셀 감지
      if (cellText.length === 0) {
        results.push({
          key: `blank_${location}`,
          label: header ? `${header} (빈칸)` : `행${rowIdx + 1} 열${colIdx + 1} (빈칸)`,
          type: 'blank',
          location,
          context: header,
        });
      } else {
        // 텍스트 패턴 감지
        results.push(...detectPatterns(cellText, location, header));
      }
    });
  });

  return results;
}

/**
 * DOCX 파일 분석
 */
function analyzeDocx(buffer: ArrayBuffer): DetectedPlaceholder[] {
  const zip = new PizZip(buffer);
  const docXml = zip.file('word/document.xml')?.asText();
  if (!docXml) return [];

  const results: DetectedPlaceholder[] = [];

  // 테이블 분석
  const tables = extractElements(docXml, 'w:tbl');
  tables.forEach((tblXml, tblIdx) => {
    results.push(...analyzeTableCells(tblXml, tblIdx, 'w:tr', 'w:tc', 'w:t'));
  });

  // 테이블 외 단락 분석
  // 테이블 영역을 제거한 나머지에서 단락 추출
  let docWithoutTables = docXml;
  for (const tbl of tables) {
    docWithoutTables = docWithoutTables.replace(tbl, '');
  }

  const paragraphs = extractElements(docWithoutTables, 'w:p');
  paragraphs.forEach((pXml, pIdx) => {
    const texts = extractTextNodes(pXml, 'w:t');
    const pText = texts.join('');
    if (pText.trim()) {
      results.push(...detectPatterns(pText, `paragraph:${pIdx}`));
    }
  });

  return results;
}

/**
 * HWPX 파일 분석
 */
function analyzeHwpx(buffer: ArrayBuffer): DetectedPlaceholder[] {
  const zip = new PizZip(buffer);
  const results: DetectedPlaceholder[] = [];

  // section XML 파일들 찾기
  const sectionFiles = Object.keys(zip.files).filter(
    name => name.startsWith('Contents/section') && name.endsWith('.xml')
  );

  for (const sectionFile of sectionFiles) {
    const sectionXml = zip.file(sectionFile)?.asText();
    if (!sectionXml) continue;

    // 테이블 분석
    const tables = extractElements(sectionXml, 'hp:tbl');
    tables.forEach((tblXml, tblIdx) => {
      results.push(...analyzeTableCells(tblXml, tblIdx, 'hp:tr', 'hp:tc', 'hp:t'));
    });

    // 테이블 외 단락 분석
    let sectionWithoutTables = sectionXml;
    for (const tbl of tables) {
      sectionWithoutTables = sectionWithoutTables.replace(tbl, '');
    }

    const paragraphs = extractElements(sectionWithoutTables, 'hp:p');
    paragraphs.forEach((pXml, pIdx) => {
      const texts = extractTextNodes(pXml, 'hp:t');
      const pText = texts.join('');
      if (pText.trim()) {
        results.push(...detectPatterns(pText, `paragraph:${pIdx}`));
      }
    });
  }

  return results;
}

/**
 * 문서 구조 분석 메인 함수
 */
export async function analyzeDocumentStructure(
  buffer: ArrayBuffer,
  mimeType: string,
  fileName: string,
): Promise<DetectedPlaceholder[]> {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'docx' || mimeType.includes('wordprocessingml')) {
    return analyzeDocx(buffer);
  }

  if (ext === 'hwpx' || mimeType.includes('hwpx') || mimeType.includes('haansoft')) {
    return analyzeHwpx(buffer);
  }

  return [];
}
