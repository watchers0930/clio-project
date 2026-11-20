import { validateDocumentUpdate } from '@/schemas/document-update';
import { userDocumentUpdateViolation } from '@/lib/documents/document-status';
import { countLockedDocumentReferences, isLockedDocumentError, checkDocumentDeletion } from '@/lib/documents/locked-references';

const LOCKED_ORIGIN_MESSAGE = '이 문서를 원본으로 하는 결재 중이거나 승인된 문서가 있어 삭제할 수 없습니다.';
import { withMutation } from '@/lib/http/mutation-guard';
import { NextRequest, NextResponse } from 'next/server';
import { removeUnreferencedBlobs } from '@/lib/storage/blob-cleanup';
import type { ApiResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { scheduleDocumentEmbedding } from '@/lib/ai/embed-document';
import { canAccessDocument, canManageDocument, getUserRoleInfo } from '@/lib/permissions';
import { loadDocumentDetail } from '@/lib/documents/document-detail-ops';
import { composeInputsContent, splitInputsContent } from '@/lib/documents/embedded-inputs';

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

    // 편집 화면은 '입력값 주석 + 본문'으로 보낸다 → 저장 직전에 본문과 입력값 칸으로 나눈다(본문에는 주석을 남기지 않음)
    const dbUpdates: Record<string, unknown> = { ...updates };
    if (updates.content !== undefined) {
      const split = splitInputsContent(updates.content);
      dbUpdates.content = split.content;
      if (split.inputValues) dbUpdates.input_values = split.inputValues;
    }

    const { data, error } = await supabase
      .from('documents')
      .update(dbUpdates)
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

    // 본문이 바뀌면 검색 벡터 재생성 — 응답 후(저장 성공 뒤에만)
    if (content !== undefined) scheduleDocumentEmbedding(id);

    // 응답도 편집 화면 형식('입력값 주석 + 본문')으로 — 저장 후 편집기가 같은 값을 기준으로 이어서 편집한다
    return NextResponse.json<ApiResponse>({ success: true, data: data ? { ...data, content: composeInputsContent(data.content, data.input_values) } : data });
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

    const { data: target } = await createAdminSupabaseClient().from('documents').select('storage_path, status').eq('id', id).maybeSingle();
    // 결재중·승인 문서(결재 건 포함)는 관리자만 삭제 — DB 트리거 069 와 같은 규칙
    const blocked = await checkDocumentDeletion(createAdminSupabaseClient(), [{ id, status: target?.status ?? null }], roleInfo.role);
    if (blocked) return NextResponse.json<ApiResponse>({ success: false, error: blocked.error }, { status: blocked.status });
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      // 069 트리거(동시에 결재가 상신된 경우) — 원본 잠금 문구가 아니라 관리자 전용 사유로 답한다
      if (error.message?.includes('관리자만')) return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 403 });
      if (isLockedDocumentError(error)) {
        return NextResponse.json<ApiResponse>({ success: false, error: LOCKED_ORIGIN_MESSAGE }, { status: 409 });
      }
      console.error('[documents/[id]/DELETE]', error.message);
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 삭제에 실패했습니다.' }, { status: 500 });
    }
    await removeUnreferencedBlobs([target?.storage_path], 'document');

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
