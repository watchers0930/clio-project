/**
 * POST /api/documents/[id]/ai-context
 * 제안서 문서 → 다른 AI 도구용 컨텍스트 텍스트 생성 (국문/영문)
 * OpenAI 토큰 미사용 — 정적 템플릿 기반
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

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

  const { data: doc } = await supabase
    .from('documents')
    .select('id, title, content, template_id, created_at')
    .eq('id', id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
  }

  let templateName = '';
  if (doc.template_id) {
    const { data: tmpl } = await supabase
      .from('templates')
      .select('name')
      .eq('id', doc.template_id)
      .single();
    templateName = tmpl?.name ?? '';
  }

  if (templateName !== '제안서') {
    return NextResponse.json({ error: '제안서 문서만 AI 컨텍스트를 생성할 수 있습니다.' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const lang = body.lang === 'en' ? 'en' : 'ko';

  const content = doc.content ?? '';
  const title = doc.title ?? '제안서';
  const createdAt = doc.created_at
    ? new Date(doc.created_at).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  let context: string;

  if (lang === 'ko') {
    context = `[AI 컨텍스트] 제안서 — ${title}

아래 내용을 참고하여 제안서를 작성해주세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
문서 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 제목: ${title}
- 생성일: ${createdAt}
- 유형: 제안서

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
제안서 내용
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
활용 지시사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
위 내용을 기반으로 전문적인 제안서를 작성해주세요.
- 핵심 내용을 유지하면서 구조를 개선하세요.
- 비즈니스에 적합한 전문적인 톤을 사용하세요.
- 필요한 경우 데이터와 근거를 보강하세요.
- 목차, 요약, 기대효과, 예산 등 제안서 필수 항목을 포함하세요.
- 시각적으로 구분이 쉬운 번호/항목 형태로 작성하세요.
`;
  } else {
    context = `[AI Context] Proposal — ${title}

Please create a professional proposal based on the following content.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Document Info
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Title: ${title}
- Created: ${createdAt}
- Type: Proposal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Proposal Content
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Instructions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Create a professional proposal based on the content above.
- Maintain key points while improving structure and clarity.
- Use a professional business tone throughout.
- Supplement with data, evidence, and specific metrics where needed.
- Include essential proposal sections: table of contents, executive summary, expected outcomes, budget, and timeline.
- Use numbered lists and clear headings for easy readability.
`;
  }

  const fileName = lang === 'ko'
    ? `${title}_AI컨텍스트_국문.txt`
    : `${title}_AI_Context_EN.txt`;

  return NextResponse.json({ context, lang, fileName });
}
