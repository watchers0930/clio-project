// 문서(documents) 파일 내려받기 — 문서 상세·버전 목록·검색 결과가 함께 쓰는 단일 경로.
// 제안서는 format=pdf 로, 그 밖의 문서는 docx 로 요청한다. 실제 확장자는 받은 응답으로 정한다(저장 원본이 PDF·HWPX 일 수 있음).

const PROPOSAL_TEMPLATE = '제안서';

export function documentDownloadSpec(templateName: string | null | undefined): { format: 'pdf' | 'docx'; extension: 'html' | 'docx' } {
  return templateName === PROPOSAL_TEMPLATE ? { format: 'pdf', extension: 'html' } : { format: 'docx', extension: 'docx' };
}

// 서버가 저장 원본(PDF·HWPX 등)을 그대로 내려줄 때가 있어 요청 형식이 아니라 '받은 응답'으로 확장자를 정한다
const MIME_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/haansofthwpx': 'hwpx',
  'application/hwp+zip': 'hwpx',
  'text/html': 'html',
};

/** 응답 헤더의 파일명(Content-Disposition) → 없으면 Content-Type → 둘 다 모르면 요청 형식의 확장자 */
export function extensionFromResponse(contentDisposition: string | null, contentType: string | null, fallback: string): string {
  const encoded = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  let name = '';
  try {
    name = encoded ? decodeURIComponent(encoded.trim()) : (contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? '');
  } catch {
    name = '';
  }
  const fromName = name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  const mime = (contentType ?? '').split(';')[0].trim().toLowerCase();
  return MIME_EXTENSION[mime] ?? fallback;
}

/** 내려받기에 성공하면 null, 실패하면 화면에 보일 오류 문구 */
export async function downloadDocumentFile(id: string, title: string, templateName: string | null | undefined): Promise<string | null> {
  const { format, extension } = documentDownloadSpec(templateName);
  try {
    const res = await fetch(`/api/documents/${encodeURIComponent(id)}/download?format=${format}&font=${encodeURIComponent('맑은 고딕')}`);
    if (!res.ok) return '다운로드 실패';
    const ext = extensionFromResponse(res.headers.get('content-disposition'), res.headers.get('content-type'), extension);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    return null;
  } catch {
    return '다운로드 중 오류';
  }
}
