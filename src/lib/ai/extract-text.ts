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
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.template' ||
    ext === 'docx' ||
    ext === 'dotx'
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
  // Node.js 서버리스 환경에서 pdfjs-dist가 요구하는 DOMMatrix 폴리필
  if (typeof globalThis.DOMMatrix === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).DOMMatrix = class DOMMatrix {
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      is2D = true; isIdentity = true;
    };
  }
  // pdfjs가 ArrayBuffer를 detach할 수 있으므로 OCR fallback용 복사본 보관
  const bufferForOcr = buffer.slice(0);

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = new pdfjsLib.PDFWorker({ port: null });
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      worker,
      isEvalSupported: false,
      // 표준 폰트(Helvetica 등) 사용 PDF의 텍스트 추출을 위해 CDN 경로 제공
      standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@5.4.296/standard_fonts/',
    });
    const doc = await loadingTask.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? (item as { str: string }).str : ''))
        .join('');
      if (pageText.trim()) pages.push(pageText);
    }
    doc.destroy();
    const text = pages.join('\n');

    // 텍스트가 없으면 스캔 이미지 PDF → GPT-4o OCR fallback
    if (!text.trim()) {
      console.log('[extract-pdf] 텍스트 없음, GPT-4o OCR 시도');
      return await extractPdfOcr(bufferForOcr);
    }

    return text;
  } finally {
    worker.destroy();
  }
}

// ─── PDF OCR (GPT-4o Responses API) ────────────────────────
// 스캔 이미지 PDF 등 텍스트 레이어가 없는 경우 fallback
async function extractPdfOcr(buffer: ArrayBuffer): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[extract-pdf-ocr] OPENAI_API_KEY 없음, OCR 건너뜀');
    return '';
  }

  // 20MB 초과 파일은 OCR 비용/시간 문제로 스킵
  const MAX_OCR_BYTES = 20 * 1024 * 1024;
  if (buffer.byteLength > MAX_OCR_BYTES) {
    console.warn(`[extract-pdf-ocr] 파일 크기 초과 (${buffer.byteLength}B), OCR 건너뜀`);
    return '';
  }

  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey });

    const base64 = Buffer.from(buffer).toString('base64');

    const response = await client.responses.create({
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              filename: 'document.pdf',
              file_data: `data:application/pdf;base64,${base64}`,
            },
            {
              type: 'input_text',
              text: '이 PDF 문서의 모든 텍스트를 추출해주세요. 표, 제목, 본문을 포함한 모든 내용을 순서대로 출력하되, 부연 설명 없이 문서 텍스트만 출력하세요.',
            },
          ],
        },
      ],
    });

    const text = response.output_text ?? '';
    console.log(`[extract-pdf-ocr] OCR 성공: ${text.length}자`);
    return text;
  } catch (err) {
    console.error('[extract-pdf-ocr] OCR 실패:', err);
    return '';
  }
}

// ─── DOCX ──────────────────────────────────────────────────
async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
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

// ─── HWPX → XML에서 텍스트 추출 (PizZip 사용) ──────────────
async function extractHwpx(buffer: ArrayBuffer, fileName: string): Promise<string> {
  const PizZip = (await import('pizzip')).default;

  try {
    const zip = new PizZip(Buffer.from(buffer));
    const texts: string[] = [];

    // HWPX는 ZIP 패키지: Contents/section0.xml, section1.xml ...
    const sectionFiles = Object.keys(zip.files)
      .filter(name => /^Contents\/section\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/section(\d+)/)?.[1] ?? '0');
        const numB = parseInt(b.match(/section(\d+)/)?.[1] ?? '0');
        return numA - numB;
      });

    for (const name of sectionFiles) {
      const xml = zip.file(name)?.asText() ?? '';
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
    const doc = await new Promise<{ _hml?: Record<string, unknown> }>((resolve, reject) => {
      hwp.open(tmpPath, (err: Error | null, doc) => {
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

// ─── XLSX 구조화 추출 (셀 주소 포함, 템플릿용) ────────────
export async function extractXlsxStructured(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet['!ref']) {
      sheets.push(`[시트: ${sheetName}]\n(빈 시트)`);
      continue;
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const rows: string[] = [];

    for (let r = range.s.r; r <= range.e.r; r++) {
      const cells: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        const val = cell ? String(cell.v ?? '').trim() : '';
        cells.push(`${addr}: ${val || '(빈칸)'}`);
      }
      rows.push(cells.join(' | '));
    }

    sheets.push(`[시트: ${sheetName}] (${range.e.r - range.s.r + 1}행 × ${range.e.c - range.s.c + 1}열)\n${rows.join('\n')}`);
  }

  return sheets.join('\n\n');
}

/** 오디오 파일인지 확인 */
export function isAudioFile(mimeType: string, fileName: string): boolean {
  const audioMimes = ['audio/m4a', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4'];
  const audioExts = ['m4a', 'mp3', 'wav', 'webm', 'ogg'];
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return audioMimes.includes(mimeType) || audioExts.includes(ext);
}
