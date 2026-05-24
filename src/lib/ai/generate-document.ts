/**
 * AI 문서 생성 엔진 — 멀티포맷 지원
 * 템플릿 + 양식파일 + 소스 파일 청크 + 지시사항 → GPT-4o → 포맷별 결과
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
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

async function generateProposalBySections(params: {
  templateName: string;
  templateBundle: TemplateBundle;
  sourceChunks: string[];
  instructions?: string;
  documentInputs?: Record<string, string>;
}): Promise<string> {
  const { templateBundle, sourceChunks, instructions, documentInputs } = params;
  const model = openai('gpt-4o');

  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > MAX_CONTEXT_CHARS) break;
    contextText += `${chunk}\n---\n`;
  }

  const fieldValues = templateBundle.fields
    .map((f) => `- ${f.label}: ${documentInputs?.[f.key] || '[미입력]'}`)
    .join('\n');
  const title = documentInputs?.report_title?.trim() || params.templateName;

  const sharedSystem = `당신은 공공기관 제출용 제안서 작성 전문 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
1. 입력된 기본정보를 최우선 사실로 사용합니다.
2. 문체는 공공기관 제출용으로 간결하고 공식적으로 유지합니다.
3. 불필요한 마케팅·과장·추측성 표현을 쓰지 않습니다.
4. 순수 마크다운만 출력합니다. 단, Mermaid 다이어그램은 \`\`\`mermaid 코드블록으로 포함합니다.
5. 확인되지 않은 비용·일정·인력 실명은 [확인필요]로 남깁니다.
6. **이 섹션을 최대한 충실하고 상세하게** 작성합니다. 분량 제한 없이 평가위원이 납득할 깊이를 확보합니다.
7. 각 H3 항목은 서술형(4~8문단)으로 전개합니다. 배경→현황→방안→기대효과 흐름을 따릅니다.
8. 표가 적절한 곳에는 5~8행의 상세 표를 포함합니다.
9. Mermaid 다이어그램을 적극 활용합니다. 기본 방향은 가로(graph LR), 노드 5개 이상이면 두 줄로 분리합니다.
10. AS-IS 분석은 수치화, 기대효과는 정량적 KPI, 차별점은 구체적 비교로 서술합니다.`;

  const sectionPromises = templateBundle.sections.map(async (section) => {
    const sectionSystem = `${sharedSystem}\n\n## 현재 작성 섹션: ${section.title}\n\n## 작성 지시\n${section.prompt}`;
    const sectionUser = [
      `## 기본정보\n${fieldValues}`,
      `## 참조 자료\n${contextText || '(참조 자료 없음)'}`,
      instructions ? `## 추가 지시사항\n${instructions}` : '',
      `"${section.title}" 섹션을 작성하세요.`,
      '- ## (H2) 제목 없이 ### (H3) 하위 항목부터 바로 시작합니다.',
      '- 각 H3 항목마다 4~8문단으로 충분히 서술합니다.',
      '- 다이어그램이 적절한 곳에는 반드시 Mermaid를 포함합니다.',
    ].filter(Boolean).join('\n\n');

    try {
      const { text } = await generateText({
        model,
        system: sectionSystem,
        prompt: sectionUser,
        maxOutputTokens: 16000,
        temperature: 0.2,
      });
      let result = text.trim();
      if (result.startsWith('```markdown')) result = result.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
      else if (result.startsWith('```')) result = result.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
      return { title: section.title, content: result };
    } catch (err) {
      console.error(`[proposal-sections] ${section.title} failed:`, err);
      return { title: section.title, content: section.prompt };
    }
  });

  const results = await Promise.all(sectionPromises);
  return [`# ${title}`, '', ...results.map((r) => `## ${r.title}\n\n${r.content}`)].join('\n\n');
}

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

  // 제안서: 섹션별 분할 생성 (템플릿 파일 없는 번들 기반)
  if (isProposalTemplateName(templateName) && templateBundle && !templateFileText) {
    return generateProposalBySections({
      templateName,
      templateBundle,
      sourceChunks,
      instructions,
      documentInputs,
    });
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
3. 확인되지 않은 기관명, 비용, 일정, 인력 실명은 임의 확정하지 말고 [확인필요]로 남깁니다.
4. 문체는 공공기관 제출용으로 간결하고 공식적으로 유지합니다.
5. 불필요한 마케팅 표현, 과장 표현, 추측성 표현을 쓰지 않습니다.
6. 순수 마크다운만 출력합니다. 코드블록(백틱)으로 감싸지 않습니다. 단, Mermaid 다이어그램은 \`\`\`mermaid 코드블록으로 포함합니다.

## 분량 기준
- 글자 수 제한 없이 **각 섹션을 충분히 상세하게** 작성합니다. 평가위원이 납득할 수 있는 깊이를 확보합니다.
- 각 H3 항목은 서술형(3~6문단)으로 작성합니다. 불릿만 나열하지 마세요.
- 표가 적절한 곳에는 5~8행의 표를 포함합니다.
- 참조 문서가 없어도 입력 정보를 바탕으로 구체적 내용을 생성합니다.

## 섹션 1.3 "제안 범위" 규칙
- 각 수행 범위를 ####(H4)로 분리하고, 항목마다 1~2문장 설명 + 주요 활동 불릿 2~3개를 포함합니다.
- 마지막에 **종합 범위 표**(구분/수행범위/주요활동/기대산출물/우선순위 5열, 5~7행)를 작성합니다.

## 섹션 3 "수행 범위 및 세부 내용" 규칙
- **3.1 WBS 표**: 대분류-중분류-소분류-산출물-비고 5열, 10행 이상.
- **3.2 세부 수행 내용**: 핵심 모듈을 ####(H4)로 분리, 모듈마다 기능 목록 표 + Mermaid 플로우차트(\`\`\`mermaid graph LR)로 처리 흐름을 표현합니다.
- **3.3 시스템 구성도**: Mermaid 플로우차트(graph LR)로 아키텍처를 표현합니다. \`\`\`mermaid 코드블록을 사용합니다.
- **3.4 데이터 흐름**: Mermaid 플로우차트(graph LR)로 데이터 흐름을 표현합니다. \`\`\`mermaid 코드블록 + 외부 연동 표를 포함합니다.
- **3.5 기능 요구사항 매트릭스**: 요구사항ID/분류/요구사항명/우선순위/관련모듈 5열, 7행 이상.

## 콘텐츠 품질 가이드
- AS-IS 분석은 현재 문제를 **수치화**(처리 시간, 오류율, 비용 등)하여 표현합니다.
- 기대효과는 **정량적 KPI**(| 지표 | 현재 | 목표 | 개선율 | 형식의 표)로 제시합니다.
- 차별점은 기존 방식 대비 **구체적 비교**로 서술합니다.

## 다이어그램 활용 규칙
- Mermaid 다이어그램을 **적극적으로 활용**합니다. 다음 섹션에 반드시 포함합니다:
  - 2.3 추진 방향: AS-IS → TO-BE 전환 흐름 (graph LR)
  - 2.4 핵심 성공 요인: CSF 간 관계도 (graph LR)
  - 3.2 세부 수행 내용: 모듈별 처리 흐름 (graph LR)
  - 3.3 시스템 구성도: 전체 아키텍처 (graph LR)
  - 3.4 데이터 흐름: 시스템 간 데이터 흐름 (graph LR)
  - 4.1 수행 방법론: 방법론 단계 흐름 (graph LR)
  - 5.1 수행 조직: 조직도 (graph LR)
- **방향 규칙**: 기본은 **가로(graph LR)**를 사용합니다. 세로(graph TD)는 계층이 3단 이상일 때만 사용합니다.
- **가독성 규칙**: 노드가 5개 이상이면 중간에 줄바꿈 노드를 두어 두 줄로 분리합니다. 예시:
  \`\`\`mermaid
  graph LR
    A[분석] --> B[설계] --> C[개발]
    C --> D[테스트] --> E[배포]
  \`\`\`
- 모든 다이어그램은 \`\`\`mermaid 코드블록을 사용합니다.

## 핵심 성공 요인(CSF) 작성 규칙
- 각 CSF를 ####(H4)로 분리합니다.
- 각 CSF마다 다음을 포함합니다:
  - **정의**: 왜 이 요인이 핵심인지 2~3문장으로 설명
  - **실행 전략**: 구체적 실행 방안 3~5개를 서술형으로 기술
  - **성과 지표**: 해당 CSF의 달성 여부를 측정할 KPI 1~2개
  - **위험 요소**: 이 CSF가 실패할 경우의 리스크와 대응 방안`
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
- **각 H3 항목마다 3~6개 문단**으로 서술합니다. 불릿만 나열하지 말고, 배경→현황→방안→기대효과 흐름으로 논리적으로 전개합니다.
- 표가 적절한 곳(사업 개요, 산출물, 일정, 인력, 비용, 위험분석 등)에는 **5행 이상의 상세 마크다운 표**를 반드시 포함합니다.
- 불릿/번호 목록을 사용할 때도 각 항목에 **1~2문장의 설명**을 덧붙입니다. 단어만 나열하지 마세요.
- 참조 자료가 없어도 입력된 사업명/제안 목적/수행 범위를 바탕으로 해당 기술·산업 분야의 **현실적이고 구체적인 내용**을 생성합니다.
- AS-IS/TO-BE 비교, 단계별 활동 상세, 조직 역할 명세, 위험 매트릭스 등 **실무에서 바로 활용할 수 있는 수준**으로 작성합니다.
- 빈 섹션이나 "내용 없음" 표기 없이 모든 섹션을 충실하게 채웁니다.
- 불명확한 값(금액, 일정, 인력 실명)만 [확인필요]로 표기합니다.
- 글자 수 제한 없이 **모든 섹션을 충분한 깊이로** 작성하세요. 특히 핵심 성공 요인, 수행 방법론, 위험 분석은 상세하게 서술합니다.`
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

  const model = openai('gpt-4o');

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
