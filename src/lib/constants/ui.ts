// =============================================================================
// CLIO UI 공통 상수
// 파일 타입 뱃지, 상태 색상 등 여러 페이지에서 공유하는 UI 상수
// =============================================================================

/** 파일 타입 뱃지 스타일 */
export const FILE_TYPE_BADGE: Record<string, string> = {
  PDF:  'bg-[#f5f5f7] text-[#1d1d1f]',
  DOCX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  PPTX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  XLSX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  HWP:  'bg-[#f5f5f7] text-[#1d1d1f]',
  MD:   'bg-[#f5f5f7] text-[#1d1d1f]',
  M4A:  'bg-[#f5f5f7] text-[#1d1d1f]',
};

/** 파일 처리 상태 색상 */
export const FILE_STATUS_COLOR: Record<string, string> = {
  '완료':  'bg-[#f5f5f7] text-[#30d158]',
  '처리중': 'bg-[#f5f5f7] text-[#ff9f0a]',
  '오류':  'bg-[#f5f5f7] text-[#ff3b30]',
};

/** 결재 상태 뱃지 */
export const APPROVAL_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending:  { label: '대기', color: 'text-[#ff9f0a] bg-[#ff9f0a]/10' },
  approved: { label: '승인', color: 'text-[#30d158] bg-[#30d158]/10' },
  rejected: { label: '반려', color: 'text-[#ff3b30] bg-[#ff3b30]/10' },
};

/** 문서 상태 뱃지 */
export const DOCUMENT_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft:     { label: '초안',   color: 'bg-[#f5f5f7] text-[#6e6e73]' },
  completed: { label: '완성',   color: 'bg-[#e8f5e9] text-[#30d158]' },
  submitted: { label: '결재중', color: 'bg-[#fff3e0] text-[#ff9f0a]' },
  approved:  { label: '승인됨', color: 'bg-[#e3f2fd] text-[#0071e3]' },
  rejected:  { label: '반려됨', color: 'bg-[#ffebee] text-[#ff3b30]' },
};

/** 감사 로그 액션 레이블 */
export const ACTION_LABELS: Record<string, string> = {
  'file.upload':              '파일을 업로드했습니다.',
  'file.delete':              '파일을 삭제했습니다.',
  'document.create':          '문서를 생성했습니다.',
  'document.delete':          '문서를 삭제했습니다.',
  'document.submit_approval': '결재를 요청했습니다.',
  'document.approve':         '문서를 승인했습니다.',
  'document.reject':          '문서를 반려했습니다.',
  'template.create':          '템플릿을 생성했습니다.',
  'search':                   '검색을 수행했습니다.',
};

/** 차트 기본 색상 팔레트 */
export const CHART_COLORS = ['#1d1d1f', '#6e6e73', '#0071e3', '#a1a1a6', '#d2d2d7'] as const;
