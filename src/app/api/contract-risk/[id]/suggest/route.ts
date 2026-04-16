import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateEmbedding } from '@/lib/ai/embeddings';
import type { ContractRiskAnalysis, RiskItem } from '@/lib/types/contract-risk';
import type { SuggestionItem, LawChunk, SuggestRequest } from '@/lib/types/contract-suggest';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `당신은 한국 IT 계약 분야의 법률 검토 전문가입니다.
계약서의 불리하거나 누락된 조항을 수정하는 데 있어 한국 법령(민법, 하도급법 등)을 근거로
구체적이고 실무에서 바로 사용 가능한 수정 조항문을 작성합니다.

응답 형식 (JSON only):
{
  "revised": "수정 제안 조항 전문 (계약서에 바로 삽입 가능한 완전한 문장)",
  "reason": "수정 이유 (어떤 법령 조문을 근거로 어떻게 보호받는지 2~3문장)"
}

작성 기준:
- revised는 원문 조항을 대체할 수 있는 완전한 조항문으로 작성합니다.
- 제공된 법령 조문의 핵심 요건을 반영합니다.
- reason은 법령 조문명(조항 번호 포함)을 명시합니다.`;

async function suggestForItem(
  item: RiskItem,
  laws: (LawChunk & { similarity: number })[],
): Promise<{ revised: string; reason: string }> {
  const lawsText = laws
    .map(
      (l) =>
        `${l.law_name} ${l.article_no}${l.clause_no ? ' ' + l.clause_no : ''}: ${l.content}`,
    )
    .join('\n\n');

  const userPrompt = `[리스크 항목] ${item.id}

[원문 조항]
${item.excerpt || '(해당 조항이 계약서에 존재하지 않아 신규 추가가 필요합니다.)'}

[관련 법령 조문]
${lawsText || '(관련 법령 조문을 찾지 못했습니다. 일반적인 계약서 작성 원칙에 따라 수정 제안을 작성해주세요.)'}

위 정보를 바탕으로 수정 제안 조항과 이유를 JSON 형식으로 작성하세요.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as { revised?: string; reason?: string };
  return {
    revised: parsed.revised ?? '',
    reason: parsed.reason ?? '',
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'INVALID_REQUEST', message: '유효하지 않은 ID입니다.' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'SERVICE_UNAVAILABLE', message: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' }, { status: 401 });
  }

  let body: SuggestRequest;
  try {
    body = await request.json() as SuggestRequest;
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST', message: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  if (!body.item_keys || body.item_keys.length === 0) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: '수정 제안받을 항목을 선택해주세요.' },
      { status: 400 },
    );
  }

  const admin = createAdminSupabaseClient();

  // 분석 레코드 조회 + user_id 확인
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: analysis, error: analysisError } = await (admin as any)
    .from('contract_risk_analyses')
    .select('id, user_id, file_name, file_type, risk_result')
    .eq('id', id)
    .single() as { data: Pick<ContractRiskAnalysis, 'id' | 'user_id' | 'file_name' | 'file_type' | 'risk_result'> | null; error: unknown };

  if (analysisError || !analysis) {
    return NextResponse.json({ error: 'NOT_FOUND', message: '분석 결과를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (analysis.user_id !== userId) {
    return NextResponse.json({ error: 'NOT_FOUND', message: '분석 결과를 찾을 수 없습니다.' }, { status: 404 });
  }

  const allItems: RiskItem[] = (analysis.risk_result as ContractRiskAnalysis['risk_result']).items ?? [];
  const targetItems = allItems.filter((item) => body.item_keys.includes(item.id));

  if (targetItems.length === 0) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: '선택한 항목을 분석 결과에서 찾을 수 없습니다.' },
      { status: 400 },
    );
  }

  // 항목별 병렬 처리
  const results = await Promise.allSettled(
    targetItems.map(async (item): Promise<SuggestionItem> => {
      // 1. 임베딩 생성 (원문 발췌 or 항목 ID 사용)
      const queryText = item.excerpt || item.id;
      const embedding = await generateEmbedding(queryText.slice(0, 8000));

      // 2. pgvector 유사도 검색
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lawRows } = await (admin as any).rpc('match_law_chunks', {
        query_embedding: embedding,
        match_count: 3,
        filter_category: null,
      }) as { data: (LawChunk & { similarity: number })[] | null };

      const laws = (lawRows ?? []).filter((l) => (l.similarity ?? 0) >= 0.5);

      // 3. GPT-4o 수정 제안 생성
      const { revised, reason } = await suggestForItem(item, laws);

      return {
        item_key: item.id,
        item_name: item.id,  // RiskItem에 name 필드 없음 — ID 사용
        original: item.excerpt,
        laws,
        revised,
        reason,
      };
    }),
  );

  const suggestions: SuggestionItem[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      suggestions.push(result.value);
    } else {
      console.error('[suggest] item error:', result.reason);
      errors.push(String(result.reason));
    }
  }

  if (suggestions.length === 0) {
    return NextResponse.json(
      { error: 'AI_SUGGEST_FAILED', message: 'AI 수정 제안 생성 중 오류가 발생했습니다.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ suggestions, errors: errors.length > 0 ? errors : undefined });
}
