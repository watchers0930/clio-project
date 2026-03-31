/**
 * AI 문서 생성 엔진
 * 템플릿 + 양식파일 구조 + 소스 파일 청크 + 사용자 지시 → GPT-4o → 완성 문서
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const MAX_CONTEXT_CHARS = 30_000;

export async function generateDocumentContent(params: {
  templateName: string;
  templateContent?: string | null;
  templateFileText?: string | null;
  sourceChunks: string[];
  instructions?: string;
}): Promise<string> {
  const { templateName, templateContent, templateFileText, sourceChunks, instructions } = params;

  // 템플릿 양식 텍스트가 너무 길면 잘라서 사용
  const MAX_TEMPLATE_FILE_CHARS = 10_000;
  let trimmedTemplateFileText = templateFileText ?? null;
  if (trimmedTemplateFileText && trimmedTemplateFileText.length > MAX_TEMPLATE_FILE_CHARS) {
    trimmedTemplateFileText = trimmedTemplateFileText.slice(0, MAX_TEMPLATE_FILE_CHARS) + '\n...(이하 생략)';
  }

  // 소스 청크를 컨텍스트 제한 내로 자르기
  const templateFileLen = trimmedTemplateFileText?.length ?? 0;
  const maxSourceChars = Math.max(5000, MAX_CONTEXT_CHARS - templateFileLen);

  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > maxSourceChars) break;
    contextText += chunk + '\n---\n';
  }

  const systemPrompt = `당신은 전문 문서 작성 AI입니다. 한국어로 작성하세요.
주어진 참조 자료를 분석하여 지정된 템플릿 형식에 맞는 완성도 높은 문서를 작성합니다.
마크다운 형식으로 출력하세요. 실질적인 내용으로 채워주세요.
${trimmedTemplateFileText ? '\n중요: "표준양식 파일 구조"가 제공된 경우, 해당 양식의 섹션 구조, 항목 순서, 표 형식을 최대한 따라서 작성하세요. 양식에 있는 빈칸/플레이스홀더는 참조 자료를 바탕으로 실질적인 내용으로 채워주세요.' : ''}`;

  let userPrompt = `## 작성할 문서: ${templateName}\n\n`;

  // 템플릿 양식 파일 구조 (핵심 — 양식 형태 유지)
  if (trimmedTemplateFileText) {
    userPrompt += `## 표준양식 파일 구조 (이 형식을 따라서 작성):\n${trimmedTemplateFileText}\n\n`;
  }

  // 기존 템플릿 콘텐츠
  if (templateContent) {
    userPrompt += `## 템플릿 구조:\n${templateContent}\n\n`;
  }

  // 참조 자료
  userPrompt += `## 참조 자료 (소스 파일에서 추출):\n${contextText || '(참조 자료 없음 - 일반적인 형식으로 작성)'}\n\n`;

  // 추가 지시
  if (instructions) {
    userPrompt += `## 추가 지시사항:\n${instructions}\n\n`;
  }

  userPrompt += `위 참조 자료를 바탕으로 "${templateName}" 문서를 완성해주세요.${trimmedTemplateFileText ? ' 표준양식의 구조와 형식을 최대한 유지하세요.' : ''}`;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 4000,
    temperature: 0.3,
  });

  return text;
}
