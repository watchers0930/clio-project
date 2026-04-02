/**
 * AI 문서 생성 엔진 — 멀티포맷 지원
 * 템플릿 + 양식파일 + 소스 파일 청크 + 지시사항 → GPT-4o → 포맷별 결과
 *
 * 아키텍처:
 *  - AI(콘텐츠 생성) ↔ 렌더러(파일 변환)를 분리
 *  - DOCX/PDF/HWPX → 마크다운 출력
 *  - XLSX → ExcelSheet[] JSON 출력
 *  - PPTX → PptxSlide[] JSON 출력
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { OutputFormat, ExcelSheet, PptxSlide, GenerationResult } from '@/lib/renderers/types';

const MAX_CONTEXT_CHARS = 60_000;
const MAX_TEMPLATE_FILE_CHARS = 30_000;

// ─── 기존 마크다운 생성 (DOCX/PDF/HWPX 공용) ───────────────

export async function generateDocumentContent(params: {
  templateName: string;
  templateContent?: string | null;
  templateFileText?: string | null;
  sourceChunks: string[];
  instructions?: string;
}): Promise<string> {
  const { templateName, templateContent, templateFileText, sourceChunks, instructions } = params;

  let trimmedTemplateFileText = templateFileText ?? null;
  if (trimmedTemplateFileText && trimmedTemplateFileText.length > MAX_TEMPLATE_FILE_CHARS) {
    trimmedTemplateFileText = trimmedTemplateFileText.slice(0, MAX_TEMPLATE_FILE_CHARS) + '\n...(이하 생략)';
  }

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

// ─── XLSX용: AI가 구조화 JSON 반환 ──────────────────────────

export async function generateExcelContent(params: {
  templateName: string;
  sourceChunks: string[];
  instructions?: string;
}): Promise<ExcelSheet[]> {
  const { templateName, sourceChunks, instructions } = params;

  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > MAX_CONTEXT_CHARS) break;
    contextText += chunk + '\n---\n';
  }

  const systemPrompt = `당신은 데이터 분석 및 Excel 보고서 작성 전문 AI입니다. 한국어로 작성합니다.

## 출력 형식
반드시 아래 JSON 배열 형식으로만 출력하세요. 다른 텍스트는 포함하지 마세요.

\`\`\`json
[
  {
    "sheetName": "시트이름",
    "headers": ["컬럼1", "컬럼2", "컬럼3"],
    "rows": [
      ["값1", "값2", 123],
      ["값3", "값4", 456]
    ]
  }
]
\`\`\`

## 규칙
1. 참조 자료의 수치 데이터를 분석하여 체계적인 테이블로 구성합니다.
2. 숫자는 number 타입, 텍스트는 string 타입으로 구분합니다.
3. 필요시 요약/합계 시트를 추가합니다.
4. 시트가 여러 개 필요하면 배열에 추가합니다.`;

  const userPrompt = `## 작성할 Excel: ${templateName}

## 참조 자료:
${contextText || '(참조 자료 없음)'}

${instructions ? `## 지시사항:\n${instructions}\n\n` : ''}
위 참조 자료를 분석하여 "${templateName}" Excel 보고서를 JSON 배열 형식으로 생성하세요.`;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 8000,
    temperature: 0.2,
  });

  return parseJsonResponse<ExcelSheet[]>(text, []);
}

// ─── PPTX용: AI가 슬라이드 JSON 반환 ────────────────────────

export async function generatePptxContent(params: {
  templateName: string;
  sourceChunks: string[];
  instructions?: string;
}): Promise<PptxSlide[]> {
  const { templateName, sourceChunks, instructions } = params;

  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > MAX_CONTEXT_CHARS) break;
    contextText += chunk + '\n---\n';
  }

  const systemPrompt = `당신은 프레젠테이션 전문 AI입니다. 한국어로 작성합니다.

## 출력 형식
반드시 아래 JSON 배열 형식으로만 출력하세요. 다른 텍스트는 포함하지 마세요.

\`\`\`json
[
  {
    "title": "슬라이드 제목",
    "body": "본문 설명 (선택)",
    "bullets": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"]
  }
]
\`\`\`

## 규칙
1. 슬라이드는 5~15개로 구성합니다.
2. 각 슬라이드의 title은 간결하게 (15자 이내)
3. body는 1~2문장으로 핵심 설명
4. bullets는 3~5개, 각 항목 30자 이내
5. 첫 슬라이드는 개요/목차, 마지막은 결론/요약
6. 데이터가 있으면 핵심 수치를 포함합니다.`;

  const userPrompt = `## 작성할 프레젠테이션: ${templateName}

## 참조 자료:
${contextText || '(참조 자료 없음)'}

${instructions ? `## 지시사항:\n${instructions}\n\n` : ''}
위 참조 자료를 분석하여 "${templateName}" 프레젠테이션 슬라이드를 JSON 배열 형식으로 생성하세요.`;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 6000,
    temperature: 0.3,
  });

  return parseJsonResponse<PptxSlide[]>(text, []);
}

// ─── 통합 생성 엔진 ─────────────────────────────────────────

export async function generateForFormat(params: {
  format: OutputFormat;
  templateName: string;
  templateContent?: string | null;
  templateFileText?: string | null;
  sourceChunks: string[];
  instructions?: string;
}): Promise<GenerationResult> {
  const { format, templateName, ...rest } = params;
  const title = templateName;

  switch (format) {
    case 'xlsx': {
      const excelSheets = await generateExcelContent({
        templateName,
        sourceChunks: rest.sourceChunks,
        instructions: rest.instructions,
      });
      return { format, title, excelSheets };
    }

    case 'pptx': {
      const pptxSlides = await generatePptxContent({
        templateName,
        sourceChunks: rest.sourceChunks,
        instructions: rest.instructions,
      });
      return { format, title, pptxSlides };
    }

    case 'docx':
    case 'pdf':
    case 'hwpx': {
      const markdown = await generateDocumentContent({
        templateName,
        templateContent: rest.templateContent,
        templateFileText: rest.templateFileText,
        sourceChunks: rest.sourceChunks,
        instructions: rest.instructions,
      });
      return { format, title, markdown };
    }

    default:
      throw new Error(`지원하지 않는 출력 포맷: ${format}`);
  }
}

// ─── JSON 파싱 유틸 ──────────────────────────────────────────

function parseJsonResponse<T>(text: string, fallback: T): T {
  // ```json ... ``` 블록 추출
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    // JSON 배열 부분만 추출 시도
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as T;
      } catch {
        console.error('[generateDocument] JSON 파싱 실패:', jsonStr.slice(0, 200));
        return fallback;
      }
    }
    console.error('[generateDocument] JSON 파싱 실패:', jsonStr.slice(0, 200));
    return fallback;
  }
}
