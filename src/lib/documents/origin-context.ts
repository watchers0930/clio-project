// 문서 생성 출처(origin_context) 표시 이름 — 화면(새 문서 창)·검색 API·문서 상세가 함께 쓰는 단일 출처.
// 서버 전용 의존성 없이 순수 데이터로 둬 클라이언트에서도 import 할 수 있다.

export const DOCUMENT_RELATION_LABELS: Record<string, string> = {
  meeting_minutes: '회의 기반 문서',
  meeting_followup: '회의 후속 문서',
  report_update: '업데이트 보고서',
  report_draft: '보고서 초안',
  shared_followup: '공유 문서 기반 후속',
  document_followup: '기준 문서 기반 후속',
};

/** 알 수 없는 출처면 null — 기본 문구가 필요한 곳은 호출부에서 덧붙인다. */
export function originContextLabel(originContext: string | null | undefined): string | null {
  return DOCUMENT_RELATION_LABELS[originContext ?? ''] ?? null;
}
