// 문서(documents) 파일 내려받기 — 문서 상세·버전 목록·검색 결과가 함께 쓰는 단일 경로.
// 제안서는 서버가 HTML 로 내려주고(format=pdf 요청), 그 밖의 문서는 DOCX.

const PROPOSAL_TEMPLATE = '제안서';

export function documentDownloadSpec(templateName: string | null | undefined): { format: 'pdf' | 'docx'; extension: 'html' | 'docx' } {
  return templateName === PROPOSAL_TEMPLATE ? { format: 'pdf', extension: 'html' } : { format: 'docx', extension: 'docx' };
}

/** 내려받기에 성공하면 null, 실패하면 화면에 보일 오류 문구 */
export async function downloadDocumentFile(id: string, title: string, templateName: string | null | undefined): Promise<string | null> {
  const { format, extension } = documentDownloadSpec(templateName);
  try {
    const res = await fetch(`/api/documents/${encodeURIComponent(id)}/download?format=${format}&font=${encodeURIComponent('맑은 고딕')}`);
    if (!res.ok) return '다운로드 실패';
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
    return null;
  } catch {
    return '다운로드 중 오류';
  }
}
