/**
 * 파일 타입별 텍스트 추출
 * PDF, DOCX, XLSX, MD/TXT 지원
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
    mimeType === 'text/markdown' ||
    mimeType === 'text/plain' ||
    ['md', 'txt', 'csv', 'tsv'].includes(ext)
  ) {
    text = new TextDecoder().decode(buffer);
  } else if (ext === 'hwp' || mimeType === 'application/haansofthwp' || mimeType === 'application/x-hwp') {
    text = await extractHwp(buffer, fileName);
  } else if (ext === 'pptx' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    // PPTX 기본 처리
    text = `[PPTX 파일: ${fileName}] — 프레젠테이션 파일입니다.`;
  } else {
    throw new Error(`지원하지 않는 파일 형식입니다: ${mimeType} (${ext})`);
  }

  if (text.length > MAX_TEXT_LENGTH) {
    console.warn(`[extract-text] 텍스트가 ${MAX_TEXT_LENGTH}자를 초과하여 잘림: ${fileName}`);
    text = text.slice(0, MAX_TEXT_LENGTH);
  }

  return text.trim();
}

async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const result = await pdfParse(Buffer.from(buffer));
  return result.text;
}

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractXlsx(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const texts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    texts.push(`[시트: ${sheetName}]\n${csv}`);
  }

  return texts.join('\n\n');
}

async function extractHwp(buffer: ArrayBuffer, fileName: string): Promise<string> {
  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');
  const hwp = await import('node-hwp');

  // node-hwp는 파일 경로만 받으므로 임시 파일 생성
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
