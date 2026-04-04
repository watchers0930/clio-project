/**
 * POST /api/documents/[id]/design-prompt
 * 제안서 문서 → AI 디자인 플랫폼용 프롬프트 생성 (국문/영문)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
  }

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  // 문서 조회
  const { data: doc } = await supabase
    .from('documents')
    .select('id, title, content, template_id')
    .eq('id', id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
  }

  // 템플릿 이름 조회
  let templateName = '';
  if (doc.template_id) {
    const { data: tmpl } = await supabase
      .from('templates')
      .select('name')
      .eq('id', doc.template_id)
      .single();
    templateName = tmpl?.name ?? '';
  }

  // 제안서가 아니면 거부
  if (templateName !== '제안서') {
    return NextResponse.json({ error: '제안서 문서만 디자인 프롬프트를 생성할 수 있습니다.' }, { status: 400 });
  }

  const content = doc.content ?? '';
  const title = doc.title ?? '제안서';
  const body = await request.json().catch(() => ({}));
  const lang = body.lang === 'en' ? 'en' : 'ko';

  const systemPrompt = lang === 'ko'
    ? `당신은 AI 디자인 플랫폼(GenSpark, Gamma, Canva AI, Beautiful.ai 등)에서 바로 사용할 수 있는 프레젠테이션/제안서 생성 프롬프트를 작성하는 전문가입니다.

규칙:
- 입력된 제안서 내용을 기반으로, AI 디자인 플랫폼에 붙여넣기만 하면 즉시 고품질 프레젠테이션을 생성할 수 있는 프롬프트를 작성하세요.
- 슬라이드 구성, 디자인 톤, 색상 방향, 핵심 내용을 포함하세요.
- 문서의 모든 섹션을 빠짐없이 슬라이드로 변환하세요.
- 프로페셔널하고 세련된 비즈니스 프레젠테이션 스타일을 지정하세요.
- 출력은 순수 프롬프트 텍스트만 (설명이나 주석 없이).`
    : `You are an expert at writing prompts for AI design platforms (GenSpark, Gamma, Canva AI, Beautiful.ai, etc.) to generate high-quality presentations.

Rules:
- Based on the proposal content provided, write a prompt that can be directly pasted into an AI design platform to instantly generate a professional presentation.
- Include slide structure, design tone, color direction, and key content.
- Convert every section of the document into slides without omission.
- Specify a professional, sleek business presentation style.
- Output only the pure prompt text (no explanations or comments).`;

  const userPrompt = lang === 'ko'
    ? `아래 제안서를 기반으로 AI 디자인 플랫폼용 프레젠테이션 생성 프롬프트를 작성해주세요.

제목: ${title}

---
${content}
---`
    : `Based on the proposal below, write a presentation generation prompt for an AI design platform.

Title: ${title}

---
${content}
---`;

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 4000,
    temperature: 0.7,
  });

  return NextResponse.json({ prompt: text, lang });
}
