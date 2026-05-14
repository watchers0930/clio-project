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

/** 문서 상태 뱃지 */
export const DOCUMENT_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft:     { label: '초안', color: 'bg-[#f5f5f7] text-[#6e6e73]' },
  completed: { label: '완성', color: 'bg-[#e8f5e9] text-[#30d158]' },
};

/** 감사 로그 액션 레이블 */
export const ACTION_LABELS: Record<string, string> = {
  'file.upload':              '파일을 업로드했습니다.',
  'file.delete':              '파일을 삭제했습니다.',
  'document.create':          '문서를 생성했습니다.',
  'document.delete':          '문서를 삭제했습니다.',
  'template.create':          '템플릿을 생성했습니다.',
  'search':                   '검색을 수행했습니다.',
};

/** 차트 기본 색상 팔레트 */
export const CHART_COLORS = ['#1d1d1f', '#6e6e73', '#0071e3', '#a1a1a6', '#d2d2d7'] as const;

/** 제품 공통 메시지 */
export const PLATFORM_LABEL = '기업 문서 운영 플랫폼';
export const PLATFORM_HERO_LABEL = 'Enterprise Document Platform';
export const PLATFORM_CORE_FLOW = '저장 · 공유 · 검색 · 반영';
export const PLATFORM_SHORT_GUIDE =
  '문서를 저장하고, 공유하고, 코멘트를 반영하고, 다시 찾는 일상 업무 흐름에 맞춰 이동하세요.';

/** 대시보드 오늘의 명언 */
export const DAILY_QUOTES = [
  '성공은 반복된 작은 노력의 합이다.',
  '기회는 준비된 사람에게 보인다.',
  '행동이 생각을 완성한다.',
  '꾸준함은 재능을 이긴다.',
  '오늘의 선택이 내일의 방향을 만든다.',
  '완벽보다 실행이 먼저다.',
  '집중은 복잡한 일을 단순하게 만든다.',
  '가장 큰 진전은 멈추지 않는 데서 나온다.',
  '작은 개선이 큰 변화를 만든다.',
  '명확함은 속도를 만든다.',
  '지속하는 사람이 결국 도착한다.',
  '좋은 결과는 좋은 습관에서 시작된다.',
] as const;
