/** MIME → 확장자 매핑 */
export function mimeToType(mime: string | null, name: string): string {
  if (!mime) return name.split('.').pop()?.toUpperCase() ?? 'FILE';
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'application/haansofthwp': 'HWP',
    'application/x-hwp': 'HWP',
    'audio/m4a': 'M4A',
    'text/markdown': 'MD',
  };
  return map[mime] ?? name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

/** 파일 사이즈 포맷 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
