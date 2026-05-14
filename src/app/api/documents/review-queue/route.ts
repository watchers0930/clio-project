import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { filterAccessibleDocumentRows, getUserRoleInfo } from '@/lib/permissions';

interface ReviewQueueItem {
  id: string;
  title: string;
  ownerName: string;
  pendingCount: number;
  heldCount: number;
  latestCommentAt: string | null;
  topStatusLabel: 'pending' | 'held';
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
    const [{ data: docs }, { data: comments }, { data: users }] = await Promise.all([
      admin.from('documents').select('id, title, created_by').order('created_at', { ascending: false }).limit(120),
      admin
        .from('document_comments')
        .select('document_id, status, created_at')
        .in('status', ['pending', 'held'])
        .order('created_at', { ascending: false }),
      admin.from('users').select('id, name'),
    ]);

    const userNameMap = new Map((users ?? []).map((user) => [user.id, user.name]));
    const commentStatsMap = new Map<string, { pendingCount: number; heldCount: number; latestCommentAt: string | null }>();

    for (const comment of (comments ?? [])) {
      const current = commentStatsMap.get(comment.document_id) ?? {
        pendingCount: 0,
        heldCount: 0,
        latestCommentAt: null,
      };
      if (comment.status === 'pending') current.pendingCount += 1;
      if (comment.status === 'held') current.heldCount += 1;
      if (!current.latestCommentAt || comment.created_at > current.latestCommentAt) {
        current.latestCommentAt = comment.created_at;
      }
      commentStatsMap.set(comment.document_id, current);
    }

    const accessibleDocs = await filterAccessibleDocumentRows(
      supabase,
      authUserId,
      roleInfo.role,
      roleInfo.department_id,
      (docs ?? []) as Array<{ id: string; title: string; created_by: string | null }>,
    );

    const reviewQueue: ReviewQueueItem[] = [];
    for (const doc of accessibleDocs) {
      const stats = commentStatsMap.get(doc.id);
      if (!stats) continue;
      reviewQueue.push({
        id: doc.id,
        title: doc.title,
        ownerName: userNameMap.get(doc.created_by ?? '') ?? '알 수 없음',
        pendingCount: stats.pendingCount,
        heldCount: stats.heldCount,
        latestCommentAt: stats.latestCommentAt,
        topStatusLabel: stats.pendingCount > 0 ? 'pending' : 'held',
        href: `/documents/${doc.id}#document-comment-panel`,
      });
    }

    reviewQueue.sort((a, b) => {
      const pendingGap = b.pendingCount - a.pendingCount;
      if (pendingGap !== 0) return pendingGap;
      const heldGap = b.heldCount - a.heldCount;
      if (heldGap !== 0) return heldGap;
      return (b.latestCommentAt ?? '').localeCompare(a.latestCommentAt ?? '');
    });

    return NextResponse.json({
      success: true,
      data: {
        total: reviewQueue.length,
        pendingTotal: reviewQueue.reduce((sum, item) => sum + item.pendingCount, 0),
        heldTotal: reviewQueue.reduce((sum, item) => sum + item.heldCount, 0),
        items: reviewQueue.slice(0, 20),
      },
    });
  } catch (error) {
    console.error('[documents/review-queue]', error);
    return NextResponse.json({ success: false, error: '검토 큐 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
