import { validateDocumentUpdate } from '@/schemas/document-update';
import { userDocumentUpdateViolation } from '@/lib/documents/document-status';
import { countLockedDocumentReferences, isLockedDocumentError } from '@/lib/documents/locked-references';

const LOCKED_ORIGIN_MESSAGE = '이 문서를 원본으로 하는 결재 중이거나 승인된 문서가 있어 삭제할 수 없습니다.';
import { withMutation } from '@/lib/http/mutation-guard';
import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { embedDocument } from '@/lib/ai/embed-document';
import { canAccessDocument, canManageDocument, getUserRoleInfo } from '@/lib/permissions';
import { loadDocumentDetail } from '@/lib/documents/document-detail-ops';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json<ApiResponse>({ success: false, error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, id);
    if (!canAccess) {
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 접근 권한이 없습니다.' }, { status: 403 });
    }

    const admin = createAdminSupabaseClient();

    const detail = await loadDocumentDetail(admin, supabase, authUserId, roleInfo, id);
    if (!detail) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '문서를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: detail,
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '문서 상세 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const { id } = await params;
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json<ApiResponse>({ success: false, error: '유효한 JSON 요청이 필요합니다.' }, { status: 400 }); }
    const validated = validateDocumentUpdate(body);
    if (!validated.ok) return NextResponse.json<ApiResponse>({ success: false, error: validated.error }, { status: 400 });
    const { updates } = validated;
    const { content, status } = updates;

    const supabase = mutation.supabase;
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'DB 미설정' }, { status: 503 });
    }

    const authUserId = mutation.userId;
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json<ApiResponse>({ success: false, error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    const canManage = await canManageDocument(supabase, authUserId, roleInfo.role, id);
    if (!canManage) {
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 수정 권한이 없습니다.' }, { status: 403 });
    }

    // 현재 상태 기준 전환 규칙(DB 트리거 052와 동일) — 결재 상태 위조·결재 중 문서 수정 차단
    const { data: current } = await supabase.from('documents').select('status').eq('id', id).maybeSingle();
    if (!current) {
      return NextResponse.json<ApiResponse>({ success: false, error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }
    const violation = userDocumentUpdateViolation(current.status as string, updates);
    if (violation) {
      return NextResponse.json<ApiResponse>({ success: false, error: violation }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // 조회~수정 사이 결재 상신 등 경합 시 DB 트리거(052)가 거부 → 409로 사유 전달
      if (isLockedDocumentError(error)) {
        return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 409 });
      }
      console.error('[documents/[id]/PATCH]', error.message);
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 수정에 실패했습니다.' }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: status ? 'document.status_change' : 'document.edit',
      target_type: 'document',
      target_id: id,
      details: { ...updates },
    }).then(() => {}, () => {});

    // content가 변경된 경우 임베딩 재생성 — fire-and-forget
    if (content !== undefined && data?.content) {
      embedDocument(id, data.content).then(() => {}, (e) => {
        console.error('[documents/[id]/PATCH] embed error:', e);
      });
    }

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: '문서 수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const mutation = await withMutation(_request);
  if (mutation.error) return mutation.error;
  try {
    const { id } = await params;

    const supabase = mutation.supabase;
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = mutation.userId;
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json<ApiResponse>({ success: false, error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    const canManage = await canManageDocument(supabase, authUserId, roleInfo.role, id);
    if (!canManage) {
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 삭제 권한이 없습니다.' }, { status: 403 });
    }

    // 결재 잠금 버전·파생 문서의 원본은 삭제 불가(연쇄 SET NULL이 052 트리거에 걸림)
    const lockedChildren = await countLockedDocumentReferences(createAdminSupabaseClient(), ['parent_id', 'origin_document_id'], id);
    if (lockedChildren > 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: LOCKED_ORIGIN_MESSAGE }, { status: 409 });
    }

    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      if (isLockedDocumentError(error)) {
        return NextResponse.json<ApiResponse>({ success: false, error: LOCKED_ORIGIN_MESSAGE }, { status: 409 });
      }
      console.error('[documents/[id]/DELETE]', error.message);
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 삭제에 실패했습니다.' }, { status: 500 });
    }

    if (authUserId) {
      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'document.delete',
        target_type: 'document',
        target_id: id,
        details: {},
      }).then(() => {}, () => {});
    }

    return NextResponse.json<ApiResponse>({ success: true, data: { id } });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '문서 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
