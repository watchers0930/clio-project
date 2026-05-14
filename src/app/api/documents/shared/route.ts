import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { canAccessDocument, getUserRoleInfo } from '@/lib/permissions';

interface SharedDocCard {
  id: string;
  title: string;
  ownerName: string;
  latestSharedAt: string | null;
  shareScopeLabel: string | null;
  permissionCount: number;
  linkCount: number;
  pendingCommentCount: number;
  href: string;
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json({ success: false, error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    const admin = createAdminSupabaseClient();

    const [
      permissionRowsRes,
      ownedDocsRes,
      sharedLinksRes,
      docPermissionRowsRes,
      usersRes,
      pendingCommentsRes,
    ] = await Promise.all([
      admin
        .from('document_permissions')
        .select('document_id, granted_by, granted_to_user, granted_to_dept, created_at')
        .or(`granted_to_user.eq.${authUserId}${roleInfo.department_id ? `,granted_to_dept.eq.${roleInfo.department_id}` : ''}`)
        .order('created_at', { ascending: false }),
      admin
        .from('documents')
        .select('id, title, created_by, created_at')
        .eq('created_by', authUserId)
        .order('created_at', { ascending: false })
        .limit(50),
      admin
        .from('shared_links')
        .select('resource_id, created_at')
        .eq('resource_type', 'document')
        .eq('created_by', authUserId)
        .order('created_at', { ascending: false }),
      admin
        .from('document_permissions')
        .select('document_id, created_at')
        .order('created_at', { ascending: false }),
      admin.from('users').select('id, name'),
      admin.from('document_comments').select('document_id, status'),
    ]);

    const users = usersRes.data ?? [];
    const userNameMap = new Map(users.map((user) => [user.id, user.name]));
    const pendingCommentCountMap = new Map<string, number>();
    for (const comment of (pendingCommentsRes.data ?? [])) {
      if (comment.status !== 'pending') continue;
      pendingCommentCountMap.set(
        comment.document_id,
        (pendingCommentCountMap.get(comment.document_id) ?? 0) + 1,
      );
    }

    const incomingPermissions = permissionRowsRes.data ?? [];
    const incomingDocIds = [...new Set(incomingPermissions.map((item) => item.document_id))];
    const incomingDocsRes = incomingDocIds.length > 0
      ? await admin
          .from('documents')
          .select('id, title, created_by, created_at')
          .in('id', incomingDocIds)
      : { data: [] as Array<{ id: string; title: string; created_by: string | null; created_at: string }> };

    const incomingCards: SharedDocCard[] = [];
    for (const doc of (incomingDocsRes.data ?? [])) {
      if (doc.created_by === authUserId) continue;
      const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, doc.id);
      if (!canAccess) continue;
      const recentPermission = incomingPermissions.find((item) => item.document_id === doc.id);
      incomingCards.push({
        id: doc.id,
        title: doc.title,
        ownerName: userNameMap.get(doc.created_by ?? '') ?? '알 수 없음',
        latestSharedAt: recentPermission?.created_at ?? doc.created_at,
        shareScopeLabel: recentPermission?.granted_to_user === authUserId ? '사용자 직접 공유' : '부서 공유',
        permissionCount: 1,
        linkCount: 0,
        pendingCommentCount: pendingCommentCountMap.get(doc.id) ?? 0,
        href: `/documents/${doc.id}`,
      });
    }

    const ownedDocs = ownedDocsRes.data ?? [];
    const ownedPermissionRows = docPermissionRowsRes.data ?? [];
    const sharedLinkRows = sharedLinksRes.data ?? [];
    const outgoingCards: SharedDocCard[] = [];

    for (const doc of ownedDocs) {
      const permissionCount = ownedPermissionRows.filter((item) => item.document_id === doc.id).length;
      const linkCount = sharedLinkRows.filter((item) => item.resource_id === doc.id).length;
      if (permissionCount === 0 && linkCount === 0) continue;

      const latestPermissionAt = ownedPermissionRows.find((item) => item.document_id === doc.id)?.created_at;
      const latestLinkAt = sharedLinkRows.find((item) => item.resource_id === doc.id)?.created_at;
      const latestShareAt = [latestPermissionAt, latestLinkAt].filter(Boolean).sort().reverse()[0];

      outgoingCards.push({
        id: doc.id,
        title: doc.title,
        ownerName: '내 문서',
        latestSharedAt: latestShareAt ?? doc.created_at,
        shareScopeLabel: permissionCount > 0 && linkCount > 0
          ? '내부 공유 + 링크 공유'
          : permissionCount > 0
            ? '내부 공유'
            : '링크 공유',
        permissionCount,
        linkCount,
        pendingCommentCount: pendingCommentCountMap.get(doc.id) ?? 0,
        href: `/documents/${doc.id}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        incomingCount: incomingCards.length,
        outgoingCount: outgoingCards.length,
        incomingDocuments: incomingCards.slice(0, 8),
        outgoingDocuments: outgoingCards.slice(0, 8),
      },
    });
  } catch (error) {
    console.error('[documents/shared]', error);
    return NextResponse.json({ success: false, error: '공유 문서 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
