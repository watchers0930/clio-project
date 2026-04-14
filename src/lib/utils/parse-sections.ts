/**
 * 마크다운 content에서 ## / ### 헤더 기준으로 섹션 제목 목록 추출
 */
export function parseSections(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => line.startsWith('## ') || line.startsWith('### '))
    .map((line) => line.replace(/^#{2,3}\s+/, '').trim())
    .filter(Boolean);
}

/**
 * 특정 섹션의 내용(헤더 제외)을 추출
 */
export function extractSectionContent(content: string, sectionTitle: string): string {
  const lines = content.split('\n');
  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    const isHeader = line.startsWith('## ') || line.startsWith('### ');
    const headerText = line.replace(/^#{2,3}\s+/, '').trim();

    if (isHeader && headerText === sectionTitle) {
      inSection = true;
      continue;
    }
    if (inSection && isHeader) break;
    if (inSection) sectionLines.push(line);
  }

  return sectionLines.join('\n').trim();
}

/**
 * 특정 섹션 내용을 newContent로 교체한 전체 content 반환
 */
export function replaceSectionContent(
  content: string,
  sectionTitle: string,
  newContent: string
): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inSection = false;
  let headerLine = '';

  for (const line of lines) {
    const isHeader = line.startsWith('## ') || line.startsWith('### ');
    const headerText = line.replace(/^#{2,3}\s+/, '').trim();

    if (isHeader && headerText === sectionTitle) {
      inSection = true;
      headerLine = line;
      result.push(line);
      result.push(newContent);
      continue;
    }
    if (inSection && isHeader) {
      inSection = false;
    }
    if (!inSection || !headerLine) {
      result.push(line);
    }
  }

  return result.join('\n');
}
