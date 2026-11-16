import { detectImageMime, IMAGE_EXTENSION, type UploadImageMime } from '@/lib/utils/signature-data-url';

// 서명·회사 직인·회사 로고 업로드 공용 검증 — 크기 상한 + 실제 파일 내용(매직바이트) 기준 형식 판별
export const UPLOAD_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type UploadImage =
  | { ok: true; buffer: Buffer; mime: UploadImageMime; ext: string }
  | { ok: false; error: string };

export async function readUploadImage(file: unknown): Promise<UploadImage> {
  if (!file || typeof file !== 'object' || typeof (file as Blob).arrayBuffer !== 'function') {
    return { ok: false, error: '파일이 없습니다.' };
  }
  const blob = file as Blob;
  if (blob.size === 0) return { ok: false, error: '빈 파일입니다.' };
  if (blob.size > UPLOAD_IMAGE_MAX_BYTES) return { ok: false, error: '파일 크기는 2MB 이하여야 합니다.' };
  const buffer = Buffer.from(await blob.arrayBuffer());
  const mime = detectImageMime(buffer);
  if (!mime) return { ok: false, error: 'PNG, JPEG, WebP 형식만 지원합니다.' };
  return { ok: true, buffer, mime, ext: IMAGE_EXTENSION[mime] };
}
