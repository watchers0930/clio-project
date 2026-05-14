import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type {
  OutputFormat,
  ExcelSheet,
  ExcelCellData,
  PptxSlide,
  PptxReplacement,
  DocxReplacement,
  DocxFormData,
  DocxTableStructure,
  GenerationResult,
} from '@/lib/renderers/types';
import { buildTemplateMarkdownScaffold, type TemplateBundle } from '@/lib/templates/template-schema';

export const MAX_CONTEXT_CHARS = 60_000;
export const MAX_TEMPLATE_FILE_CHARS = 30_000;

interface RuntimeOverrideMeta {
  userName: string;
  userPosition: string;
  userDept: string;
  todayStr: string;
  templateName: string;
}

interface ReportTemplateData {
  meta: {
    title: string;
    subtitle: string;
    submittedAt: string;
    major: string;
    course: string;
    studentId: string;
    professor: string;
    studentName: string;
  };
  sections: {
    title1: string;
    subtitle1: string;
    subheading1: string;
    body1: string;
    body2: string;
    body3: string;
    title2: string;
    subtitle2: string;
    subtitle3: string;
    subtitle4: string;
    closing: string;
  };
}

function buildContextText(sourceChunks: string[], maxChars = MAX_CONTEXT_CHARS) {
  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > maxChars) break;
    contextText += `${chunk}\n---\n`;
  }
  return contextText;
}

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

function tableStructureToText(structure: DocxTableStructure): string {
  const lines: string[] = [];
  for (const table of structure.tables) {
    if (table.rows.length === 0) continue;
    lines.push(`### 테이블 ${table.tableIndex} (헤더: ${table.headers.filter(h => h).join(' | ') || '없음'})`);
    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      lines.push(`- 행 ${r}: ${row.map(cell => `${cell.contextLabel || cell.text || '빈칸'}=${cell.isEmpty ? '[빈칸]' : cell.text}`).join(' | ')}`);
    }
  }
  return lines.join('\n');
}

function extractMeta(instructions: string, key: string) {
  const match = instructions.match(new RegExp(`${key}\\s*:\\s*(.+)`));
  return match?.[1]?.trim() ?? '';
}

function normalizeComparableText(value: string) {
  return value.replace(/[\s\u3000()]/g, '').toLowerCase();
}

function includesNormalized(text: string, pattern: string) {
  return normalizeComparableText(text).includes(normalizeComparableText(pattern));
}

function extractMetaByKeys(instructions: string, keys: string[]) {
  for (const key of keys) {
    const value = extractMeta(instructions, key);
    if (value) return value;
  }
  return '';
}

function extractSection(instructions: string, sectionName: string) {
  const match = instructions.match(new RegExp(`(?:${sectionName})[ \\t]*:[ \\t]*([\\s\\S]*?)(?=\\n[^\\n:]+[ \\t]*:|$)`));
  return (match?.[1] ?? '').split(/\n+/).map(line => line.replace(/^\s*[-*]?\s*/, '').trim()).filter(Boolean);
}

function findFieldByLabel(structure: DocxTableStructure, label: string) {
  for (const table of structure.tables) {
    for (const row of table.rows) {
      for (let c = 0; c < row.length; c++) {
        if (includesNormalized(row[c].text, label)) {
          if (c + 1 < row.length && row[c + 1].isEmpty) return row[c + 1].fieldId;
        }
      }
    }
  }
  return null;
}

function findFieldByLabels(structure: DocxTableStructure, labels: string[]) {
  for (const label of labels) {
    const fieldId = findFieldByLabel(structure, label);
    if (fieldId) return fieldId;
  }
  return null;
}

function findBodyCells(structure: DocxTableStructure, headerText: string) {
  const fieldIds: string[] = [];
  for (const table of structure.tables) {
    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      for (let c = 0; c < row.length; c++) {
        if (includesNormalized(row[c].text, headerText)) {
          for (let br = r + 1; br < table.rows.length; br++) {
            const bodyCell = table.rows[br][c];
            if (bodyCell?.isEmpty) fieldIds.push(bodyCell.fieldId);
          }
          return fieldIds;
        }
      }
    }
  }
  return fieldIds;
}

function findBodyCellsByHeaders(structure: DocxTableStructure, headerTexts: string[]) {
  for (const headerText of headerTexts) {
    const fieldIds = findBodyCells(structure, headerText);
    if (fieldIds.length > 0) return fieldIds;
  }
  return [];
}

export function mapFormDataDirect(structure: DocxTableStructure, instructions: string): DocxFormData {
  const result: DocxFormData = {};

  const metaMappings = [
    { keys: ['보고번호'], labels: ['보고번호'] },
    { keys: ['작성일자', '작성일', '회의 일자', '회의일자', '회의 일시', '회의일시'], labels: ['작성일자', '작성일', '회의 일자', '회의일시'] },
    { keys: ['작성자', '작성자명', '담당'], labels: ['작성자', '작성자명', '작성', '담당'] },
    { keys: ['부서명', '부서', '보고처', '보고처(부서)', '작성자 소속', '작성자소속'], labels: ['부서', '보고처', '보고처(부서)', '작성자 소속', '작성자소속'] },
    { keys: ['제목', '보고서명', '보고서', '일일 업무 보고', '일일 업무 보고서', '일일업무보고', '일일업무보고서'], labels: ['제목', '보고서명', '보고서', '일일 업무 보고', '일일 업무 보고서', '일일업무보고', '일일업무보고서'] },
    { keys: ['회의 시간', '회의시간'], labels: ['회의 시간', '회의시간'] },
    { keys: ['장소'], labels: ['장소'] },
    { keys: ['참석자'], labels: ['참석자'] },
  ] as const;

  for (const mapping of metaMappings) {
    const value = extractMetaByKeys(instructions, [...mapping.keys]);
    const fieldId = findFieldByLabels(structure, [...mapping.labels]);
    if (value && fieldId) result[fieldId] = value;
  }

  const todayItems = extractSection(instructions, '금일\\s*업무(?:내용)?|오늘\\s*업무(?:내용)?');
  const tomorrowItems = extractSection(instructions, '차일\\s*업무(?:계획)?|명일\\s*업무(?:계획|내용)?|익일\\s*업무(?:계획|내용)?|내일\\s*업무(?:계획|내용)?');
  const noteItems = extractSection(instructions, '특이사항(?:/건의사항)?|건의사항');
  const bigoItems = extractSection(instructions, '비고');
  const meetingContentItems = extractSection(instructions, '회의\\s*내용(?:\\s*\\(요약\\))?|보고\\s*내용과\\s*의견');
  const meetingResultItems = extractSection(instructions, '회의\\s*결과|문제점');
  const sourceItems = extractSection(instructions, '정보\\s*\\(자료\\)\\s*출처|정보\\s*출처');
  const todayCells = findBodyCellsByHeaders(structure, ['금일 업무 내용', '금일업무내용', '금일 업무', '금일업무', '오늘 업무', '오늘업무']);
  const noteCells = findBodyCellsByHeaders(structure, ['특이사항/건의사항', '특이사항 / 건의사항', '특이사항', '건의사항']);
  const tomorrowCells = findBodyCellsByHeaders(structure, ['차일 업무 계획', '차일업무계획', '차일 업무', '차일업무', '명일 업무 내용', '명일업무내용', '명일 업무', '명일업무', '익일 업무', '익일업무', '내일 업무', '내일업무']);
  const meetingContentCells = findBodyCellsByHeaders(structure, ['회의 내용 (요약)', '회의 내용', '보고 내용과 의견', '보고내용과의견']);
  const meetingResultCells = findBodyCellsByHeaders(structure, ['회의 결과', '문제점']);
  const sourceCells = findBodyCellsByHeaders(structure, ['정보(자료) 출처', '정보 출처', '정보출처']);

  for (let i = 0; i < Math.min(todayItems.length, todayCells.length); i++) result[todayCells[i]] = todayItems[i];
  for (let i = 0; i < Math.min(noteItems.length, noteCells.length); i++) result[noteCells[i]] = noteItems[i];
  for (let i = 0; i < Math.min(tomorrowItems.length, tomorrowCells.length); i++) result[tomorrowCells[i]] = tomorrowItems[i];
  for (let i = 0; i < Math.min(meetingContentItems.length, meetingContentCells.length); i++) result[meetingContentCells[i]] = meetingContentItems[i];
  for (let i = 0; i < Math.min(meetingResultItems.length, meetingResultCells.length); i++) result[meetingResultCells[i]] = meetingResultItems[i];
  for (let i = 0; i < Math.min(sourceItems.length, sourceCells.length); i++) result[sourceCells[i]] = sourceItems[i];

  if (bigoItems.length > 0) {
    for (const table of structure.tables) {
      for (const row of table.rows) {
        for (let c = 0; c < row.length; c++) {
          if (includesNormalized(row[c].text, '비고') && c + 1 < row.length && row[c + 1].isEmpty) {
            result[row[c + 1].fieldId] = bigoItems.join(', ');
          }
        }
      }
    }
  }

  return result;
}

export function applyFormDataRuntimeOverrides(
  formData: DocxFormData,
  cells: Array<{ fieldId: string; rowIndex: number; colIndex: number; contextLabel: string }>,
  meta: RuntimeOverrideMeta,
) {
  let reportOwnerFilled = false;

  for (const cell of cells) {
    const label = cell.contextLabel;

    if (/작성자\s*명|^작성자$|^작성$|^담당$/.test(label)) formData[cell.fieldId] = meta.userName;
    if (/작성자\s*직급/.test(label)) formData[cell.fieldId] = meta.userPosition;
    if (/작성자\s*소속/.test(label)) formData[cell.fieldId] = meta.userDept;
    if (/회의\s*(일시|일자)/.test(label)) formData[cell.fieldId] = meta.todayStr;
    if (/^(소속|성명|연락처|서명)$/.test(label)) formData[cell.fieldId] = '';
    if (/보고처/.test(label)) formData[cell.fieldId] = meta.userDept;
    if (/보고서명|^보고서$/.test(label)) formData[cell.fieldId] = meta.templateName;

    if (/보고서\s*\(/.test(label)) {
      if (cell.rowIndex === 1 && cell.colIndex === 0 && !reportOwnerFilled) {
        formData[cell.fieldId] = meta.userName;
        reportOwnerFilled = true;
      } else {
        formData[cell.fieldId] = '';
      }
    }
  }

  return formData;
}

function mapAcademicReportFormData(structure: DocxTableStructure, report: ReportTemplateData): DocxFormData {
  const mapping: Array<[string, string]> = [
    ['제출일', report.meta.submittedAt],
    ['전공', report.meta.major],
    ['과목', report.meta.course],
    ['학번', report.meta.studentId],
    ['담당교수', report.meta.professor],
    ['이름', report.meta.studentName],
  ];

  const result: DocxFormData = {};
  for (const [label, value] of mapping) {
    const fieldId = findFieldByLabels(structure, [label]);
    if (fieldId) result[fieldId] = value || '[확인필요]';
  }
  return result;
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

function parseJsonResponse<T>(text: string, fallback: T): T {
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as T;
      } catch {
        console.error('[generateDocument] JSON 파싱 실패:', jsonStr.slice(0, 200));
      }
    } else {
      console.error('[generateDocument] JSON 파싱 실패:', jsonStr.slice(0, 200));
    }
    return fallback;
  }
}
