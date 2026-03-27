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
