/**
 * CLIO 역할 기반 권한 시스템 (RBAC)
 *
 * 역할 계층: admin > manager > user
 * - admin: 전체 시스템 관리 (부서/사용자/파일/템플릿 전체)
 * - manager: 자기 부서 내 관리 (부서 내 파일/사용자/템플릿)
 * - user: 개인 작업만 (본인 파일 업로드/삭제, 템플릿 사용)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

type FileAccessRow = {
  id: string;
  uploaded_by: string | null;
  department_id: string | null;
};

export type DocumentAccessRow = {
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
 * 전사 직원 주간업무를 조회할 수 있는 권한(대표이사 또는 시스템 관리자).
 * 대표(rank_level=1)는 role이 manager라 role 게이트로는 못 막으므로 rank_level을 함께 본다.
 */
export function canViewAllWeeklyReports(role: string, rankLevel: number | null | undefined): boolean {
  return role === 'admin' || (typeof rankLevel === 'number' && rankLevel <= 1);
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
 * - 메신저로 공유받은 파일(file_shares, 만료 전)
 * - admin은 모든 파일
 * 판단은 service role 로 한다 — 사용자 세션 RLS 가 권한 받은 파일 행을 가려 목록(service role 기준)과
 * 다운로드·미리보기 판단이 어긋나지 않게 하기 위함. file_permissions·file_shares 는 서버만 쓴다(055).
 */
export async function canAccessFile(
  _supabase: SupabaseClient,
  userId: string,
  userRole: string,
  userDeptId: string | null,
  fileId: string,
): Promise<boolean> {
  if (userRole === 'admin') return true;
  const admin = createAdminSupabaseClient();

  const { data: file } = await admin
    .from('files')
    .select('uploaded_by, department_id')
    .eq('id', fileId)
    .maybeSingle();

  if (!file) return false;
  if (file.uploaded_by === userId) return true;
  if (userDeptId && file.department_id === userDeptId) return true;

  const [permissions, shares] = await Promise.all([
    admin
      .from('file_permissions')
      .select('id', { count: 'exact', head: true })
      .eq('file_id', fileId)
      .or(`granted_to_user.eq.${userId}${userDeptId ? `,granted_to_dept.eq.${userDeptId}` : ''}`),
    admin
      .from('file_shares')
      .select('id', { count: 'exact', head: true })
      .eq('file_id', fileId)
      .eq('shared_with', userId)
      .gt('expires_at', new Date().toISOString()),
  ]);

  return (permissions.count ?? 0) > 0 || (shares.count ?? 0) > 0;
}

const FILE_ACCESS_BATCH = 200;

/**
 * 목록용 일괄 판정 — canAccessFile 과 같은 규칙(소유자·같은 부서·file_permissions·유효한 file_shares)을 서버 권한으로 판정한다.
 * (이전엔 file_shares 를 빼먹어 공유받은 파일이 상세에선 열리는데 목록·검색·생성 원본에선 빠졌다)
 */
export async function getAccessibleFileIds(
  _supabase: SupabaseClient,
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

  // id 목록이 길면 URL 이 커지므로 나눠 조회한다. 조회 오류는 '권한 없음'으로 막되 원인을 남긴다.
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  for (let i = 0; i < permissionTargetIds.length; i += FILE_ACCESS_BATCH) {
    const batch = permissionTargetIds.slice(i, i + FILE_ACCESS_BATCH);
    const [permissions, shares] = await Promise.all([
      admin
        .from('file_permissions')
        .select('file_id')
        .in('file_id', batch)
        .or(`granted_to_user.eq.${userId}${userDeptId ? `,granted_to_dept.eq.${userDeptId}` : ''}`),
      admin
        .from('file_shares')
        .select('file_id')
        .in('file_id', batch)
        .eq('shared_with', userId)
        .gt('expires_at', now),
    ]);
    if (permissions.error) console.warn('[permissions] file_permissions 조회 실패:', permissions.error.message);
    if (shares.error) console.warn('[permissions] file_shares 조회 실패:', shares.error.message);
    for (const row of [...(permissions.data ?? []), ...(shares.data ?? [])] as Array<{ file_id: string | null }>) {
      if (row.file_id) accessibleIds.add(row.file_id);
    }
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

// 판정은 서버 권한으로 읽는다(canAccessFile·문서 목록 filterAccessibleDocumentRows 와 같은 기준) —
// 사용자 세션으로 읽으면 documents RLS(본인 + 같은 부서)에 걸려 다른 부서에서 공유받은 문서를 공유 기록이 있어도 거부했다.
async function hasDocumentRight(
  userId: string,
  userRole: string,
  userDeptId: string | null,
  documentId: string,
  editOnly: boolean,
): Promise<boolean> {
  if (userRole === 'admin') return true;
  const admin = createAdminSupabaseClient();

  const { data: document } = await admin
    .from('documents')
    .select('created_by')
    .eq('id', documentId)
    .maybeSingle();

  if (!document) return false;
  if (document.created_by === userId) return true;

  let grants = admin
    .from('document_permissions')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .or(`granted_to_user.eq.${userId}${userDeptId ? `,granted_to_dept.eq.${userDeptId}` : ''}`);
  if (editOnly) grants = grants.eq('permission', 'edit');
  const { count } = await grants;

  return (count ?? 0) > 0;
}

/** 열람: 관리자 / 작성자 / 공유(read·edit) 대상. */
export async function canAccessDocument(
  _supabase: SupabaseClient,
  userId: string,
  userRole: string,
  userDeptId: string | null,
  documentId: string,
): Promise<boolean> {
  return hasDocumentRight(userId, userRole, userDeptId, documentId, false);
}

/** 편집(새 버전 추가 등 문서 묶음을 바꾸는 일): 관리자 / 작성자 / 'edit' 공유 대상 — 'read' 공유만으로는 안 된다. */
export async function canEditDocument(
  userId: string,
  userRole: string,
  userDeptId: string | null,
  documentId: string,
): Promise<boolean> {
  return hasDocumentRight(userId, userRole, userDeptId, documentId, true);
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
