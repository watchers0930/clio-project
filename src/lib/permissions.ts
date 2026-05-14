/**
 * CLIO 역할 기반 권한 시스템 (RBAC)
 *
 * 역할 계층: admin > manager > user
 * - admin: 전체 시스템 관리 (부서/사용자/파일/템플릿 전체)
 * - manager: 자기 부서 내 관리 (부서 내 파일/사용자/템플릿)
 * - user: 개인 작업만 (본인 파일 업로드/삭제, 템플릿 사용)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

type FileAccessRow = {
  id: string;
  uploaded_by: string | null;
  department_id: string | null;
};

type DocumentAccessRow = {
  id: string;
  created_by: string | null;
};

export type Permission =
  | 'dept.create' | 'dept.edit' | 'dept.edit.own' | 'dept.delete'
  | 'user.edit' | 'user.role' | 'user.edit.own_dept'
  | 'file.upload' | 'file.delete.any' | 'file.delete.own_dept' | 'file.delete.own'
  | 'file.share' | 'file.share.own'
  | 'document.edit.any' | 'document.edit.own' | 'document.share'
  | 'template.edit.any' | 'template.edit.own_dept' | 'template.use';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'dept.create', 'dept.edit', 'dept.delete',
    'user.edit', 'user.role',
    'file.upload', 'file.delete.any', 'file.share',
    'document.edit.any', 'document.share',
    'template.edit.any',
  ],
  manager: [
    'dept.edit.own',
    'user.edit.own_dept',
    'file.upload', 'file.delete.own_dept', 'file.share',
    'document.share',
    'template.edit.own_dept', 'template.use',
  ],
  user: [
    'file.upload', 'file.delete.own', 'file.share.own',
    'document.edit.own',
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

export async function getAccessibleFileIds(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  userDeptId: string | null,
  fileRows: FileAccessRow[],
): Promise<Set<string>> {
  if (userRole === 'admin') return new Set(fileRows.map((file) => file.id));
  if (fileRows.length === 0) return new Set();

  const accessibleIds = new Set<string>();
  const permissionTargetIds: string[] = [];

  for (const file of fileRows) {
    if (file.uploaded_by === userId || (userDeptId && file.department_id === userDeptId)) {
      accessibleIds.add(file.id);
    } else {
      permissionTargetIds.push(file.id);
    }
  }

  if (permissionTargetIds.length === 0) return accessibleIds;

  let permissionQuery = supabase
    .from('file_permissions')
    .select('file_id')
    .in('file_id', permissionTargetIds)
    .eq('granted_to_user', userId);

  if (userDeptId) {
    permissionQuery = supabase
      .from('file_permissions')
      .select('file_id')
      .in('file_id', permissionTargetIds)
      .or(`granted_to_user.eq.${userId},granted_to_dept.eq.${userDeptId}`);
  }

  const { data: permissionRows } = await permissionQuery;
  for (const row of ((permissionRows ?? []) as Array<{ file_id: string | null }>)) {
    if (row.file_id) accessibleIds.add(row.file_id);
  }

  return accessibleIds;
}

export async function filterAccessibleFileRows<T extends FileAccessRow>(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  userDeptId: string | null,
  fileRows: T[],
): Promise<T[]> {
  const accessibleIds = await getAccessibleFileIds(supabase, userId, userRole, userDeptId, fileRows);
  return fileRows.filter((file) => accessibleIds.has(file.id));
}

export async function canAccessDocument(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  userDeptId: string | null,
  documentId: string,
): Promise<boolean> {
  if (userRole === 'admin') return true;

  const { data: document } = await supabase
    .from('documents')
    .select('created_by')
    .eq('id', documentId)
    .single();

  if (!document) return false;
  if (document.created_by === userId) return true;

  const { count } = await supabase
    .from('document_permissions')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .or(`granted_to_user.eq.${userId}${userDeptId ? `,granted_to_dept.eq.${userDeptId}` : ''}`);

  return (count ?? 0) > 0;
}

export async function getAccessibleDocumentIds(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  userDeptId: string | null,
  documentRows: DocumentAccessRow[],
): Promise<Set<string>> {
  if (userRole === 'admin') return new Set(documentRows.map((doc) => doc.id));
  if (documentRows.length === 0) return new Set();

  const accessibleIds = new Set<string>();
  const permissionTargetIds: string[] = [];

  for (const document of documentRows) {
    if (document.created_by === userId) {
      accessibleIds.add(document.id);
    } else {
      permissionTargetIds.push(document.id);
    }
  }

  if (permissionTargetIds.length === 0) return accessibleIds;

  let permissionQuery = supabase
    .from('document_permissions')
    .select('document_id')
    .in('document_id', permissionTargetIds)
    .eq('granted_to_user', userId);

  if (userDeptId) {
    permissionQuery = supabase
      .from('document_permissions')
      .select('document_id')
      .in('document_id', permissionTargetIds)
      .or(`granted_to_user.eq.${userId},granted_to_dept.eq.${userDeptId}`);
  }

  const { data: permissionRows } = await permissionQuery;
  for (const row of ((permissionRows ?? []) as Array<{ document_id: string | null }>)) {
    if (row.document_id) accessibleIds.add(row.document_id);
  }

  return accessibleIds;
}

export async function filterAccessibleDocumentRows<T extends DocumentAccessRow>(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  userDeptId: string | null,
  documentRows: T[],
): Promise<T[]> {
  const accessibleIds = await getAccessibleDocumentIds(supabase, userId, userRole, userDeptId, documentRows);
  return documentRows.filter((document) => accessibleIds.has(document.id));
}

export async function canManageDocument(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  documentId: string,
): Promise<boolean> {
  if (userRole === 'admin') return true;

  const { data: document } = await supabase
    .from('documents')
    .select('created_by')
    .eq('id', documentId)
    .single();

  return !!document && document.created_by === userId;
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
