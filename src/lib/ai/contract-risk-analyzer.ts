/**
 * 계약서 AI 리스크 분석 서비스
 * GPT-4o로 25개 항목 분석 → RiskResult 반환
 */

import OpenAI from 'openai';
import { CONTRACT_RISK_ITEMS } from '../contract-risk-items';
import type { RiskResult, RiskCount, ContractType, Perspective } from '../types/contract-risk';

const MAX_TEXT_CHARS = 60_000; // GPT-4o 안전 입력 한도 (약 15K 토큰)

// ────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const itemList = CONTRACT_RISK_ITEMS.map(item =>
    `- ${item.id} [${item.category}] ${item.name} (기본 리스크: ${item.default_risk_level}): ${item.description}`
  ).join('\n');

  return `당신은 대한민국 IT 업계 계약 전문 법률 검토자입니다.
아래 분석 항목 목록을 기준으로 제출된 계약서를 분석하고, 반드시 지정된 JSON 형식으로만 응답하십시오.

## 분석 항목 목록 (25개)

${itemList}

## 응답 형식 (JSON only)

{
  "items": [
    {
      "id": "<항목 ID, 예: A-02>",
      "found": <true | false — 해당 리스크가 계약서에서 탐지되었으면 true>,
      "risk_level": "<high | medium | low>",
      "excerpt": "<원문 발췌 최대 200자. 미탐지(found=false)이면 빈 문자열>",
      "explanation": "<왜 리스크인지 2~3문장. 미탐지이면 '해당 리스크가 탐지되지 않았습니다.'>",
      "recommendation": "<어떻게 대응할지 1~2문장. 미탐지이면 빈 문자열>"
    }
  ],
  "summary": "<전체 분석 결과 요약 2~3문장>"
}

## 규칙
- 반드시 25개 항목 전부 응답에 포함할 것 (found=false 항목 포함)
- found=true 항목에만 excerpt, explanation, recommendation 상세히 작성
- risk_level은 계약서 내용에 따라 기본값보다 높거나 낮게 조정 가능
- 원문 발췌는 실제 계약서 본문에서 인용할 것 (없으면 빈 문자열)
- 한국어로 응답`;
}

function buildUserPrompt(
  text: string,
  contractType: ContractType,
  perspective: Perspective,
): string {
  const contractTypeLabel = {
    system: '시스템구축계약서',
    maintenance: '유지보수계약서',
    software: '소프트웨어개발계약서',
    general: '용역계약서',
  }[contractType];

  const perspectiveLabel = perspective === 'seller_side' ? '을(공급자/수급인)' : '갑(발주자/도급인)';

  const truncated = text.length > MAX_TEXT_CHARS
    ? text.slice(0, MAX_TEXT_CHARS) + '\n\n[이하 텍스트 길이 초과로 생략]'
    : text;

  return `다음 계약서를 분석하십시오.

계약서 유형: ${contractTypeLabel}
분석 입장: ${perspectiveLabel} 관점으로 분석

--- 계약서 원문 시작 ---
${truncated}
--- 계약서 원문 끝 ---

JSON 형식으로 분석 결과를 반환하십시오.`;
}

// ────────────────────────────────────────────────────────────────────────────

export async function analyzeContractRisk(
  rawText: string,
  contractType: ContractType,
  perspective: Perspective,
): Promise<{ risk_result: RiskResult; risk_count: RiskCount }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');

  const openai = new OpenAI({ apiKey });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000); // 55초 타임아웃

  let parsed: RiskResult;
  try {
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o',
        temperature: 0.2,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(rawText, contractType, perspective) },
        ],
      },
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const mayParsed = JSON.parse(raw) as Partial<RiskResult>;

    if (!Array.isArray(mayParsed.items)) {
      throw new Error('GPT-4o 응답 구조 불일치: items 배열 없음');
    }

    parsed = {
      items: mayParsed.items,
      summary: mayParsed.summary ?? '',
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }

  // risk_count 계산 (found=true 항목만)
  const risk_count: RiskCount = { high: 0, medium: 0, low: 0 };
  for (const item of parsed.items) {
    if (item.found) {
      if (item.risk_level === 'high') risk_count.high++;
      else if (item.risk_level === 'medium') risk_count.medium++;
      else if (item.risk_level === 'low') risk_count.low++;
    }
  }

  return { risk_result: parsed, risk_count };
}
