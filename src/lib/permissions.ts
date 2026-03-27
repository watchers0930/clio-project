/**
 * CLIO 역할 기반 권한 시스템 (RBAC)
 *
 * 역할 계층: admin > manager > user
 * - admin: 전체 시스템 관리 (부서/사용자/파일/템플릿 전체)
 * - manager: 자기 부서 내 관리 (부서 내 파일/사용자/템플릿)
 * - user: 개인 작업만 (본인 파일 업로드/삭제, 템플릿 사용)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type Permission =
  | 'dept.create' | 'dept.edit' | 'dept.edit.own' | 'dept.delete'
  | 'user.edit' | 'user.role' | 'user.edit.own_dept'
  | 'file.upload' | 'file.delete.any' | 'file.delete.own_dept' | 'file.delete.own'
  | 'file.share' | 'file.share.own'
  | 'template.edit.any' | 'template.edit.own_dept' | 'template.use';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'dept.create', 'dept.edit', 'dept.delete',
    'user.edit', 'user.role',
    'file.upload', 'file.delete.any', 'file.share',
    'template.edit.any',
  ],
  manager: [
    'dept.edit.own',
    'user.edit.own_dept',
    'file.upload', 'file.delete.own_dept', 'file.share',
    'template.edit.own_dept', 'template.use',
  ],
  user: [
    'file.upload', 'file.delete.own', 'file.share.own',
    'template.use',
  ],
};

/** 역할이 특정 권한을 갖는지 확인 */
export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes(permission);
}

/** 역할이 admin 이상인지 */
export function isAdmin(role: string): boolean {
  return role === 'admin';
}

/** 역할이 manager 이상인지 */
export function isManagerOrAbove(role: string): boolean {
  return role === 'admin' || role === 'manager';
}

/**
 * 사용자가 파일을 삭제할 수 있는지 확인
 * - admin: 무조건 가능
 * - manager: 자기 부서 파일
 * - user: 본인 업로드 파일만
 */
export async function canDeleteFile(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  userDeptId: string | null,
  fileId: string,
): Promise<boolean> {
  if (userRole === 'admin') return true;

  const { data: file } = await supabase
    .from('files')
    .select('uploaded_by, department_id')
    .eq('id', fileId)
    .single();

  if (!file) return false;

  if (userRole === 'manager' && userDeptId && file.department_id === userDeptId) return true;
  if (file.uploaded_by === userId) return true;

  return false;
}

/**
 * 사용자가 파일에 접근(읽기)할 수 있는지 확인
 * - 본인 업로드 파일
 * - 본인 부서 파일
 * - file_permissions를 통해 권한 부여된 파일
 * - admin은 모든 파일
 */
export async function canAccessFile(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  userDeptId: string | null,
  fileId: string,
): Promise<boolean> {
  if (userRole === 'admin') return true;

  const { data: file } = await supabase
    .from('files')
    .select('uploaded_by, department_id')
    .eq('id', fileId)
    .single();

  if (!file) return false;
  if (file.uploaded_by === userId) return true;
  if (userDeptId && file.department_id === userDeptId) return true;

  // file_permissions 확인
  const { count } = await supabase
    .from('file_permissions')
    .select('id', { count: 'exact', head: true })
    .eq('file_id', fileId)
    .or(`granted_to_user.eq.${userId}${userDeptId ? `,granted_to_dept.eq.${userDeptId}` : ''}`);

  return (count ?? 0) > 0;
}

/**
 * 현재 사용자의 역할 및 부서 정보 조회
 */
export async function getUserRoleInfo(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ role: string; department_id: string | null } | null> {
  const { data } = await supabase
    .from('users')
    .select('role, department_id')
    .eq('id', userId)
    .single();

  return data;
}
