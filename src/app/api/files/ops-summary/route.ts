import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { canAccessDocument, getUserRoleInfo } from '@/lib/permissions';

interface ResourceSpotlightItem {
  id: string;
  title: string;
  type: 'file' | 'document';
  href: string;
  meta: string;
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
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [ownedFilesRes, ownedDocsRes, allDocsRes, sharedLinksRes, filePermsRes, docPermsRes, auditLogsRes] = await Promise.all([
      admin.from('files').select('id, name, created_at').eq('uploaded_by', authUserId).order('created_at', { ascending: false }).limit(50),
      admin.from('documents').select('id, title, created_at').eq('created_by', authUserId).order('created_at', { ascending: false }).limit(50),
      admin.from('documents').select('id, title, created_at').order('created_at', { ascending: false }).limit(80),
      admin.from('shared_links').select('resource_type, resource_id'),
      admin.from('file_permissions').select('file_id'),
      admin.from('document_permissions').select('document_id'),
      admin
        .from('audit_logs')
        .select('target_id, action, created_at')
        .eq('target_type', 'document')
        .gte('created_at', cutoff)
        .in('action', ['document.create', 'document.edit', 'document.status_change'])
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    const ownedFiles = ownedFilesRes.data ?? [];
    const ownedDocs = ownedDocsRes.data ?? [];
    const allDocs = allDocsRes.data ?? [];
    const sharedLinks = sharedLinksRes.data ?? [];
    const filePermissionIds = new Set((filePermsRes.data ?? []).map((item) => item.file_id));
    const docPermissionIds = new Set((docPermsRes.data ?? []).map((item) => item.document_id));

    const sharedFileLinkIds = new Set(
      sharedLinks.filter((item) => item.resource_type === 'file').map((item) => item.resource_id),
    );
    const sharedDocumentLinkIds = new Set(
      sharedLinks.filter((item) => item.resource_type === 'document').map((item) => item.resource_id),
    );

    const sharePendingFiles = ownedFiles
      .filter((file) => !filePermissionIds.has(file.id) && !sharedFileLinkIds.has(file.id))
      .map<ResourceSpotlightItem>((file) => ({
        id: file.id,
        title: file.name,
        type: 'file',
        href: `/files`,
        meta: `업로드 ${file.created_at.split('T')[0]} · 아직 공유되지 않음`,
      }));

    const sharePendingDocuments = ownedDocs
      .filter((doc) => !docPermissionIds.has(doc.id) && !sharedDocumentLinkIds.has(doc.id))
      .map<ResourceSpotlightItem>((doc) => ({
        id: doc.id,
        title: doc.title,
        type: 'document',
        href: `/documents/${doc.id}`,
        meta: `생성 ${doc.created_at.split('T')[0]} · 아직 공유되지 않음`,
      }));

    const accessibleDocuments = [];
    for (const doc of allDocs) {
      const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, doc.id);
      if (canAccess) accessibleDocuments.push(doc);
    }

    const accessibleDocIds = accessibleDocuments.map((doc) => doc.id);
    let pendingCommentsByDoc = new Map<string, number>();
    if (accessibleDocIds.length > 0) {
      const { data: pendingComments } = await admin
        .from('document_comments')
        .select('document_id')
        .in('document_id', accessibleDocIds)
        .eq('status', 'pending');

      pendingCommentsByDoc = new Map<string, number>();
      for (const comment of (pendingComments ?? [])) {
        pendingCommentsByDoc.set(comment.document_id, (pendingCommentsByDoc.get(comment.document_id) ?? 0) + 1);
      }
    }

    const commentPendingDocuments = accessibleDocuments
      .filter((doc) => (pendingCommentsByDoc.get(doc.id) ?? 0) > 0)
      .map<ResourceSpotlightItem>((doc) => ({
        id: doc.id,
        title: doc.title,
        type: 'document',
        href: `/documents/${doc.id}#document-comment-panel`,
        meta: `미반영 코멘트 ${pendingCommentsByDoc.get(doc.id) ?? 0}개`,
      }))
      .sort((a, b) => (pendingCommentsByDoc.get(b.id) ?? 0) - (pendingCommentsByDoc.get(a.id) ?? 0));

    const recentUpdateLogRows = auditLogsRes.data ?? [];
    const recentUpdatedDocuments: ResourceSpotlightItem[] = [];
    const seenRecentDocIds = new Set<string>();

    for (const log of recentUpdateLogRows) {
      if (!log.target_id || seenRecentDocIds.has(log.target_id)) continue;
      const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, log.target_id);
      if (!canAccess) continue;
      const matchingDoc = accessibleDocuments.find((doc) => doc.id === log.target_id);
      if (!matchingDoc) continue;

      seenRecentDocIds.add(log.target_id);
      recentUpdatedDocuments.push({
        id: matchingDoc.id,
        title: matchingDoc.title,
        type: 'document',
        href: `/documents/${matchingDoc.id}`,
        meta: `${log.created_at.split('T')[0]} · ${log.action === 'document.create' ? '새 문서 생성' : log.action === 'document.status_change' ? '상태 변경' : '문서 수정'}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        sharePendingCount: sharePendingFiles.length + sharePendingDocuments.length,
        commentPendingCount: commentPendingDocuments.length,
        recentUpdateCount: recentUpdatedDocuments.length,
        sharePendingItems: [...sharePendingDocuments, ...sharePendingFiles].slice(0, 4),
        commentPendingItems: commentPendingDocuments.slice(0, 4),
        recentUpdatedItems: recentUpdatedDocuments.slice(0, 4),
      },
    });
  } catch (error) {
    console.error('[files/ops-summary]', error);
    return NextResponse.json({ success: false, error: '문서허브 운영 요약 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
