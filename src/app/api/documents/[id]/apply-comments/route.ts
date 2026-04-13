import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { extractSectionContent, replaceSectionContent } from '@/lib/utils/parse-sections';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/documents/[id]/apply-comments
 * 선택된 댓글을 원문에 합치기
 *
 * body (모드 1 - 기존 섹션에 삽입):
 *   { mode: 'insert', selectedCommentIds: string[], targetSection: string }
 *
 * body (모드 2 - 새 단락 생성):
 *   { mode: 'append', selectedCommentIds: string[], newSectionTitle: string }
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
    const { mode, selectedCommentIds } = body as {
      mode: 'insert' | 'append';
      selectedCommentIds: string[];
      targetSection?: string;
      newSectionTitle?: string;
    };

    if (!selectedCommentIds || selectedCommentIds.length === 0) {
      return NextResponse.json({ success: false, error: '반영할 댓글을 선택해주세요.' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    // 문서 조회
    const { data: doc } = await admin
      .from('documents')
      .select('id, title, content, status, parent_id, version_number, created_by, storage_path')
      .eq('id', documentId)
      .single();

    if (!doc) return NextResponse.json({ success: false, error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    if (!doc.content) return NextResponse.json({ success: false, error: '문서 내용이 없습니다.' }, { status: 400 });

    // 적용 전 현재 버전 스냅샷 저장
    const currentVersionNumber = doc.version_number ?? 1;
    const rootId = doc.parent_id ?? documentId;

    await admin.from('documents').insert({
      title: doc.title,
      content: doc.content,
      status: 'completed',
      parent_id: rootId,
      version_number: currentVersionNumber,
      created_by: doc.created_by,
      storage_path: doc.storage_path ?? null,
    });

    // 선택된 댓글 조회
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

    let updatedContent: string;

    // ── 모드 1: 기존 섹션에 삽입 ──
    if (mode === 'insert') {
      const targetSection = body.targetSection as string;
      if (!targetSection) {
        return NextResponse.json({ success: false, error: '대상 섹션을 선택해주세요.' }, { status: 400 });
      }

      const currentSectionContent = extractSectionContent(doc.content, targetSection);

      const prompt = currentSectionContent
        ? `현재 섹션 내용:
---
${currentSectionContent}
---

아래 의견/댓글을 위 섹션에 자연스럽게 통합해주세요.
기존 내용의 구조와 문체를 유지하면서 내용만 추가/보완하세요.

의견:
${feedbackList}

작성 규칙:
- '첫째', '둘째', '셋째', '넷째', '다섯째', '마지막으로' 등 순서 표현은 반드시 새 줄에서 시작하세요.
- 항목이 여럿일 경우 각 항목 사이에 빈 줄 없이 줄바꿈(\n)으로 구분하세요.

수정된 섹션 내용만 출력하세요. 섹션 헤더(## 등)는 포함하지 마세요.`
        : `아래 의견/댓글을 바탕으로 '${targetSection}' 섹션 내용을 작성해주세요.
핵심 내용을 구조적으로 정리하고, 실무 문서 형식으로 작성하세요.

의견:
${feedbackList}

작성 규칙:
- '첫째', '둘째', '셋째', '넷째', '다섯째', '마지막으로' 등 순서 표현은 반드시 새 줄에서 시작하세요.
- 항목이 여럿일 경우 각 항목 사이에 빈 줄 없이 줄바꿈(\n)으로 구분하세요.

섹션 내용만 출력하세요. 헤더(## 등)는 포함하지 마세요.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const newSectionContent = completion.choices[0]?.message?.content?.trim() ?? '';
      if (!newSectionContent) return NextResponse.json({ success: false, error: 'AI 생성 실패' }, { status: 500 });

      // 섹션이 없는 경우(HWPX 등) 새 섹션으로 추가
      if (!currentSectionContent) {
        updatedContent = `${doc.content}\n\n## ${targetSection}\n\n${newSectionContent}`;
      } else {
        updatedContent = replaceSectionContent(doc.content, targetSection, newSectionContent);
      }
    }
    // ── 모드 2: 새 단락 생성 ──
    else if (mode === 'append') {
      const newSectionTitle = body.newSectionTitle as string;
      if (!newSectionTitle?.trim()) {
        return NextResponse.json({ success: false, error: '새 단락 이름을 입력해주세요.' }, { status: 400 });
      }

      const prompt = `아래 의견/댓글들을 바탕으로 '${newSectionTitle}' 단락을 작성해주세요.
핵심 내용을 구조적으로 정리하고, 실무 문서 형식으로 작성하세요.

의견:
${feedbackList}

작성 규칙:
- '첫째', '둘째', '셋째', '넷째', '다섯째', '마지막으로' 등 순서 표현은 반드시 새 줄에서 시작하세요.
- 항목이 여럿일 경우 각 항목 사이에 빈 줄 없이 줄바꿈(\n)으로 구분하세요.

단락 내용만 출력하세요. 헤더(## 등)는 포함하지 마세요.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const newSectionContent = completion.choices[0]?.message?.content?.trim() ?? '';
      if (!newSectionContent) return NextResponse.json({ success: false, error: 'AI 생성 실패' }, { status: 500 });

      updatedContent = `${doc.content}\n\n## ${newSectionTitle}\n\n${newSectionContent}`;
    } else {
      return NextResponse.json({ success: false, error: '유효하지 않은 모드입니다.' }, { status: 400 });
    }

    // 문서 content + version_number 업데이트
    const { error: updateError } = await admin
      .from('documents')
      .update({
        content: updatedContent,
        version_number: currentVersionNumber + 1,
        parent_id: rootId === documentId ? null : rootId,
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, updatedContent });
  } catch (e) {
    console.error('[apply-comments]', e);
    return NextResponse.json({ success: false, error: '댓글 반영 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
