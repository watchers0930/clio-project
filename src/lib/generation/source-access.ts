// 문서 생성 참조자료(sourceFileIds) 접근 확인.
// 참조자료는 service role 로 읽으므로(file_chunks·Storage), 요청한 id 를 파일 목록 API 와 같은 규칙
// (filterAccessibleFileRows: admin/소유자/같은 부서/file_permissions)으로 걸러 "볼 수 있는 파일만" 쓰게 한다.
import type { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { filterAccessibleFileRows, getUserRoleInfo } from '@/lib/permissions';

type SessionClient = NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;
type SourceFileRow = { id: string; uploaded_by: string | null; department_id: string | null };

/** 세션 사용자가 볼 수 있는 행만 남긴다. 인증·사용자 정보가 없으면 빈 배열(전부 거부). 걸러진 개수만 경고로 남긴다. */
export async function filterAccessibleSourceFiles<T extends SourceFileRow>(
  supabase: SessionClient,
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const userId = await getAuthUserId(supabase);
  const roleInfo = userId ? await getUserRoleInfo(supabase, userId) : null;
  const accessible = userId && roleInfo
    ? await filterAccessibleFileRows(supabase, userId, roleInfo.role, roleInfo.department_id, rows)
    : [];
  if (accessible.length < rows.length) {
    console.warn(`[loadSourceChunks] 접근 권한 없는 참조자료 제외: ${rows.length - accessible.length}/${rows.length}건`);
  }
  return accessible;
}
