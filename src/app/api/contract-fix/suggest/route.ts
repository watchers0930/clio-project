/**
 * POST /api/contract-fix/suggest
 * 리스크 조항 + 법령 정보 → GPT-4o 수정 제안 생성
 * Body: {
 *   analysisId: string,
 *   clauseIndex: number,
 *   clauseTitle: string,
 *   clauseText: string,
 *   lawReferences: LawResult[],
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import OpenAI from 'openai';

export const maxDuration = 60;

interface LawResult {
  lawName: string;
  lawId: string;
  articleNo: string;
  articleContent: string;
  promulgationDate: string;
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI 서비스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  let body: {
    analysisId: string;
    clauseIndex: number;
    clauseTitle: string;
    clauseText: string;
    lawReferences: LawResult[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const { analysisId, clauseIndex, clauseTitle, clauseText, lawReferences } = body;
  if (!analysisId || !clauseTitle || !clauseText) {
    return NextResponse.json({ error: '필수 값이 누락됐습니다.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // 분석 레코드 소유권 확인
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: analysis } = await (admin as any)
    .from('contract_risk_analyses')
    .select('user_id, raw_text')
    .eq('id', analysisId)
    .single() as { data: { user_id: string; raw_text: string } | null };

  if (!analysis || analysis.user_id !== userId) {
    return NextResponse.json({ error: '분석 결과를 찾을 수 없습니다.' }, { status: 404 });
  }

  // GPT-4o 수정 제안
  const lawContext = lawReferences.length > 0
    ? lawReferences.map(l =>
        `[${l.lawName}${l.articleNo ? ` 제${l.articleNo}조` : ''}]\n${l.articleContent || '(조문 내용 없음)'}`
      ).join('\n\n')
    : '(참조 법령 없음)';

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let suggestedFix = '';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content: `당신은 대한민국 계약 전문 법률 자문 AI입니다.
위험한 계약 조항을 법령에 근거하여 공급자(을)에게 유리하게 수정하는 문구를 제안합니다.
수정 제안은 실제 계약서에 바로 사용할 수 있는 완성된 문장으로 작성하세요.

⚠️ 주의: 이 제안은 법률 전문가의 검토를 대체하지 않습니다. 중요한 계약은 반드시 법률 전문가와 상담하세요.`,
        },
        {
          role: 'user',
          content: `## 위험 조항 정보
- 조항 유형: ${clauseTitle}
- 원문 내용: ${clauseText.slice(0, 3000)}

## 관련 법령
${lawContext}

## 요청
위 원문 조항을 관련 법령에 근거하여 수정해 주세요.
다음 형식으로 응답해 주세요:

**문제점**: (원문의 어떤 부분이 왜 위험한지 1-2문장)

**수정 제안**: (실제 계약서에 쓸 수 있는 완성된 수정 문구)

**근거**: (어떤 법령 조항에 근거했는지 간략히)`,
        },
      ],
    });

    suggestedFix = completion.choices[0].message.content ?? '';
  } catch (err) {
    console.error('[contract-fix/suggest] GPT error:', err);
    return NextResponse.json({ error: 'AI 수정 제안 생성에 실패했습니다.' }, { status: 502 });
  }

  // DB 저장 (upsert: 같은 analysisId + clauseIndex면 업데이트)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fix, error: upsertError } = await (admin as any)
    .from('contract_clause_fixes')
    .upsert({
      analysis_id: analysisId,
      user_id: userId,
      clause_index: clauseIndex,
      clause_title: clauseTitle,
      clause_text: clauseText.slice(0, 10000),
      law_references: lawReferences,
      suggested_fix: suggestedFix,
      status: 'pending',
    }, { onConflict: 'analysis_id,clause_index' })
    .select('id')
    .single() as { data: { id: string } | null; error: unknown };

  if (upsertError || !fix) {
    console.error('[contract-fix/suggest] upsert error:', upsertError);
    return NextResponse.json({ error: '수정 제안 저장에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ fixId: fix.id, suggestedFix });
}
