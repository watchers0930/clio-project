import { withMutation } from '@/lib/http/mutation-guard';
import { isWorkflowLockedStatus } from '@/lib/documents/document-status';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import OpenAI from 'openai';
import { canManageDocument, getUserRoleInfo } from '@/lib/permissions';
import { getEmbeddedInputsPrefix } from '@/lib/documents/embedded-inputs';
import {
  buildCurrentDocumentUpdate,
  buildSnapshotInsertPayload,
  type VersionedDocumentRow,
} from '@/lib/documents/versioning';

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }
  return new OpenAI({ apiKey });
}

async function loadCommentUserNames(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  comments: Array<{ user_id: string | null }>,
) {
  const userIds = [...new Set(comments.map((comment) => comment.user_id).filter(Boolean))] as string[];
  if (userIds.length === 0) return new Map<string, string>();

  const { data: users, error } = await admin.from('users').select('id, name').in('id', userIds);
  if (error) throw error;
  return new Map((users ?? []).map((user) => [user.id, user.name]));
}

/**
 * POST /api/documents/[id]/reflect
 * 선택된 댓글을 AI에 전달해 문서를 재생성 + 이전 버전 자동 저장
 *
 * body: { selectedCommentIds: string[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(req);
  if (mutation.error) return mutation.error;
  try {
    const { id: documentId } = await params;
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: 'AI 서비스가 설정되지 않았습니다.' }, { status: 503 });
    }
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: '서버 오류' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) return NextResponse.json({ success: false, error: '사용자 정보 없음' }, { status: 403 });

    const canManage = await canManageDocument(supabase, authUserId, roleInfo.role, documentId);
    if (!canManage) return NextResponse.json({ success: false, error: '문서 수정 권한이 없습니다.' }, { status: 403 });

    const body = await req.json();
    const selectedCommentIds: string[] = body.selectedCommentIds ?? [];
    if (selectedCommentIds.length === 0) {
      return NextResponse.json({ success: false, error: '반영할 댓글을 선택해주세요.' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    // 1. 현재 문서 조회
    const { data: doc } = await admin
      .from('documents')
      .select('id, title, content, status, parent_id, version_number, created_by, storage_path, template_id, source_file_ids, instructions')
      .eq('id', documentId)
      .single();

    if (!doc) return NextResponse.json({ success: false, error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    if (isWorkflowLockedStatus(doc.status)) {
      return NextResponse.json({ success: false, error: '결재 중이거나 승인된 문서에는 댓글을 반영할 수 없습니다.' }, { status: 409 });
    }
    if (!doc.content) return NextResponse.json({ success: false, error: '문서 내용이 없습니다.' }, { status: 400 });

    // 2. 선택된 댓글 조회
    const { data: comments } = await admin
      .from('document_comments')
      .select('content, user_id')
      .in('id', selectedCommentIds);

    if (!comments || comments.length === 0) {
      return NextResponse.json({ success: false, error: '선택된 댓글을 찾을 수 없습니다.' }, { status: 404 });
    }
    const userNameMap = await loadCommentUserNames(admin, comments);

    const feedbackList = comments
      .map((c, i) => `${i + 1}. ${userNameMap.get(c.user_id ?? '') ?? '익명'}: ${c.content}`)
      .join('\n');

    // 3. 현재 문서를 이전 버전으로 스냅샷 저장
    const versionedDoc = doc as VersionedDocumentRow;
    const { data: snapshot, error: snapshotError } = await admin
      .from('documents')
      .insert(buildSnapshotInsertPayload(versionedDoc))
      .select('id')
      .single();

    if (snapshotError) throw snapshotError;
    if (!snapshot) return NextResponse.json({ success: false, error: '버전 저장 실패' }, { status: 500 });

    // 4. AI로 댓글 반영 문서 재생성 — AI 에는 본문만 보내고, 입력값 주석은 결과 앞에 그대로 다시 붙인다
    //    (AI 가 주석을 빼거나 바꾸면 다운로드·입력값 편집이 깨지므로 AI 손에 맡기지 않는다)
    const rawPrefix = getEmbeddedInputsPrefix(doc.content);
    // 접두부가 줄바꿈 없이 끝난 옛 저장분이면 줄바꿈을 보장 — AI 출력 첫 줄이 주석 줄에 붙지 않게
    const inputsPrefix = rawPrefix && !rawPrefix.endsWith('\n') ? `${rawPrefix}\n` : rawPrefix;
    const prompt = `다음은 현재 문서 내용입니다:

---
${doc.content.slice(rawPrefix.length)}
---

아래 피드백을 반영하여 문서를 수정해주세요. 문서의 전체 구조와 형식은 유지하되, 피드백 내용만 정확히 반영해주세요.

피드백:
${feedbackList}

수정된 문서 전체 내용만 출력해주세요. 설명이나 주석은 포함하지 마세요.`;

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 12000,
    });

    const generated = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!generated) return NextResponse.json({ success: false, error: 'AI 생성 실패' }, { status: 500 });
    const newContent = inputsPrefix + generated;

    // 5. 현재 문서 content + version_number 업데이트
    const { updatePayload, nextVersionNumber } = buildCurrentDocumentUpdate(versionedDoc, newContent);
    const { error: updateError } = await admin.from('documents').update(updatePayload).eq('id', documentId);

    if (updateError) throw updateError;

    const { error: commentUpdateError } = await admin
      .from('document_comments')
      .update({
        status: 'applied',
        applied_at: new Date().toISOString(),
        applied_by: authUserId,
        applied_version_number: nextVersionNumber,
      })
      .in('id', selectedCommentIds);

    if (commentUpdateError) throw commentUpdateError;

    return NextResponse.json({
      success: true,
      newVersionNumber: nextVersionNumber,
      snapshotId: snapshot.id,
    });
  } catch (e) {
    console.error('[reflect]', e);
    return NextResponse.json({ success: false, error: '문서 반영 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
