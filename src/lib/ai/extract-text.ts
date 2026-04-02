/**
 * 파일 타입별 텍스트 추출
 * PDF, DOCX, XLSX, PPTX, HWP, HWPX, MD/TXT 지원
 */

const MAX_TEXT_LENGTH = 500_000;

export async function extractText(
  buffer: ArrayBuffer,
  mimeType: string,
  fileName: string,
): Promise<string> {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  let text = '';

  if (mimeType === 'application/pdf' || ext === 'pdf') {
    text = await extractPdf(buffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    text = await extractDocx(buffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    ext === 'xlsx'
  ) {
    text = await extractXlsx(buffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    ext === 'pptx'
  ) {
    text = await extractPptx(buffer, fileName);
  } else if (
    mimeType === 'text/markdown' ||
    mimeType === 'text/plain' ||
    ['md', 'txt', 'csv', 'tsv'].includes(ext)
  ) {
    text = new TextDecoder().decode(buffer);
  } else if (ext === 'hwpx' || mimeType === 'application/hwp+zip') {
    text = await extractHwpx(buffer, fileName);
  } else if (ext === 'hwp' || mimeType === 'application/haansofthwp' || mimeType === 'application/x-hwp') {
    text = await extractHwp(buffer, fileName);
  } else {
    throw new Error(`지원하지 않는 파일 형식입니다: ${mimeType} (${ext})`);
  }

  if (text.length > MAX_TEXT_LENGTH) {
    console.warn(`[extract-text] 텍스트가 ${MAX_TEXT_LENGTH}자를 초과하여 잘림: ${fileName}`);
    text = text.slice(0, MAX_TEXT_LENGTH);
  }

  return text.trim();
}

// ─── PDF ───────────────────────────────────────────────────
async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const result = await pdfParse(Buffer.from(buffer));
  return result.text;
}

// ─── DOCX ──────────────────────────────────────────────────
async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// ─── XLSX → 구조화 JSON ────────────────────────────────────
async function extractXlsx(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // 구조화 JSON으로 추출 (AI가 수치 트렌드를 이해할 수 있도록)
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (jsonData.length === 0) {
      sheets.push(`[시트: ${sheetName}]\n(빈 시트)`);
      continue;
    }

    // 헤더 추출
    const headers = Object.keys(jsonData[0]);
    // 요약 정보
    const summary = {
      sheetName,
      rowCount: jsonData.length,
      columns: headers,
    };

    // 데이터를 구조화된 형태로 변환
    const dataPreview = jsonData.slice(0, 100); // 최대 100행

    sheets.push(
      `[시트: ${sheetName}] (${jsonData.length}행 × ${headers.length}열)\n` +
      `컬럼: ${headers.join(', ')}\n` +
      `데이터:\n${JSON.stringify(dataPreview, null, 1)}\n` +
      (jsonData.length > 100 ? `... (${jsonData.length - 100}행 추가 데이터 생략)` : '') +
      `\n요약: ${JSON.stringify(summary)}`
    );
  }

  return sheets.join('\n\n');
}

// ─── PPTX → 슬라이드별 텍스트 추출 ─────────────────────────
async function extractPptx(buffer: ArrayBuffer, fileName: string): Promise<string> {
  const AdmZip = (await import('adm-zip')).default;

  try {
    const zip = new AdmZip(Buffer.from(buffer));
    const slides: { num: number; texts: string[] }[] = [];

    // 슬라이드 엔트리 찾기 (ppt/slides/slide1.xml, slide2.xml, ...)
    const entries = zip.getEntries();
    const slideEntries = entries
      .filter(e => /^ppt\/slides\/slide\d+\.xml$/i.test(e.entryName))
      .sort((a, b) => {
        const numA = parseInt(a.entryName.match(/slide(\d+)/)?.[1] ?? '0');
        const numB = parseInt(b.entryName.match(/slide(\d+)/)?.[1] ?? '0');
        return numA - numB;
      });

    for (const entry of slideEntries) {
      const xml = entry.getData().toString('utf-8');
      const slideNum = parseInt(entry.entryName.match(/slide(\d+)/)?.[1] ?? '0');

      // XML에서 텍스트 노드 추출 (<a:t> 태그)
      const textMatches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? [];
      const texts = textMatches
        .map(m => m.replace(/<[^>]+>/g, '').trim())
        .filter(t => t.length > 0);

      if (texts.length > 0) {
        slides.push({ num: slideNum, texts });
      }
    }

    if (slides.length === 0) {
      return `[PPTX: ${fileName}] 텍스트를 추출할 수 없습니다.`;
    }

    const result = slides.map(s =>
      `[슬라이드 ${s.num}]\n${s.texts.join('\n')}`
    ).join('\n\n');

    return `[PPTX: ${fileName}] (${slides.length}개 슬라이드)\n\n${result}`;
  } catch (err) {
    console.error(`[extract-pptx] ${fileName}:`, err);
    return `[PPTX: ${fileName}] 텍스트 추출 실패`;
  }
}

// ─── HWPX → XML에서 텍스트 추출 ────────────────────────────
async function extractHwpx(buffer: ArrayBuffer, fileName: string): Promise<string> {
  const AdmZip = (await import('adm-zip')).default;

  try {
    const zip = new AdmZip(Buffer.from(buffer));
    const texts: string[] = [];

    // HWPX는 ZIP 패키지: Contents/section0.xml, section1.xml ...
    const entries = zip.getEntries();
    const sectionEntries = entries
      .filter(e => /^Contents\/section\d+\.xml$/i.test(e.entryName))
      .sort((a, b) => {
        const numA = parseInt(a.entryName.match(/section(\d+)/)?.[1] ?? '0');
        const numB = parseInt(b.entryName.match(/section(\d+)/)?.[1] ?? '0');
        return numA - numB;
      });

    for (const entry of sectionEntries) {
      const xml = entry.getData().toString('utf-8');
      // <hp:t> 또는 <t> 태그에서 텍스트 추출
      const textMatches = xml.match(/<(?:hp:)?t[^>]*>([^<]*)<\/(?:hp:)?t>/g) ?? [];
      const sectionTexts = textMatches
        .map(m => m.replace(/<[^>]+>/g, '').trim())
        .filter(t => t.length > 0);
      texts.push(...sectionTexts);
    }

    if (texts.length === 0) {
      return `[HWPX: ${fileName}] 텍스트를 추출할 수 없습니다.`;
    }

    return texts.join('\n');
  } catch (err) {
    console.error(`[extract-hwpx] ${fileName}:`, err);
    return `[HWPX: ${fileName}] 텍스트 추출 실패`;
  }
}

// ─── HWP (바이너리) ────────────────────────────────────────
async function extractHwp(buffer: ArrayBuffer, fileName: string): Promise<string> {
  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');
  const hwp = await import('node-hwp');

  const tmpPath = path.join(os.tmpdir(), `hwp_${Date.now()}.hwp`);
  fs.writeFileSync(tmpPath, Buffer.from(buffer));

  try {
    const doc = await new Promise<Record<string, unknown>>((resolve, reject) => {
      hwp.open(tmpPath, (err: Error | null, doc: Record<string, unknown>) => {
        if (err) reject(err);
        else resolve(doc);
      });
    });

    const hml = doc._hml as Record<string, unknown> | undefined;
    if (!hml) return `[HWP: ${fileName}] 텍스트 추출 실패`;

    const texts: string[] = [];
    function walk(node: unknown) {
      if (!node) return;
      if (typeof node === 'string') { texts.push(node); return; }
      if (typeof node === 'object' && node !== null) {
        const obj = node as Record<string, unknown>;
        if (typeof obj.text === 'string') texts.push(obj.text);
        if (typeof obj.value === 'string') texts.push(obj.value);
        if (Array.isArray(obj.children)) obj.children.forEach(walk);
        if (Array.isArray(obj)) (obj as unknown[]).forEach(walk);
      }
    }
    walk(hml);

    return texts.filter((t) => t.trim() && !t.startsWith('^')).join('\n');
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

/** 오디오 파일인지 확인 */
export function isAudioFile(mimeType: string, fileName: string): boolean {
  const audioMimes = ['audio/m4a', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4'];
  const audioExts = ['m4a', 'mp3', 'wav', 'webm', 'ogg'];
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return audioMimes.includes(mimeType) || audioExts.includes(ext);
}
