// 문서 상태값 단일 출처 — DB 값·한글 라벨·사용자 전환 규칙.
// DB 트리거(052_protect_document_workflow_status.sql)와 같은 규칙이므로 함께 바꾼다.

/** DB documents.status 에 저장되는 값 전체. submitted 는 과거 데이터 호환용. */
export const DOCUMENT_STATUSES = ['draft', 'completed', 'in_approval', 'submitted', 'approved', 'rejected'] as const;
export type DocumentStatusValue = (typeof DOCUMENT_STATUSES)[number];

/** 사용자가 직접(PATCH) 설정할 수 있는 상태. 나머지는 결재 API(service role)만 쓴다. */
export const USER_SETTABLE_STATUSES = ['draft', 'completed'] as const;

/** 결재 진행·완료 상태 — 사용자 세션에서 본문·제목 수정 금지. */
export const WORKFLOW_LOCKED_STATUSES = ['in_approval', 'submitted', 'approved'] as const;

const STATUS_LABELS: Record<DocumentStatusValue, string> = {
  completed: '완료',
  draft: '초안',
  in_approval: '결재중',
  submitted: '결재중',
  approved: '승인됨',
  rejected: '반려됨',
};

export function documentStatusLabel(status: string): string {
  return (STATUS_LABELS as Record<string, string>)[status] ?? status;
}

export function isUserSettableStatus(status: string): boolean {
  return (USER_SETTABLE_STATUSES as readonly string[]).includes(status);
}

export function isWorkflowLockedStatus(status: string): boolean {
  return (WORKFLOW_LOCKED_STATUSES as readonly string[]).includes(status);
}

/**
 * 사용자 세션의 문서 수정 가능 여부. 위반 시 사유 문자열, 허용 시 null.
 * - 상태 전환은 초안↔완료, 반려→초안만 허용(결재 상태 위조·결재 중 문서 되돌리기 차단)
 * - 결재 진행·완료 문서의 본문·제목 수정 금지
 */
export function userDocumentUpdateViolation(
  currentStatus: string,
  updates: { status?: string; content?: string; title?: string },
): string | null {
  if (updates.status !== undefined && updates.status !== currentStatus) {
    const fromAllowed = isUserSettableStatus(currentStatus) || (currentStatus === 'rejected' && updates.status === 'draft');
    if (!isUserSettableStatus(updates.status) || !fromAllowed) {
      return '결재 상태는 결재 기능으로만 변경할 수 있습니다.';
    }
  }
  if ((updates.content !== undefined || updates.title !== undefined) && isWorkflowLockedStatus(currentStatus)) {
    return '결재 중이거나 승인된 문서는 수정할 수 없습니다.';
  }
  return null;
}
