// 결재선 생성 — 조직도(users.manager_user_id) 트리를 따라 신청자부터 상위로 depth 단계만큼.

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  manager_user_id: string | null;
  rank_level: number | null;
  rank_title: string | null;
}

export interface ApprovalLineStep {
  step_order: number;      // 1=담당(신청자), 2~=상위 결재자
  approver_id: string;
  name: string;
  rank_title: string;      // 결재란 라벨 (담당 / 팀장 / 이사 …)
}

// 전결 권한 기준: 이 레벨 이하(숫자가 작을수록 상위)면 전결 가능. 대표1·이사2.
export const DELEGATION_MAX_LEVEL = 2;

/** rank_level이 DELEGATION_MAX_LEVEL 이하면 전결 가능(이사급 이상). */
export function canDelegate(rankLevel: number | null | undefined): boolean {
  return typeof rankLevel === 'number' && rankLevel <= DELEGATION_MAX_LEVEL;
}

/**
 * 신청자부터 직속 상위 체인을 따라 최대 depth 단계의 결재선을 만든다.
 * - step 1 = 담당(신청자 본인)
 * - step 2~ = 직속 상위자들 (최상위 도달 또는 depth 도달 시 종료)
 * 상위 체인에 사이클이 있어도 무한루프하지 않는다.
 */
export function buildApprovalLine(
  requesterId: string,
  membersById: Map<string, OrgMember>,
  depth: number,
): ApprovalLineStep[] {
  const steps: ApprovalLineStep[] = [];
  const seen = new Set<string>();
  let cursor: string | null = requesterId;
  let order = 1;

  while (cursor && steps.length < depth) {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const m = membersById.get(cursor);
    if (!m) break;
    steps.push({
      step_order: order,
      approver_id: m.id,
      name: m.name,
      rank_title: order === 1 ? '담당' : (m.rank_title ?? '결재'),
    });
    order += 1;
    cursor = m.manager_user_id;
  }
  return steps;
}
