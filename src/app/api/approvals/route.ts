import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') ?? 'pending'; // pending | my-requests

    const admin = createAdminSupabaseClient();

    if (tab === 'my-requests') {
      // 내가 올린 결재 요청
      const { data: rows, error } = await admin
        .from('approvals')
        .select('*')
        .eq('requester_id', authUserId)
        .order('requested_at', { ascending: false });

      if (error) {
        console.error('[approvals/GET my-requests]', error.message);
        return NextResponse.json({ success: false, error: '조회 실패' }, { status: 500 });
      }

      // 문서 + 결재자 정보 조인
      const docIds = [...new Set((rows ?? []).map(r => r.document_id))];
      const approverIds = [...new Set((rows ?? []).map(r => r.approver_id))];

      const [docRes, userRes] = await Promise.all([
        docIds.length > 0
          ? admin.from('documents').select('id, title, status, created_at').in('id', docIds)
          : Promise.resolve({ data: [] }),
        approverIds.length > 0
          ? admin.from('users').select('id, name, email').in('id', approverIds)
          : Promise.resolve({ data: [] }),
      ]);

      const docMap = new Map((docRes.data ?? []).map(d => [d.id, d]));
      const userMap = new Map((userRes.data ?? []).map(u => [u.id, u]));

      const approvals = (rows ?? []).map(r => ({
        id: r.id,
        documentId: r.document_id,
        documentTitle: docMap.get(r.document_id)?.title ?? '(삭제됨)',
        documentStatus: docMap.get(r.document_id)?.status ?? '',
        approver: userMap.get(r.approver_id) ?? null,
        status: r.status,
        comment: r.comment,
        requestedAt: r.requested_at,
        decidedAt: r.decided_at,
      }));

      return NextResponse.json({ success: true, data: approvals, count: approvals.length });
    }

    // 내가 결재할 문서 (기본)
    const { data: rows, error } = await admin
      .from('approvals')
      .select('*')
      .eq('approver_id', authUserId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('[approvals/GET pending]', error.message);
      return NextResponse.json({ success: false, error: '조회 실패' }, { status: 500 });
    }

    const docIds = [...new Set((rows ?? []).map(r => r.document_id))];
    const requesterIds = [...new Set((rows ?? []).map(r => r.requester_id))];

    const [docRes, userRes] = await Promise.all([
      docIds.length > 0
        ? admin.from('documents').select('id, title, status, created_at').in('id', docIds)
        : Promise.resolve({ data: [] }),
      requesterIds.length > 0
        ? admin.from('users').select('id, name, email, department_id').in('id', requesterIds)
        : Promise.resolve({ data: [] }),
    ]);

    // 부서명 매핑
    const deptIds = [...new Set((userRes.data ?? []).filter(u => u.department_id).map(u => u.department_id!))];
    const deptRes = deptIds.length > 0
      ? await admin.from('departments').select('id, name').in('id', deptIds)
      : { data: [] };
    const deptMap = new Map((deptRes.data ?? []).map(d => [d.id, d.name]));

    const docMap = new Map((docRes.data ?? []).map(d => [d.id, d]));
    const userMap = new Map((userRes.data ?? []).map(u => [u.id, u]));

    const approvals = (rows ?? []).map(r => {
      const requester = userMap.get(r.requester_id);
      return {
        id: r.id,
        documentId: r.document_id,
        documentTitle: docMap.get(r.document_id)?.title ?? '(삭제됨)',
        documentCreatedAt: docMap.get(r.document_id)?.created_at?.split('T')[0] ?? '',
        requester: requester ? {
          id: requester.id,
          name: requester.name,
          email: requester.email,
          department: deptMap.get(requester.department_id ?? '') ?? '',
        } : null,
        status: r.status,
        requestedAt: r.requested_at,
      };
    });

    return NextResponse.json({ success: true, data: approvals, count: approvals.length });
  } catch (err) {
    console.error('[approvals/GET]', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
