/**
 * HWPX 렌더러 — 마크다운 → HWPX (ZIP 패키지) 변환
 * adm-zip으로 section0.xml 직접 수정
 */

import type { RenderOutput, CorporateTheme } from './types';
import { DEFAULT_THEME } from './types';

// 최소 HWPX 구조의 section0.xml 템플릿
function buildSectionXml(markdown: string, theme: CorporateTheme): string {
  const lines = markdown.split('\n');
  const paragraphs: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push('<hp:p><hp:run><hp:char><hp:t> </hp:t></hp:char></hp:run></hp:p>');
      continue;
    }

    let text = trimmed;
    let bold = false;
    let fontSize = 1000; // 10pt in HWPX units (100 = 1pt)

    if (trimmed.startsWith('# ')) {
      text = trimmed.slice(2);
      bold = true;
      fontSize = 2000;
    } else if (trimmed.startsWith('## ')) {
      text = trimmed.slice(3);
      bold = true;
      fontSize = 1600;
    } else if (trimmed.startsWith('### ')) {
      text = trimmed.slice(4);
      bold = true;
      fontSize = 1300;
    } else if (/^[-*]\s/.test(trimmed)) {
      text = `• ${trimmed.slice(2)}`;
    } else if (/^\d+\.\s/.test(trimmed)) {
      // 번호 리스트는 그대로 유지
    }

    // 마크다운 인라인 포맷 제거 (HWPX XML에서는 단순 텍스트로)
    text = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1');
    // XML 이스케이프
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const charPrXml = `<hp:charPr>
      <hp:sz val="${fontSize}" />
      ${bold ? '<hp:bold />' : ''}
    </hp:charPr>`;

    paragraphs.push(`<hp:p>
      <hp:run>
        ${charPrXml}
        <hp:char><hp:t>${text}</hp:t></hp:char>
      </hp:run>
    </hp:p>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<hp:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hp2="http://www.hancom.co.kr/hwpml/2011/core">
  <hp:subList>
    ${paragraphs.join('\n    ')}
  </hp:subList>
</hp:sec>`;
}

// 최소 HWPX 패키지 구조 생성
function buildMinimalHwpxPackage(): { path: string; content: string }[] {
  return [
    {
      path: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml" />
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Override PartName="/Contents/section0.xml" ContentType="application/xml" />
</Types>`,
    },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://www.hancom.co.kr/hwpml/2011/relationship/document" Target="Contents/content.hpf" />
</Relationships>`,
    },
    {
      path: 'Contents/content.hpf',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<hpf:package xmlns:hpf="http://www.hancom.co.kr/hwpml/2011/hpf">
  <hpf:sections>
    <hpf:section href="section0.xml" />
  </hpf:sections>
</hpf:package>`,
    },
  ];
}

export async function renderHwpx(
  markdown: string,
  title: string,
  theme: CorporateTheme = DEFAULT_THEME,
): Promise<RenderOutput> {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip();

  // 기본 패키지 파일 추가
  const packageFiles = buildMinimalHwpxPackage();
  for (const f of packageFiles) {
    zip.addFile(f.path, Buffer.from(f.content, 'utf-8'));
  }

  // section0.xml 생성
  const sectionXml = buildSectionXml(markdown, theme);
  zip.addFile('Contents/section0.xml', Buffer.from(sectionXml, 'utf-8'));

  const buffer = zip.toBuffer();

  return {
    buffer,
    mimeType: 'application/hwp+zip',
    extension: 'hwpx',
    fileName: `${title}.hwpx`,
  };
}
