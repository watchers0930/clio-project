/**
 * AI 문서 생성 엔진
 * 템플릿 + 양식파일 구조 + 소스 파일 청크 + 사용자 지시 → GPT-4o → 완성 문서
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const MAX_CONTEXT_CHARS = 60_000;

export async function generateDocumentContent(params: {
  templateName: string;
  templateContent?: string | null;
  templateFileText?: string | null;
  sourceChunks: string[];
  instructions?: string;
}): Promise<string> {
  const { templateName, templateContent, templateFileText, sourceChunks, instructions } = params;

  // 템플릿 양식 전체 사용 (최대 30,000자)
  const MAX_TEMPLATE_FILE_CHARS = 30_000;
  let trimmedTemplateFileText = templateFileText ?? null;
  if (trimmedTemplateFileText && trimmedTemplateFileText.length > MAX_TEMPLATE_FILE_CHARS) {
    trimmedTemplateFileText = trimmedTemplateFileText.slice(0, MAX_TEMPLATE_FILE_CHARS) + '\n...(이하 생략)';
  }

  // 소스 청크를 컨텍스트 제한 내로
  const templateFileLen = trimmedTemplateFileText?.length ?? 0;
  const maxSourceChars = Math.max(5000, MAX_CONTEXT_CHARS - templateFileLen);

  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > maxSourceChars) break;
    contextText += chunk + '\n---\n';
  }

  const hasTemplate = !!trimmedTemplateFileText;

  const systemPrompt = hasTemplate
    ? `당신은 계약서/공문서 작성 전문 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
1. 제공된 "표준양식"의 전체 구조를 그대로 복사합니다.
2. 양식의 모든 조항(제1조, 제2조...), 항목 번호, 표, 서식을 빠짐없이 유지합니다.
3. 빈칸, 괄호, 플레이스홀더(_____, ( ), 년 월 일 등)만 참조 자료와 지시사항의 실제 값으로 채웁니다.
4. 양식에 없는 내용을 임의로 추가하지 않습니다.
5. 참조 자료에서 값을 찾을 수 없는 빈칸은 [미정] 또는 [확인필요]로 표시합니다.
6. 마크다운 형식으로 출력합니다.`
    : `당신은 전문 문서 작성 AI입니다. 한국어로 작성하세요.
주어진 참조 자료를 분석하여 완성도 높은 문서를 마크다운 형식으로 작성합니다.`;

  let userPrompt = `## 작성할 문서: ${templateName}\n\n`;

  if (trimmedTemplateFileText) {
    userPrompt += `## ★ 표준양식 (이 양식의 구조를 그대로 유지하고 빈칸만 채우세요):\n\n${trimmedTemplateFileText}\n\n`;
  }

  if (templateContent) {
    userPrompt += `## 템플릿 메타정보:\n${templateContent}\n\n`;
  }

  userPrompt += `## 참조 자료 (빈칸을 채울 때 참고):\n${contextText || '(참조 자료 없음)'}\n\n`;

  if (instructions) {
    userPrompt += `## 지시사항 (이 정보로 빈칸을 채우세요):\n${instructions}\n\n`;
  }

  if (hasTemplate) {
    userPrompt += `위 표준양식의 구조를 그대로 유지하면서, 참조 자료와 지시사항의 정보로 빈칸을 채워 완성된 "${templateName}" 문서를 출력하세요. 양식의 조항이나 구조를 생략하지 마세요.`;
  } else {
    userPrompt += `위 참조 자료를 바탕으로 "${templateName}" 문서를 완성해주세요.`;
  }

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 12000,
    temperature: 0.2,
  });

  return text;
}
