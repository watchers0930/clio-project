/**
 * AI 텍스트 요약 (회의록 등)
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export interface MeetingSummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
}

/** 회의 전사록을 구조화된 요약으로 변환 */
export async function summarizeTranscript(
  transcript: string,
): Promise<MeetingSummary> {
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: `당신은 전문 회의록 작성 AI입니다. 회의 내용을 분석하여 구조화된 요약을 생성합니다.
반드시 JSON 형식으로만 응답하세요.`,
    prompt: `다음은 회의 음성을 텍스트로 변환한 내용입니다:

${transcript.slice(0, 15000)}

다음 JSON 형식으로 정리하세요:
{
  "summary": "3-5문장의 회의 요약",
  "keyPoints": ["주요 논의사항 1", "주요 논의사항 2", ...],
  "actionItems": ["후속 조치 1 (담당자 포함)", "후속 조치 2", ...]
}`,
    maxTokens: 2000,
    temperature: 0.2,
  });

  try {
    const cleaned = text.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(cleaned) as MeetingSummary;
  } catch {
    return {
      summary: text.slice(0, 500),
      keyPoints: [],
      actionItems: [],
    };
  }
}

/** 일반 텍스트를 2문장으로 요약 (검색 결과 AI 요약용) */
export async function summarizeText(text: string): Promise<string> {
  const { text: summary } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `다음 내용을 한국어 2문장으로 간결하게 요약하세요:\n\n${text.slice(0, 3000)}`,
    maxTokens: 200,
    temperature: 0.2,
  });
  return summary;
}
