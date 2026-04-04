/** 파일명 sanitize — path traversal, 특수문자 방지 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/\.\./g, '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .trim()
    .slice(0, 255);
}

/** 허용 MIME 타입 */
export const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/haansofthwp',
  'application/x-hwp',
  'application/hwp+zip',
  'text/markdown',
  'text/plain',
  'text/csv',
  'audio/m4a',
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
]);

/** 허용 확장자 (MIME 타입 미확인 시 폴백) */
export const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'hwp', 'hwpx', 'md', 'txt', 'csv', 'tsv',
  'm4a', 'mp3', 'wav', 'webm', 'ogg',
]);

/** 파일 업로드 최대 크기 (50MB) */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** 파일 업로드 검증 */
export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `파일 크기가 50MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_MIMES.has(file.type) && !ALLOWED_EXTENSIONS.has(ext)) {
    return `지원하지 않는 파일 형식입니다: ${file.type || ext}`;
  }
  return null; // 유효
}
