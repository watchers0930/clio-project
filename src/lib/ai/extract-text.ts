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
    // HWP 파일은 바이너리 형식이라 직접 파싱 어려움 — 빈 텍스트로 처리
    console.warn(`[extract-text] HWP 파일은 텍스트 추출이 제한적입니다: ${fileName}`);
    text = `[HWP 파일: ${fileName}] — HWP 파일은 양식 구조 참조용으로 등록되었습니다. 텍스트 자동 추출은 지원되지 않습니다.`;
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

/** 오디오 파일인지 확인 */
export function isAudioFile(mimeType: string, fileName: string): boolean {
  const audioMimes = ['audio/m4a', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4'];
  const audioExts = ['m4a', 'mp3', 'wav', 'webm', 'ogg'];
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return audioMimes.includes(mimeType) || audioExts.includes(ext);
}
