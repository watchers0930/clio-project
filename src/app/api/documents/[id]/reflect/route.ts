import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  try {
    const { id: documentId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: '서버 오류' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const body = await req.json();
    const selectedCommentIds: string[] = body.selectedCommentIds ?? [];
    if (selectedCommentIds.length === 0) {
      return NextResponse.json({ success: false, error: '반영할 댓글을 선택해주세요.' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    // 1. 현재 문서 조회
    const { data: doc } = await admin
      .from('documents')
      .select('id, title, content, status, parent_id, version_number, created_by, storage_path')
      .eq('id', documentId)
      .single();

    if (!doc) return NextResponse.json({ success: false, error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    if (!doc.content) return NextResponse.json({ success: false, error: '문서 내용이 없습니다.' }, { status: 400 });

    // 2. 선택된 댓글 조회
    const { data: comments } = await admin
      .from('document_comments')
      .select('content, users:user_id(name)')
      .in('id', selectedCommentIds);

    if (!comments || comments.length === 0) {
      return NextResponse.json({ success: false, error: '선택된 댓글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const feedbackList = comments
      .map((c, i) => `${i + 1}. ${(c.users as { name: string } | null)?.name ?? '익명'}: ${c.content}`)
      .join('\n');

    // 3. 현재 문서를 이전 버전으로 스냅샷 저장
    const currentVersionNumber = doc.version_number ?? 1;
    const rootId = doc.parent_id ?? documentId;

    const { data: snapshot } = await admin
      .from('documents')
      .insert({
        title: doc.title,
        content: doc.content,
        status: 'completed',
        parent_id: rootId,
        version_number: currentVersionNumber,
        created_by: doc.created_by,
        storage_path: doc.storage_path ?? null,
      })
      .select('id')
      .single();

    if (!snapshot) return NextResponse.json({ success: false, error: '버전 저장 실패' }, { status: 500 });

    // 4. AI로 댓글 반영 문서 재생성
    const prompt = `다음은 현재 문서 내용입니다:

---
${doc.content}
---

아래 피드백을 반영하여 문서를 수정해주세요. 문서의 전체 구조와 형식은 유지하되, 피드백 내용만 정확히 반영해주세요.

피드백:
${feedbackList}

수정된 문서 전체 내용만 출력해주세요. 설명이나 주석은 포함하지 마세요.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 12000,
    });

    const newContent = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!newContent) return NextResponse.json({ success: false, error: 'AI 생성 실패' }, { status: 500 });

    // 5. 현재 문서 content + version_number 업데이트
    const { error: updateError } = await admin
      .from('documents')
      .update({
        content: newContent,
        version_number: currentVersionNumber + 1,
        parent_id: rootId === documentId ? null : rootId,
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      newVersionNumber: currentVersionNumber + 1,
      snapshotId: snapshot.id,
    });
  } catch (e) {
    console.error('[reflect]', e);
    return NextResponse.json({ success: false, error: '문서 반영 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
