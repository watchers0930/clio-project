import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { parseTemplateBundle } from '@/lib/templates/template-schema';
import { generateDocumentContent } from '@/lib/ai/generate-document';
import { embedDocument } from '@/lib/ai/embed-document';
import { resolveVersionFields } from '@/app/api/generate/route-helpers';

export const maxDuration = 60;

function formatErrorDetail(error: unknown) {
  if (!error || typeof error !== 'object') return '알 수 없는 오류';
  const maybeError = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };
  return [maybeError.message, maybeError.code, maybeError.details, maybeError.hint].filter(Boolean).join(' | ') || '알 수 없는 오류';
}

interface MemoRow {
  id: string;
  title: string;
  content: string | null;
  created_by: string;
}

interface ProposalPlan {
  title: string;
  subtitle: string;
  background: string;
  proposal: string;
  expectedEffects: string;
  budgetTimeline: string;
  referenceNotes: string;
  generationGuide: string;
}

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

async function buildProposalPlan(memos: MemoRow[]): Promise<ProposalPlan> {
  const fallbackTitle = memos.map((memo) => memo.title).slice(0, 2).join(' · ') || '메모 기반 제안서';
  const fallback: ProposalPlan = {
    title: `${fallbackTitle} 제안`,
    subtitle: '메모에서 정리한 내용을 바탕으로 자동 생성한 제안 초안',
    background: memos.map((memo) => `- ${memo.title}`).join('\n'),
    proposal: memos.map((memo) => `- ${memo.content?.trim() || memo.title}`).join('\n'),
    expectedEffects: '업무 정리, 의사결정 지원, 후속 실행 합의에 도움이 되도록 정리합니다.',
    budgetTimeline: '예산과 일정은 [확인필요] 기준으로 표기하고, 필요한 경우 후속 검토 항목으로 남깁니다.',
    referenceNotes: memos.map((memo) => `- ${memo.title}`).join('\n'),
    generationGuide: '선택된 메모들의 공통 주제를 중심으로 제안 배경, 핵심 제안, 기대 효과, 실행 계획이 드러나게 작성합니다.',
  };

  const openai = getOpenAI();
  if (!openai) return fallback;

  const memoContext = memos
    .map((memo, index) => [
      `${index + 1}. 제목: ${memo.title}`,
      memo.content?.trim() ? `내용: ${memo.content.trim()}` : '내용: (없음)',
    ].join('\n'))
    .join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1200,
      messages: [
        {
          role: 'system',
          content: [
            '당신은 여러 개의 메모를 하나의 제안 보고서 초안으로 구조화하는 한국어 비즈니스 문서 전략가입니다.',
            '반드시 JSON 객체만 반환하세요.',
            '키는 title, subtitle, background, proposal, expectedEffects, budgetTimeline, referenceNotes, generationGuide 입니다.',
            'title은 30자 내외의 제안서 제목으로, subtitle은 40자 내외의 부제목으로 작성합니다.',
            '각 본문 필드는 최종 제안서 초안에 넣을 수 있는 실무형 문장으로 작성합니다.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `아래 메모 묶음을 바탕으로 제안 보고서용 구조화 내용을 작성하세요.\n\n${memoContext}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ProposalPlan>;

    return {
      title: parsed.title?.trim() || fallback.title,
      subtitle: parsed.subtitle?.trim() || fallback.subtitle,
      background: parsed.background?.trim() || fallback.background,
      proposal: parsed.proposal?.trim() || fallback.proposal,
      expectedEffects: parsed.expectedEffects?.trim() || fallback.expectedEffects,
      budgetTimeline: parsed.budgetTimeline?.trim() || fallback.budgetTimeline,
      referenceNotes: parsed.referenceNotes?.trim() || fallback.referenceNotes,
      generationGuide: parsed.generationGuide?.trim() || fallback.generationGuide,
    };
  } catch {
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }
    const admin = createAdminSupabaseClient();

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json() as { memoIds?: string[] };
    const memoIds = Array.isArray(body.memoIds) ? body.memoIds.filter(Boolean) : [];
    if (memoIds.length < 2) {
      return NextResponse.json({ success: false, error: '메모를 2개 이상 선택해주세요.' }, { status: 400 });
    }

    const { data: memosRaw, error: memosError } = await supabase
      .from('memos')
      .select('id, title, content, created_by')
      .in('id', memoIds);

    if (memosError) {
      return NextResponse.json({ success: false, error: '메모 조회에 실패했습니다.' }, { status: 500 });
    }

    const memos = ((memosRaw ?? []) as MemoRow[]).filter((memo) => memo.created_by === authUserId);
    if (memos.length < 2) {
      return NextResponse.json({ success: false, error: '선택한 메모를 사용할 수 없습니다.' }, { status: 403 });
    }

    const { data: authorInfo } = await supabase
      .from('users')
      .select('name')
      .eq('id', authUserId)
      .single();

    let { data: templateRow, error: templateError } = await admin
      .from('templates')
      .select('id, name, content, placeholders')
      .eq('name', '제안서')
      .limit(1)
      .maybeSingle();

    if (!templateRow && !templateError) {
      const fallbackTemplate = await admin
        .from('templates')
        .select('id, name, content, placeholders')
        .ilike('name', '%제안%')
        .limit(1)
        .maybeSingle();
      templateRow = fallbackTemplate.data;
      templateError = fallbackTemplate.error;
    }

    if (templateError || !templateRow) {
      console.error('[memos/proposal-report] template lookup failed:', formatErrorDetail(templateError));
      return NextResponse.json({ success: false, error: '제안서 템플릿을 찾을 수 없습니다.' }, { status: 500 });
    }

    const templateBundle = parseTemplateBundle(templateRow.content, {
      name: templateRow.name,
      placeholders: templateRow.placeholders,
    });

    const proposalPlan = await buildProposalPlan(memos);
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const documentInputs = {
      report_title: proposalPlan.title,
      subtitle: proposalPlan.subtitle,
      author: authorInfo?.name ?? '',
      report_date: dateStr,
    };

    const sourceChunks = memos.map((memo) => {
      const content = memo.content?.trim() ? memo.content.trim() : '(내용 없음)';
      return `메모 제목: ${memo.title}\n메모 내용:\n${content}`;
    });

    const instructions = [
      '이 문서는 선택된 메모들을 하나의 제안 보고서 형식으로 정리하는 목적입니다.',
      '',
      '제안서에 반드시 반영할 핵심 정리',
      `- 제안 배경: ${proposalPlan.background}`,
      `- 핵심 제안: ${proposalPlan.proposal}`,
      `- 기대 효과: ${proposalPlan.expectedEffects}`,
      `- 예산/일정: ${proposalPlan.budgetTimeline}`,
      `- 참고 메모 정리: ${proposalPlan.referenceNotes}`,
      '',
      `추가 작성 가이드: ${proposalPlan.generationGuide}`,
      '',
      '출력 규칙',
      '- 제안서 형식으로 바로 공유 가능한 수준의 초안으로 작성합니다.',
      '- 확인되지 않은 수치나 일정은 [확인필요]로 명시합니다.',
      '- 메모의 중복 표현은 정리하고, 공통된 제안 방향이 드러나게 작성합니다.',
    ].join('\n');

    const docContent = await generateDocumentContent({
      templateName: templateRow.name,
      templateContent: templateBundle.outline,
      templateBundle,
      sourceChunks,
      instructions,
      documentInputs,
    });

    const versionFields = await resolveVersionFields(supabase);

    const insertPayload = {
      title: `${proposalPlan.title} (${dateStr} 생성)`,
      content: docContent,
      template_id: templateRow.id,
      source_file_ids: [] as string[],
      instructions,
      status: 'draft',
      storage_path: null,
      created_by: authUserId,
      ...versionFields,
    };

    let { data: newDoc, error: insertError } = await admin
      .from('documents')
      .insert(insertPayload)
      .select('id, title, content')
      .single();

    if (insertError || !newDoc) {
      const fallbackPayload = {
        title: insertPayload.title,
        content: insertPayload.content,
        template_id: insertPayload.template_id,
        source_file_ids: insertPayload.source_file_ids,
        instructions: insertPayload.instructions,
        status: insertPayload.status,
        storage_path: null,
        created_by: insertPayload.created_by,
      };

      const fallbackResult = await admin
        .from('documents')
        .insert(fallbackPayload)
        .select('id, title, content')
        .single();

      if (!fallbackResult.error && fallbackResult.data) {
        newDoc = fallbackResult.data;
        insertError = null;
      } else {
        console.error('[memos/proposal-report] document fallback insert failed:', {
          error: formatErrorDetail(fallbackResult.error),
          title: fallbackPayload.title,
          templateId: fallbackPayload.template_id,
          createdBy: fallbackPayload.created_by,
        });
      }
    }

    if (insertError || !newDoc) {
      console.error('[memos/proposal-report] document insert failed:', {
        error: formatErrorDetail(insertError),
        title: insertPayload.title,
        templateId: insertPayload.template_id,
        createdBy: insertPayload.created_by,
        versionFields,
      });
      return NextResponse.json({ success: false, error: '제안 보고서 문서 저장에 실패했습니다.' }, { status: 500 });
    }

    await admin.from('audit_logs').insert({
      user_id: authUserId,
      action: 'document.create',
      target_type: 'document',
      target_id: newDoc.id,
      details: {
        title: newDoc.title,
        source: 'memo_proposal',
        memoIds: memos.map((memo) => memo.id),
      },
    }).then(() => {}, () => {});

    if (newDoc.content) {
      embedDocument(newDoc.id, newDoc.content).then(() => {}, () => {});
    }

    return NextResponse.json({
      success: true,
      document: {
        id: newDoc.id,
        title: newDoc.title,
        template: templateRow.name,
        createdAt: dateStr,
        status: '초안',
        sourceCount: 0,
        content: newDoc.content,
        originContext: 'memo_proposal',
      },
    });
  } catch (error) {
    console.error('[memos/proposal-report/POST]', error);
    return NextResponse.json({ success: false, error: '제안 보고서 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
