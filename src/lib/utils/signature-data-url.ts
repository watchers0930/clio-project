export type UploadImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

/** 파일 앞부분(매직바이트)으로 실제 이미지 형식을 판별 — 모르는 형식이면 null. 업로드 검증은 이 값을 기준으로 한다(브라우저가 보낸 MIME 은 위조 가능) */
export function detectImageMime(buffer: Buffer): UploadImageMime | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export const IMAGE_EXTENSION: Record<UploadImageMime, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export function getImageMimeType(buffer: Buffer) {
  return detectImageMime(buffer) ?? 'image/png';
}

export function signatureBufferToDataUrl(buffer: Buffer | null | undefined) {
  if (!buffer) return '';
  return `data:${getImageMimeType(buffer)};base64,${buffer.toString('base64')}`;
}
