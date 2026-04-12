/**
 * AI 만료일 추출 유틸
 * GPT-4o로 문서 텍스트에서 만료일/계약기간을 추출한다.
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { ExpiryExtractResult } from '@/types/expiry';

/** 텍스트 최대 길이 (토큰 절감: 앞 8,000자만 사용) */
const MAX_CHARS = 8000;

const SYSTEM_PROMPT = `당신은 계약서 및 법무 문서에서 만료일을 추출하는 전문가입니다.
주어진 문서 텍스트에서 만료일(계약 종료일, 유효기간 종료일, 라이선스 만료일 등)을 찾아 JSON으로 반환하세요.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "expiry_date": "YYYY-MM-DD 형식의 만료일, 없으면 null",
  "contract_period": "YYYY-MM-DD ~ YYYY-MM-DD 형식의 계약기간, 없으면 null",
  "document_type": "감지된 문서 유형 (예: 시스템구축계약서, 유지보수계약서, 소프트웨어라이선스, 보안서약서, 기타)",
  "confidence": "high(명시적 날짜 발견) | low(날짜는 있지만 만료일인지 불확실) | none(만료일 없거나 추출 불가)",
  "reason": "추출 근거 또는 실패 이유를 간략히 설명"
}

판단 기준:
- confidence: high → 계약 종료일, 만료일, 유효기간 종료일이 명시된 경우
- confidence: low → 날짜는 있지만 만료일 여부가 불확실한 경우
- confidence: none → 날짜 관련 정보가 없거나 추출 불가한 경우
- expiry_date와 contract_period가 모두 있으면 contract_period 종료일을 expiry_date로 설정`;

export async function extractExpiryFromText(
  text: string,
): Promise<ExpiryExtractResult> {
  const truncated = text.slice(0, MAX_CHARS);

  try {
    const { text: responseText } = await generateText({
      model: openai('gpt-4o'),
      system: SYSTEM_PROMPT,
      prompt: `다음 문서 텍스트에서 만료일을 추출하세요:\n\n${truncated}`,
      maxOutputTokens: 500,
      temperature: 0.1,
    });

    const cleaned = responseText.replace(/```json\n?|```/g, '').trim();
    const result = JSON.parse(cleaned) as ExpiryExtractResult;

    // 날짜 형식 검증
    if (result.expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(result.expiry_date)) {
      result.expiry_date = null;
      result.confidence = 'low';
    }

    return result;
  } catch {
    return {
      expiry_date: null,
      contract_period: null,
      document_type: '불명확',
      confidence: 'none',
      reason: '만료일 추출 중 오류가 발생했습니다.',
    };
  }
}
