import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type {
  OutputFormat,
  DocxReplacement,
  DocxFormData,
  DocxTableStructure,
  GenerationResult,
} from '@/lib/renderers/types';
import { buildTemplateMarkdownScaffold, type TemplateBundle } from '@/lib/templates/template-schema';
import { MAX_TEMPLATE_FILE_CHARS, buildContextText, parseJsonResponse } from './generate-shared';
import {
  mapAcademicReportFormData,
  mapFormDataDirect,
  tableStructureToText,
  type ReportTemplateData,
} from './docx-form-mapping';

function isAcademicReportTemplate(templateName: string, templateFileText: string) {
  const probe = `${templateName}\n${templateFileText}`.replace(/\s+/g, '');
  return ['제출일', '전공', '과목', '학번', '담당교수', '이름', '대제목', '중제목', '소제목'].every((token) =>
    probe.includes(token.replace(/\s+/g, '')),
  );
}

async function generateReportTemplateData(params: {
  templateName: string;
  sourceChunks: string[];
  instructions?: string;
}): Promise<ReportTemplateData> {
  const { templateName, sourceChunks, instructions } = params;
  const contextText = buildContextText(sourceChunks);
  const systemPrompt = `당신은 한국어 보고서 작성 AI입니다.

반드시 JSON 객체만 출력하세요.

출력 형식:
{
  "meta": {
    "title": "",
    "subtitle": "",
    "submittedAt": "",
    "major": "",
    "course": "",
    "studentId": "",
    "professor": "",
    "studentName": ""
  },
  "sections": {
    "title1": "",
    "subtitle1": "",
    "subheading1": "",
    "body1": "",
    "body2": "",
    "body3": "",
    "title2": "",
    "subtitle2": "",
    "subtitle3": "",
    "subtitle4": "",
    "closing": ""
  }
}

규칙:
1. 값이 없으면 "[확인필요]"를 넣습니다.
2. title/subtitle는 짧고 명확하게 씁니다.
3. body1~body3, closing은 각각 1~3문장으로 씁니다.
4. sections는 실제 보고서 내용이 되도록 작성합니다.
5. 대학 보고서 양식에 맞는 어조를 사용합니다.`;

  const userPrompt = `작성할 보고서 양식: ${templateName}

참조 자료:
${contextText || '(참조 자료 없음)'}

${instructions ? `지시사항:\n${instructions}\n\n` : ''}위 내용을 바탕으로 보고서 양식 입력용 JSON을 생성하세요.`;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: 4000,
    temperature: 0.3,
  });

  return parseJsonResponse<ReportTemplateData>(text, {
    meta: {
      title: '[확인필요]',
      subtitle: '',
      submittedAt: '[확인필요]',
      major: '[확인필요]',
      course: '[확인필요]',
      studentId: '[확인필요]',
      professor: '[확인필요]',
      studentName: '[확인필요]',
    },
    sections: {
      title1: '대제목',
      subtitle1: '중제목',
      subheading1: '소제목',
      body1: '[확인필요]',
      body2: '[확인필요]',
      body3: '[확인필요]',
      title2: '대제목2',
      subtitle2: '중제목',
      subtitle3: '중제목2',
      subtitle4: '중제목3',
      closing: '[확인필요]',
    },
  });
}

export async function generateDocxReplacements(params: {
  templateName: string;
  templateFileText: string;
  sourceChunks: string[];
  instructions?: string;
}): Promise<DocxReplacement> {
  const { templateName, templateFileText, sourceChunks, instructions } = params;
  const contextText = buildContextText(sourceChunks);
  const systemPrompt = `당신은 공문서/보고서 양식 작성 전문 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
기존 DOCX 양식의 구조(제목, 항목, 표)를 그대로 유지하면서 빈칸/플레이스홀더만 채웁니다.

## 출력 형식
반드시 아래 JSON 객체 형식으로만 출력하세요. 다른 텍스트는 포함하지 마세요.

\`\`\`json
{
  "기존 텍스트 또는 빈칸": "새로운 텍스트",
  "_____ (예: 날짜)": "2026년 4월 3일",
  "( )": "실제 값"
}
\`\`\`

## 규칙
1. 키는 양식에 있는 정확한 빈칸/플레이스홀더 텍스트를 사용합니다.
2. 값은 참조 자료와 지시사항을 바탕으로 채웁니다.
3. 이미 완성된 텍스트(고정 문구)는 포함하지 않습니다.
4. 참조 자료에서 값을 찾을 수 없으면 [확인필요]로 표시합니다.
5. 양식 전체를 다시 쓰지 말고, 변경이 필요한 부분만 매핑하세요.`;

  const userPrompt = `## 작성할 문서: ${templateName}

## ★ 기존 양식 텍스트 (빈칸/플레이스홀더만 채우세요):
${templateFileText.slice(0, MAX_TEMPLATE_FILE_CHARS)}

## 참조 자료:
${contextText || '(참조 자료 없음)'}

${instructions ? `## 지시사항:\n${instructions}\n\n` : ''}위 양식의 빈칸과 플레이스홀더를 참조 자료와 지시사항으로 채워 JSON 객체로 출력하세요.`;

  const { text } = await generateText({ model: openai('gpt-4o'), system: systemPrompt, prompt: userPrompt, maxOutputTokens: 8000, temperature: 0.2 });
  return parseJsonResponse<DocxReplacement>(text, {});
}

export async function generateDocxFormData(params: {
  templateName: string;
  tableStructure: DocxTableStructure;
  sourceChunks: string[];
  instructions?: string;
}): Promise<DocxFormData> {
  const { templateName, tableStructure, sourceChunks, instructions } = params;
  const contextText = buildContextText(sourceChunks);
  const structureText = tableStructureToText(tableStructure);
  const fieldList = tableStructure.emptyCells.map(c => `- ${c.fieldId}: ${c.contextLabel || '미정'} (행${c.rowIndex}, 열${c.colIndex})`).join('\n');
  const systemPrompt = `당신은 문서 양식 작성 전문 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
1. 제공된 양식의 빈 셀에 들어갈 내용을 JSON 객체로 반환합니다.
2. 각 필드의 위치와 인접 라벨을 참고해 적절한 내용을 배치합니다.
3. 지시사항의 내용을 최우선으로 반영합니다.
4. 내용이 없는 필드는 빈 문자열("")로 남겨두세요.
5. 번호가 매겨진 항목은 해당 행에 맞는 내용을 배치하세요.`;

  const userPrompt = `## 문서명
${templateName}

## 양식 구조
${structureText}

## 빈 필드 목록
${fieldList}

## 참조 자료
${contextText || '(참조 자료 없음)'}

${instructions ? `## 지시사항\n${instructions}\n\n` : ''}반드시 JSON 객체로만 응답하세요.`;

  const { text } = await generateText({ model: openai('gpt-4o'), system: systemPrompt, prompt: userPrompt, maxOutputTokens: 12000, temperature: 0.4 });
  return parseJsonResponse<DocxFormData>(text, {});
}

function trimSingleColumnStructure(structure: DocxTableStructure) {
  const firstPerTable = new Map<number, number>();
  for (const cell of structure.emptyCells) {
    const prev = firstPerTable.get(cell.tableIndex);
    if (prev === undefined || cell.rowIndex < prev) firstPerTable.set(cell.tableIndex, cell.rowIndex);
  }
  return {
    ...structure,
    emptyCells: structure.emptyCells.filter(cell => {
      const colCount = structure.tables[cell.tableIndex]?.rows[0]?.length ?? 1;
      return colCount > 1 || cell.rowIndex === firstPerTable.get(cell.tableIndex);
    }),
  };
}

export async function generateDocxTemplateResult(params: {
  format: OutputFormat;
  title: string;
  templateName: string;
  templateBuffer: Buffer;
  templateFileText: string;
  sourceChunks: string[];
  instructions?: string;
  templateBundle?: TemplateBundle | null;
  documentInputs?: Record<string, string>;
}): Promise<GenerationResult> {
  const { format, title, templateName, templateBuffer, templateFileText, sourceChunks, instructions, templateBundle, documentInputs } = params;
  const semanticMarkdown = templateBundle ? buildTemplateMarkdownScaffold(templateBundle, documentInputs) : undefined;

  if (isAcademicReportTemplate(templateName, templateFileText)) {
    const report = await generateReportTemplateData({ templateName, sourceChunks, instructions });
    const { extractDocxTableStructure } = await import('@/lib/renderers/docx-renderer');
    const tableStructure = extractDocxTableStructure(templateBuffer);
    const docxFormData = mapAcademicReportFormData(tableStructure, report);
    const studentLine = [report.meta.studentId, report.meta.studentName].filter(Boolean).join(' ');
    const docxReplacements: DocxReplacement = {
      '교과목 명': report.meta.course || '[확인필요]',
      '보고서 제목': report.meta.title || '[확인필요]',
      '학번 이름': studentLine || '[확인필요]',
      '대제목2': report.sections.title2 || '대제목2',
      '중제목2': report.sections.subtitle3 || '중제목2',
      '중제목3': report.sections.subtitle4 || '중제목3',
      '내용내용내용': report.sections.closing || '[확인필요]',
      '__paragraph__:보고서 제목': report.meta.title || '[확인필요]',
      '__paragraph__:부제목': report.meta.subtitle || '',
      '__paragraph__:대제목': report.sections.title1 || '대제목',
      '__paragraph__:중제목': report.sections.subtitle1 || '중제목',
      '__paragraph__:소제목': report.sections.subheading1 || '소제목',
      '__paragraph__:홈 > 스타일': report.sections.body1 || '[확인필요]',
      '__paragraph__:문단 간격 조절이나 들여쓰기': report.sections.body2 || '[확인필요]',
      '__paragraph__:더블클릭으로 바닥글이나': report.sections.body3 || '[확인필요]',
    };
    return { format, title, docxFormData, tableStructure, templateBuffer, docxReplacements, markdown: semanticMarkdown, templateBundle, documentInputs };
  }

  try {
    const { extractDocxTableStructure } = await import('@/lib/renderers/docx-renderer');
    const tableStructure = extractDocxTableStructure(templateBuffer);
    if (tableStructure.hasEmptyCells) {
      const trimmedStructure = trimSingleColumnStructure(tableStructure);
      const directData = mapFormDataDirect(trimmedStructure, instructions ?? '');
      const filledCount = Object.values(directData).filter(v => v && v.trim()).length;
      if (filledCount < trimmedStructure.emptyCells.length * 0.3) {
        const docxFormData = await generateDocxFormData({ templateName, tableStructure: trimmedStructure, sourceChunks, instructions });
        return { format, title, docxFormData, tableStructure, templateBuffer, markdown: semanticMarkdown, templateBundle, documentInputs };
      }
      return { format, title, docxFormData: directData, tableStructure, templateBuffer, markdown: semanticMarkdown, templateBundle, documentInputs };
    }
  } catch (e) {
    console.error('[generateForFormat] DOCX 구조 분석 실패, 텍스트 치환 폴백:', e);
  }

  const docxReplacements = await generateDocxReplacements({ templateName, templateFileText, sourceChunks, instructions });
  return { format, title, docxReplacements, templateBuffer, markdown: semanticMarkdown, templateBundle, documentInputs };
}

export async function generateHwpxTemplateResult(params: {
  format: OutputFormat;
  title: string;
  templateName: string;
  templateBuffer: Buffer;
  sourceChunks: string[];
  instructions?: string;
}): Promise<GenerationResult | null> {
  const { format, title, templateName, templateBuffer, sourceChunks, instructions } = params;

  try {
    const { extractHwpxTableStructure } = await import('@/lib/renderers/hwpx-renderer');
    const hwpxResult = extractHwpxTableStructure(templateBuffer);
    if (hwpxResult && hwpxResult.structure.hasEmptyCells) {
      const trimmedStructure = trimSingleColumnStructure(hwpxResult.structure);
      const directData = mapFormDataDirect(trimmedStructure, instructions ?? '');
      const filledCount = Object.values(directData).filter(v => v && v.trim()).length;
      if (filledCount < trimmedStructure.emptyCells.length * 0.3) {
        const hwpxFormData = await generateDocxFormData({ templateName, tableStructure: trimmedStructure, sourceChunks, instructions });
        return { format, title, hwpxFormData, hwpxTableStructure: hwpxResult.structure, templateBuffer };
      }
      return { format, title, hwpxFormData: directData, hwpxTableStructure: hwpxResult.structure, templateBuffer };
    }
  } catch (e) {
    console.error('[HWPX] 구조 분석 실패, 마크다운 폴백:', e instanceof Error ? e.message : e, e instanceof Error ? e.stack : '');
  }

  console.warn('[HWPX] Form-fill 경로 실패, 마크다운 폴백 진입');
  return null;
}
