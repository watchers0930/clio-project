// =============================================================================
// CLIO UI 공통 상수
// 파일 타입 뱃지, 상태 색상 등 여러 페이지에서 공유하는 UI 상수
// =============================================================================

/** 파일 타입 뱃지 스타일 */
export const FILE_TYPE_BADGE: Record<string, string> = {
  PDF:  'bg-surface-secondary text-foreground',
  DOCX: 'bg-surface-secondary text-foreground',
  PPTX: 'bg-surface-secondary text-foreground',
  XLSX: 'bg-surface-secondary text-foreground',
  HWP:  'bg-surface-secondary text-foreground',
  MD:   'bg-surface-secondary text-foreground',
  M4A:  'bg-surface-secondary text-foreground',
};

/** 파일 처리 상태 색상 */
export const FILE_STATUS_COLOR: Record<string, string> = {
  '완료':  'bg-surface-secondary text-success',
  '처리중': 'bg-surface-secondary text-warning',
  '오류':  'bg-surface-secondary text-danger',
};

/** 문서 상태 뱃지 */
export const DOCUMENT_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft:     { label: '초안', color: 'bg-surface-secondary text-foreground-secondary' },
  completed: { label: '완성', color: 'bg-success/10 text-success' },
};

/** 감사 로그 액션 레이블 */
export const ACTION_LABELS: Record<string, string> = {
  'file.upload':              '파일을 업로드했습니다.',
  'file.delete':              '파일을 삭제했습니다.',
  'document.create':          '문서를 생성했습니다.',
  'document.share':           '문서를 내부 공유했습니다.',
  'share.link.create':        '공유 링크를 만들었습니다.',
  'document.comment.create':  '문서에 코멘트를 남겼습니다.',
  'document.comment.status':  '코멘트 상태를 변경했습니다.',
  'document.comment.reflect': '코멘트를 문서에 반영했습니다.',
  'document.delete':          '문서를 삭제했습니다.',
  'template.create':          '템플릿을 생성했습니다.',
  'search':                   '검색을 수행했습니다.',
};

/** 차트 기본 색상 팔레트 — CSS 변수 참조 */
export const CHART_COLORS = [
  'var(--color-foreground)',
  'var(--color-foreground-secondary)',
  'var(--color-primary)',
  'var(--color-foreground-quaternary)',
  'var(--color-border-secondary)',
] as const;

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
