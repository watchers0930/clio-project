/**
 * AI 문서 생성 엔진 — 멀티포맷 지원
 * 템플릿 + 양식파일 + 소스 파일 청크 + 지시사항 → GPT-4o → 포맷별 결과
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import type { GenerationResult, OutputFormat } from '@/lib/renderers/types';
import type { TemplateBundle } from '@/lib/templates/template-schema';
import { isWorklogTemplateName } from '@/lib/templates/worklog';
import { isProposalTemplateName } from '@/lib/templates/proposal';
import {
  MAX_CONTEXT_CHARS,
  MAX_TEMPLATE_FILE_CHARS,
  generateDocxTemplateResult,
  generateExcelCellData,
  generateExcelContent,
  generateHwpxTemplateResult,
  generatePptxContent,
  generatePptxReplacements,
} from './generate-document-helpers';

export async function generateDocumentContent(params: {
  templateName: string;
  templateContent?: string | null;
  templateBundle?: TemplateBundle | null;
  templateFileText?: string | null;
  sourceChunks: string[];
  instructions?: string;
  documentInputs?: Record<string, string>;
}): Promise<string> {
  const { templateName, templateContent, templateBundle, templateFileText, sourceChunks, instructions, documentInputs } = params;
  if (isWorklogTemplateName(templateName)) {
    const reportDate = documentInputs?.report_date || '';
    const author = documentInputs?.author || '';
    const title = documentInputs?.report_title?.trim() || templateName;
    const todayWork = documentInputs?.today_work?.trim() || '[미입력]';
    const tomorrowWork = documentInputs?.tomorrow_work?.trim() || '[미입력]';
    const note = documentInputs?.note?.trim() || '[미입력]';

    return [
      `# ${title}`,
      '',
      author ? `**작성자:** ${author}` : '',
      reportDate ? `**작성일:** ${reportDate}` : '',
      '',
      '## 금일업무내용',
      todayWork,
      '',
      '## 특이사항',
      note,
      '',
      '## 차일업무계획',
      tomorrowWork,
    ].filter(Boolean).join('\n');
  }

  let trimmedTemplateFileText = templateFileText ?? null;
  if (trimmedTemplateFileText && trimmedTemplateFileText.length > MAX_TEMPLATE_FILE_CHARS) {
    trimmedTemplateFileText = `${trimmedTemplateFileText.slice(0, MAX_TEMPLATE_FILE_CHARS)}\n...(이하 생략)`;
  }

  const maxSourceChars = Math.max(5000, MAX_CONTEXT_CHARS - (trimmedTemplateFileText?.length ?? 0));
  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > maxSourceChars) break;
    contextText += `${chunk}\n---\n`;
  }

  const hasTemplateFile = !!trimmedTemplateFileText;
  const hasTemplateContent = !!templateContent?.trim();
  const hasTemplateBundle = !!templateBundle;
  const isProposalTemplate = isProposalTemplateName(templateName);
  const systemPrompt = hasTemplateFile
    ? `당신은 계약서/공문서 작성 전문 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
1. 제공된 "표준양식"의 전체 구조를 그대로 복사합니다.
2. 양식의 모든 조항, 항목 번호, 표, 서식을 빠짐없이 유지합니다.
3. 빈칸과 플레이스홀더만 참조 자료와 지시사항의 값으로 채웁니다.
4. 양식에 없는 내용을 임의로 추가하지 않습니다.
5. 값을 찾을 수 없는 빈칸은 [미정] 또는 [확인필요]로 표시합니다.
6. 마크다운 형식으로 출력합니다.`
    : hasTemplateBundle && isProposalTemplate
    ? `당신은 공공기관 제출용 제안서 작성 전문 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
1. 입력된 기본정보 7개를 최우선 사실로 사용합니다.
2. 제공된 섹션 구조와 순서를 **반드시** 그대로 유지합니다. 각 섹션은 ## (H2)로, 하위 항목은 ### (H3)로 작성합니다.
3. **각 섹션은 반드시 하위 항목(H3) 3~4개 이상**을 포함하고, 각 하위 항목은 **2~4개 문단** 이상 구체적으로 작성합니다.
4. 참조 문서가 있으면 이를 근거로 각 섹션을 확장 작성합니다. 참조 문서가 없어도 입력된 사업명과 제안 목적을 바탕으로 해당 분야의 일반적이고 현실적인 내용을 충실하게 작성합니다.
5. 적절한 곳에 **마크다운 표, 불릿 목록, 번호 목록**을 적극 활용하여 가독성을 높입니다.
6. 확인되지 않은 기관명, 비용, 일정, 인력 실명은 임의 확정하지 말고 [확인필요]로 남깁니다.
7. 문체는 공공기관 제출용으로 간결하고 공식적으로 유지합니다.
8. 불필요한 마케팅 표현, 과장 표현, 추측성 표현을 쓰지 않습니다.
9. 순수 마크다운만 출력합니다. 코드블록(백틱) 감싸지 않습니다.

## 분량 기준
- 전체 제안서: 최소 3000자 이상
- 각 섹션(H2): 최소 400자 이상
- 얕은 한두 문장으로 섹션을 마무리하지 마세요. 실무에서 활용 가능한 수준의 구체적 내용을 작성합니다.`
    : hasTemplateBundle
    ? `당신은 한국어 보고서 작성 전문 AI입니다.

## 핵심 규칙
1. 제공된 문서 기본정보를 반드시 반영합니다.
2. 제목, 소제목, 작성자, 날짜를 문서 상단에 반드시 반영합니다.
3. 제목은 H1, 본문 섹션은 H2로 작성합니다.
4. 각 섹션은 구체적 사실, 근거, 수치, 실행 포인트를 포함합니다.
5. 요구사항과 참조자료를 바탕으로 목차 항목을 먼저 정리한 뒤 본문을 작성합니다.
6. 순수 마크다운만 출력합니다.`
    : hasTemplateContent
    ? `당신은 전문 문서 작성 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
1. 제공된 템플릿 구조를 충실히 따릅니다.
2. 템플릿의 섹션과 항목을 빠짐없이 포함합니다.
3. 참조 자료와 지시사항을 바탕으로 각 항목을 구체적으로 작성합니다.
4. 순수 마크다운으로 출력합니다.`
    : `당신은 전문 문서 작성 AI입니다. 한국어로 작성하세요.
주어진 참조 자료를 분석하여 완성도 높은 문서를 순수 마크다운 형식으로 작성합니다.`;

  let userPrompt = `## 작성할 문서: ${templateName}\n\n`;
  if (trimmedTemplateFileText) userPrompt += `## ★ 표준양식\n\n${trimmedTemplateFileText}\n\n`;
  if (templateBundle) {
    const fieldSpec = templateBundle.fields.map((field) => `- ${field.label} (${field.key})`).join('\n');
    const fieldValues = templateBundle.fields
      .map((field) => `- ${field.label}: ${documentInputs?.[field.key] || '[미입력]'}`)
      .join('\n');
    const sectionSpec = templateBundle.sections
      .map((section) => `- ${section.title}: ${section.prompt}`)
      .join('\n');

    userPrompt += `## ★ 문서 기본정보 필드\n${fieldSpec}\n\n`;
    userPrompt += `## ★ 입력된 기본정보\n${fieldValues}\n\n`;
    userPrompt += `## ★ 섹션 구조\n${sectionSpec}\n\n`;
  }
  if (templateContent) userPrompt += `## ★ 템플릿 구조\n${templateContent}\n\n`;
  userPrompt += `## 참조 자료\n${contextText || '(참조 자료 없음)'}\n\n`;
  if (instructions) userPrompt += `## 지시사항\n${instructions}\n\n`;
  userPrompt += hasTemplateFile
    ? `표준양식의 구조를 그대로 유지하면서 "${templateName}" 문서를 완성하세요.`
    : hasTemplateBundle && isProposalTemplate
    ? `"${templateName}" 문서를 다음 원칙으로 작성하세요.

## 필수 구조
1. **# 제목** (H1) — 입력된 문서 제목
2. **## 섹션** (H2) — 위 섹션 구조에 정의된 8개 섹션을 순서대로 작성
3. **### 하위 항목** (H3) — 각 섹션의 prompt에 명시된 하위 항목을 빠짐없이 포함

## 내용 작성 원칙
- 각 하위 항목(H3)마다 2~4개 문단으로 **구체적이고 실질적인 내용**을 작성합니다
- 표가 적절한 곳(사업 개요, 산출물, 일정, 인력, 비용 등)에는 반드시 마크다운 표를 사용합니다
- 목록이 적절한 곳에는 불릿(-) 또는 번호(1.) 목록을 사용합니다
- 참조 자료가 없더라도 입력된 사업명/제안 목적/수행 범위를 바탕으로 해당 산업 분야의 현실적인 내용을 작성합니다
- 빈 섹션이나 "내용 없음" 표기 없이 모든 섹션을 충실하게 채웁니다
- 불명확한 값(금액, 일정, 인력 실명)만 [확인필요]로 표기합니다`
    : hasTemplateBundle
    ? `"${templateName}" 문서를 다음 순서로 작성하세요.
1. H1 제목
2. 소제목
3. 작성자/작성일
4. 목차
5. 정의된 각 섹션을 H2로 순서대로 작성`
    : hasTemplateContent
    ? `템플릿 구조를 빠짐없이 따라 "${templateName}" 문서를 완성하세요.`
    : `"${templateName}" 문서를 완성하세요.`;

  const model = isProposalTemplate
    ? anthropic('claude-sonnet-4-5-20250514')
    : openai('gpt-4o');

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: isProposalTemplate ? 16000 : 12000,
    temperature: 0.2,
  });

  let result = text.trim();
  if (result.startsWith('```markdown')) result = result.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
  else if (result.startsWith('```')) result = result.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
  return result;
}

export async function generateForFormat(params: {
  format: OutputFormat;
  templateName: string;
  templateContent?: string | null;
  templateBundle?: TemplateBundle | null;
  templateFileText?: string | null;
  templateBuffer?: Buffer | null;
  sourceChunks: string[];
  instructions?: string;
  documentInputs?: Record<string, string>;
}): Promise<GenerationResult> {
  const { format, templateName, ...rest } = params;
  const title = templateName;
  const hasTemplateFile = !!rest.templateFileText && !!rest.templateBuffer;

  switch (format) {
    case 'xlsx':
      if (hasTemplateFile) {
        const excelCellData = await generateExcelCellData({
          templateName,
          templateFileText: rest.templateFileText!,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        });
        return { format, title, excelCellData, templateBuffer: rest.templateBuffer! };
      }
      return {
        format,
        title,
        excelSheets: await generateExcelContent({
          templateName,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        }),
      };

    case 'pptx':
      if (hasTemplateFile) {
        const pptxReplacements = await generatePptxReplacements({
          templateName,
          templateFileText: rest.templateFileText!,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        });
        return { format, title, pptxReplacements, templateBuffer: rest.templateBuffer! };
      }
      return {
        format,
        title,
        pptxSlides: await generatePptxContent({
          templateName,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        }),
      };

    case 'docx':
      if (hasTemplateFile) {
        const result = await generateDocxTemplateResult({
          format,
          title,
          templateName,
          templateBuffer: rest.templateBuffer!,
          templateFileText: rest.templateFileText!,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
          templateBundle: rest.templateBundle,
          documentInputs: rest.documentInputs,
        });
        if (!result.markdown) {
          result.markdown = await generateDocumentContent({
            templateName,
            templateContent: rest.templateContent,
            templateBundle: rest.templateBundle,
            templateFileText: rest.templateFileText,
            sourceChunks: rest.sourceChunks,
            instructions: rest.instructions,
            documentInputs: rest.documentInputs,
          });
        }
        result.templateBundle = rest.templateBundle;
        result.documentInputs = rest.documentInputs;
        return result;
      }
      return {
        format,
        title,
        markdown: await generateDocumentContent({
          templateName,
          templateContent: rest.templateContent,
          templateBundle: rest.templateBundle,
          templateFileText: rest.templateFileText,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
          documentInputs: rest.documentInputs,
        }),
        templateBundle: rest.templateBundle,
        documentInputs: rest.documentInputs,
      };

    case 'hwpx':
      if (hasTemplateFile) {
        const hwpxResult = await generateHwpxTemplateResult({
          format,
          title,
          templateName,
          templateBuffer: rest.templateBuffer!,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        });
        if (hwpxResult) {
          if (!hwpxResult.markdown) {
            hwpxResult.markdown = await generateDocumentContent({
              templateName,
              templateContent: rest.templateContent,
              templateBundle: rest.templateBundle,
              templateFileText: rest.templateFileText,
              sourceChunks: rest.sourceChunks,
              instructions: rest.instructions,
              documentInputs: rest.documentInputs,
            });
          }
          hwpxResult.templateBundle = rest.templateBundle;
          hwpxResult.documentInputs = rest.documentInputs;
          return hwpxResult;
        }
      }
      return {
        format,
        title,
        markdown: await generateDocumentContent({
          templateName,
          templateContent: rest.templateContent,
          templateBundle: rest.templateBundle,
          templateFileText: rest.templateFileText,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
          documentInputs: rest.documentInputs,
        }),
        templateBundle: rest.templateBundle,
        documentInputs: rest.documentInputs,
      };

    case 'pdf':
      return {
        format,
        title,
        markdown: await generateDocumentContent({
          templateName,
          templateContent: rest.templateContent,
          templateBundle: rest.templateBundle,
          templateFileText: rest.templateFileText,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
          documentInputs: rest.documentInputs,
        }),
        templateBundle: rest.templateBundle,
        documentInputs: rest.documentInputs,
      };

    default:
      throw new Error(`지원하지 않는 출력 포맷: ${format}`);
  }
}
