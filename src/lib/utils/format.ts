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

/** 상대 시간 포맷 (예: "3분 전", "2시간 전") */
export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

/** ISO 날짜 → 상대시간 or 날짜 문자열 */
export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return '방금 전';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return d.toISOString().split('T')[0];
}

/** 파일 확장자 추출 */
export function getFileType(name: string): string {
  const ext = name.split('.').pop()?.toUpperCase() ?? '';
  if (['PDF', 'DOCX', 'PPTX', 'XLSX', 'MD', 'HWP'].includes(ext)) return ext;
  return ext || 'FILE';
}
