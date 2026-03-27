/**
 * AI 문서 생성 엔진
 * 템플릿 + 소스 파일 청크 + 사용자 지시 → GPT-4o → 완성 문서
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const MAX_CONTEXT_CHARS = 30_000;

export async function generateDocumentContent(params: {
  templateName: string;
  templateContent?: string | null;
  sourceChunks: string[];
  instructions?: string;
}): Promise<string> {
  const { templateName, templateContent, sourceChunks, instructions } = params;

  // 소스 청크를 컨텍스트 제한 내로 자르기
  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > MAX_CONTEXT_CHARS) break;
    contextText += chunk + '\n---\n';
  }

  const systemPrompt = `당신은 전문 문서 작성 AI입니다. 한국어로 작성하세요.
주어진 참조 자료를 분석하여 지정된 템플릿 형식에 맞는 완성도 높은 문서를 작성합니다.
마크다운 형식으로 출력하세요. 실질적인 내용으로 채워주세요.`;

  const userPrompt = `## 작성할 문서: ${templateName}

${templateContent ? `## 템플릿 구조:\n${templateContent}\n` : ''}
## 참조 자료 (소스 파일에서 추출):
${contextText || '(참조 자료 없음 - 일반적인 형식으로 작성)'}

${instructions ? `## 추가 지시사항:\n${instructions}` : ''}

위 참조 자료를 바탕으로 "${templateName}" 문서를 완성해주세요.`;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 4000,
    temperature: 0.3,
  });

  return text;
}
