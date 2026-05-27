export const statusColor: Record<string, string> = {
  초안: 'bg-[#2E6FF2]/8 text-[#2E6FF2]',
  완료: 'bg-[#1A5AD9]/8 text-[#1A5AD9]',
};

export const statusDot: Record<string, string> = {
  초안: '#2E6FF2',
  완료: '#1A5AD9',
};

export const FONT_OPTIONS = ['맑은 고딕', '나눔고딕', '바탕', '돋움', '굴림', '나눔명조', 'Arial', 'Times New Roman'];
export const DOWNLOAD_FORMAT_OPTIONS = ['docx', 'hwpx', 'pdf'] as const;
export const TEMPLATE_ICONS: Record<string, string> = {
  '주간업무보고서': '📊',
  '회의록': '📝',
  '기술설계문서': '💡',
  '마케팅_캠페인_기획서': '🎯',
  '채용공고_양식': '👥',
  '사업계획서': '📋',
};

export const DOCUMENT_RELATION_LABELS: Record<string, string> = {
  meeting_minutes: '회의 기반 문서',
  meeting_followup: '회의 후속 문서',
  report_update: '업데이트 보고서',
  report_draft: '보고서 초안',
  shared_followup: '공유 문서 기반 후속',
  document_followup: '기준 문서 기반 후속',
};
