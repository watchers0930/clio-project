// Excel/PPT 출력용 AI 콘텐츠 생성 — 신규 생성(시트·슬라이드)과 기존 양식 채우기(셀·텍스트 치환)
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { ExcelSheet, ExcelCellData, PptxSlide, PptxReplacement } from '@/lib/renderers/types';
import { MAX_TEMPLATE_FILE_CHARS, buildContextText, parseJsonResponse } from './generate-shared';

export async function generateExcelContent(params: {
  templateName: string;
  sourceChunks: string[];
  instructions?: string;
}): Promise<ExcelSheet[]> {
  const { templateName, sourceChunks, instructions } = params;
  const contextText = buildContextText(sourceChunks);
  const systemPrompt = `당신은 데이터 분석 보고서 작성 전문 AI입니다. 한국어로 작성합니다.

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

${instructions ? `## 지시사항:\n${instructions}\n\n` : ''}위 참조 자료를 분석하여 "${templateName}" Excel 보고서를 JSON 배열 형식으로 생성하세요.`;

  const { text } = await generateText({ model: openai('gpt-4o'), system: systemPrompt, prompt: userPrompt, maxOutputTokens: 8000, temperature: 0.2 });
  return parseJsonResponse<ExcelSheet[]>(text, []);
}

export async function generatePptxContent(params: {
  templateName: string;
  sourceChunks: string[];
  instructions?: string;
}): Promise<PptxSlide[]> {
  const { templateName, sourceChunks, instructions } = params;
  const contextText = buildContextText(sourceChunks);
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

${instructions ? `## 지시사항:\n${instructions}\n\n` : ''}위 참조 자료를 분석하여 "${templateName}" 프레젠테이션 슬라이드를 JSON 배열 형식으로 생성하세요.`;

  const { text } = await generateText({ model: openai('gpt-4o'), system: systemPrompt, prompt: userPrompt, maxOutputTokens: 6000, temperature: 0.3 });
  return parseJsonResponse<PptxSlide[]>(text, []);
}

export async function generateExcelCellData(params: {
  templateName: string;
  templateFileText: string;
  sourceChunks: string[];
  instructions?: string;
}): Promise<ExcelCellData> {
  const { templateName, templateFileText, sourceChunks, instructions } = params;
  const contextText = buildContextText(sourceChunks);
  const systemPrompt = `당신은 Excel 양식 작성 전문 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
기존 Excel 양식의 구조(시트, 셀 위치, 서식)를 그대로 유지하면서 빈 셀에 값을 채웁니다.

## 출력 형식
반드시 아래 JSON 객체 형식으로만 출력하세요. 다른 텍스트는 포함하지 마세요.

\`\`\`json
{
  "시트이름": {
    "A1": "값",
    "B2": 123,
    "C5": "텍스트"
  }
}
\`\`\`

## 규칙
1. 시트 이름은 양식에 있는 기존 시트 이름을 그대로 사용합니다.
2. 셀 주소는 Excel 표기법(A1, B2, C3...)을 사용합니다.
3. 이미 값이 있는 셀은 건드리지 않습니다. 빈 셀만 채웁니다.
4. 숫자는 number, 텍스트는 string으로 구분합니다.
5. 참조 자료에서 값을 찾을 수 없으면 [확인필요]로 표시합니다.`;

  const userPrompt = `## 작성할 Excel: ${templateName}

## ★ 기존 양식 구조 (이 구조의 빈 셀만 채우세요):
${templateFileText.slice(0, MAX_TEMPLATE_FILE_CHARS)}

## 참조 자료:
${contextText || '(참조 자료 없음)'}

${instructions ? `## 지시사항:\n${instructions}\n\n` : ''}위 양식의 빈 셀을 참조 자료와 지시사항으로 채워 JSON 객체로 출력하세요.`;

  const { text } = await generateText({ model: openai('gpt-4o'), system: systemPrompt, prompt: userPrompt, maxOutputTokens: 8000, temperature: 0.2 });
  return parseJsonResponse<ExcelCellData>(text, {});
}

export async function generatePptxReplacements(params: {
  templateName: string;
  templateFileText: string;
  sourceChunks: string[];
  instructions?: string;
}): Promise<PptxReplacement> {
  const { templateName, templateFileText, sourceChunks, instructions } = params;
  const contextText = buildContextText(sourceChunks);
  const systemPrompt = `당신은 프레젠테이션 양식 작성 전문 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
기존 PPT 양식의 레이아웃/디자인을 유지하면서 텍스트만 교체합니다.

## 출력 형식
반드시 아래 JSON 객체 형식으로만 출력하세요. 다른 텍스트는 포함하지 마세요.

\`\`\`json
{
  1: { "기존 플레이스홀더 텍스트": "새로운 텍스트" },
  2: { "제목 텍스트": "새 제목", "본문 텍스트": "새 본문" }
}
\`\`\`

## 규칙
1. 키는 슬라이드 번호(1부터 시작)입니다.
2. 각 슬라이드에서 교체할 텍스트를 "기존→새" 형태로 매핑합니다.
3. 기존 텍스트는 양식에 있는 정확한 텍스트를 사용합니다.
4. 새 텍스트는 참조 자료와 지시사항을 바탕으로 작성합니다.
5. 교체할 필요 없는 텍스트(로고, 고정 문구)는 포함하지 않습니다.`;

  const userPrompt = `## 작성할 프레젠테이션: ${templateName}

## ★ 기존 양식 슬라이드 텍스트 (이 텍스트를 교체하세요):
${templateFileText.slice(0, MAX_TEMPLATE_FILE_CHARS)}

## 참조 자료:
${contextText || '(참조 자료 없음)'}

${instructions ? `## 지시사항:\n${instructions}\n\n` : ''}위 양식의 플레이스홀더 텍스트를 참조 자료로 교체하여 JSON 객체로 출력하세요.`;

  const { text } = await generateText({ model: openai('gpt-4o'), system: systemPrompt, prompt: userPrompt, maxOutputTokens: 6000, temperature: 0.2 });
  return parseJsonResponse<PptxReplacement>(text, {});
}
