// 사용자 비활성화·재활성화와 영구 삭제 가드 — 퇴사자 등은 삭제가 아니라 비활성화한다.
// users 를 참조하는 결재·근태 테이블이 ON DELETE CASCADE 라, 영구 삭제하면 결재 증적·근태 기록이 함께 사라진다.
import type { SupabaseClient } from '@supabase/supabase-js';
import { countLockedDocumentReferences } from '@/lib/documents/locked-references';

/** Auth 차단 기간 — 사실상 영구(재활성화 시 'none'으로 해제). */
const BAN_FOREVER = '876000h';

/** 비활성 사용자는 Supabase Auth에서 차단해 로그인·토큰 갱신을 모두 막는다. */
export async function syncAuthBan(admin: SupabaseClient, userId: string, isActive: boolean): Promise<string | null> {
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: isActive ? 'none' : BAN_FOREVER });
  // Auth 계정이 없는 프로필(404)은 차단할 로그인 자체가 없으므로 통과
  if (!error || error.status === 404) return null;
  return error.message;
}

/**
 * DB(is_active) 저장 뒤 Auth 차단을 맞춘다. 실패하면 DB를 되돌리고 false.
 * 순서가 DB→Auth 인 이유: 되돌리기까지 실패해 어긋나도 화면엔 DB 상태가 보여 재시도 버튼이 남고,
 * 로그인 라우트가 is_active=false 를 따로 막으므로 '비활성인데 로그인 가능'으로 남지 않는다.
 */
export async function syncAuthBanOrRevert(admin: SupabaseClient, userId: string, isActive: boolean): Promise<boolean> {
  const banError = await syncAuthBan(admin, userId, isActive);
  if (!banError) return true;
  console.error('[user-activation] auth ban sync:', banError);
  const { error } = await admin.from('users').update({ is_active: !isActive }).eq('id', userId);
  if (error) console.error('[user-activation] is_active revert:', error.message);
  return false;
}

/**
 * 비활성화하면 결재가 멈추는 경우 사유 문자열, 아니면 null.
 * 결재선은 조직도 직속 상위 체인이라, 비활성자가 체인에 남거나 대기 결재를 들고 있으면 결재가 진행되지 않는다.
 */
export async function deactivationBlocker(admin: SupabaseClient, userId: string): Promise<string | null> {
  const [subordinates, waitingSteps] = await Promise.all([
    admin.from('users').select('id', { count: 'exact', head: true }).eq('manager_user_id', userId).eq('is_active', true),
    admin.from('approval_steps').select('id, approval_requests!inner(status)', { count: 'exact', head: true })
      .eq('approver_id', userId).eq('status', 'waiting').eq('approval_requests.status', 'pending'),
  ]);
  if (subordinates.error) throw new Error(`하위 직원 확인 실패: ${subordinates.error.message}`);
  if (waitingSteps.error) throw new Error(`대기 결재 확인 실패: ${waitingSteps.error.message}`);
  if ((subordinates.count ?? 0) > 0) return `이 사용자를 직속 상위자로 둔 직원이 ${subordinates.count}명 있습니다. 조직도에서 상위자를 먼저 변경해주세요.`;
  if ((waitingSteps.count ?? 0) > 0) return `처리 대기 중인 결재가 ${waitingSteps.count}건 있습니다. 결재를 먼저 처리해주세요.`;
  return null;
}

/** [테이블, 컬럼] — 사용자 삭제 시 CASCADE로 지워지는 보존 대상 기록(운영 FK 확인 2026-11-13). */
const RETAINED_RECORD_REFS: ReadonlyArray<readonly [string, string]> = [
  ['approval_requests', 'requester_id'],
  ['approval_steps', 'approver_id'],
  ['approvals', 'requester_id'],
  ['approvals', 'approver_id'],
  ['attendance_records', 'user_id'],
  ['leave_requests', 'user_id'],
];

/** 영구 삭제하면 사라지는 결재·근태 기록 수. RLS를 피하도록 service role 클라이언트로 호출한다. 조회 실패는 throw. */
export async function countUserRetainedRecords(admin: SupabaseClient, userId: string): Promise<number> {
  const counts = await Promise.all([
    countLockedDocumentReferences(admin, ['created_by'], userId),
    ...RETAINED_RECORD_REFS.map(async ([table, column]) => {
      const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq(column, userId);
      if (error) throw new Error(`${table} 기록 확인 실패: ${error.message}`);
      return count ?? 0;
    }),
  ]);
  return counts.reduce((sum, n) => sum + n, 0);
}
