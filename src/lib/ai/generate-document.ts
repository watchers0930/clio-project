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
import type { OutputFormat, ExcelSheet, ExcelCellData, PptxSlide, PptxReplacement, DocxReplacement, DocxFormData, DocxTableStructure, GenerationResult } from '@/lib/renderers/types';

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

  const hasTemplateFile = !!trimmedTemplateFileText;
  const hasTemplateContent = !!templateContent?.trim();
  const hasAnyTemplate = hasTemplateFile || hasTemplateContent;

  const systemPrompt = hasTemplateFile
    ? `당신은 계약서/공문서 작성 전문 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
1. 제공된 "표준양식"의 전체 구조를 그대로 복사합니다.
2. 양식의 모든 조항(제1조, 제2조...), 항목 번호, 표, 서식을 빠짐없이 유지합니다.
3. 빈칸, 괄호, 플레이스홀더(_____, ( ), 년 월 일 등)만 참조 자료와 지시사항의 실제 값으로 채웁니다.
4. 양식에 없는 내용을 임의로 추가하지 않습니다.
5. 참조 자료에서 값을 찾을 수 없는 빈칸은 [미정] 또는 [확인필요]로 표시합니다.
6. 마크다운 형식으로 출력합니다.`
    : hasTemplateContent
    ? `당신은 전문 문서 작성 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
1. 제공된 "템플릿 구조"를 충실히 따라 문서를 작성합니다.
2. 템플릿에 정의된 섹션, 항목, 구조를 빠짐없이 포함합니다.
3. 각 섹션의 내용을 참조 자료와 지시사항을 바탕으로 구체적이고 실질적으로 작성합니다.
4. 마크다운 형식으로 출력합니다.
5. 코드블록(\`\`\`markdown)으로 감싸지 말고 순수 마크다운으로 출력합니다.`
    : `당신은 전문 문서 작성 AI입니다. 한국어로 작성하세요.
주어진 참조 자료를 분석하여 완성도 높은 문서를 마크다운 형식으로 작성합니다.
코드블록(\`\`\`markdown)으로 감싸지 말고 순수 마크다운으로 출력합니다.`;

  let userPrompt = `## 작성할 문서: ${templateName}\n\n`;

  if (trimmedTemplateFileText) {
    userPrompt += `## ★ 표준양식 (이 양식의 구조를 그대로 유지하고 빈칸만 채우세요):\n\n${trimmedTemplateFileText}\n\n`;
  }

  if (templateContent) {
    userPrompt += `## ★ 템플릿 구조 (이 구조를 반드시 따라 작성하세요):\n${templateContent}\n\n`;
  }

  userPrompt += `## 참조 자료 (빈칸을 채울 때 참고):\n${contextText || '(참조 자료 없음)'}\n\n`;

  if (instructions) {
    userPrompt += `## 지시사항 (이 정보로 빈칸을 채우세요):\n${instructions}\n\n`;
  }

  if (hasTemplateFile) {
    userPrompt += `위 표준양식의 구조를 그대로 유지하면서, 참조 자료와 지시사항의 정보로 빈칸을 채워 완성된 "${templateName}" 문서를 출력하세요. 양식의 조항이나 구조를 생략하지 마세요.`;
  } else if (hasTemplateContent) {
    userPrompt += `위 "템플릿 구조"에 정의된 섹션과 항목을 빠짐없이 따르되, 참조 자료와 지시사항을 바탕으로 각 항목의 내용을 구체적으로 채워 완성된 "${templateName}" 문서를 출력하세요. 코드블록으로 감싸지 마세요.`;
  } else {
    userPrompt += `위 참조 자료를 바탕으로 "${templateName}" 문서를 완성해주세요. 코드블록으로 감싸지 마세요.`;
  }

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 12000,
    temperature: 0.2,
  });

  // AI가 ```markdown ... ``` 코드블록으로 감쌀 경우 제거
  let result = text.trim();
  if (result.startsWith('```markdown')) {
    result = result.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
  } else if (result.startsWith('```')) {
    result = result.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  return result;
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

// ─── XLSX 템플릿용: AI가 셀 주소별 값 반환 ──────────────────

export async function generateExcelCellData(params: {
  templateName: string;
  templateFileText: string;
  sourceChunks: string[];
  instructions?: string;
}): Promise<ExcelCellData> {
  const { templateName, templateFileText, sourceChunks, instructions } = params;

  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > MAX_CONTEXT_CHARS) break;
    contextText += chunk + '\n---\n';
  }

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

${instructions ? `## 지시사항:\n${instructions}\n\n` : ''}
위 양식의 빈 셀을 참조 자료와 지시사항으로 채워 JSON 객체로 출력하세요.`;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 8000,
    temperature: 0.2,
  });

  return parseJsonResponse<ExcelCellData>(text, {});
}

// ─── PPTX 템플릿용: AI가 슬라이드별 텍스트 치환 반환 ─────────

export async function generatePptxReplacements(params: {
  templateName: string;
  templateFileText: string;
  sourceChunks: string[];
  instructions?: string;
}): Promise<PptxReplacement> {
  const { templateName, templateFileText, sourceChunks, instructions } = params;

  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > MAX_CONTEXT_CHARS) break;
    contextText += chunk + '\n---\n';
  }

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

${instructions ? `## 지시사항:\n${instructions}\n\n` : ''}
위 양식의 플레이스홀더 텍스트를 참조 자료로 교체하여 JSON 객체로 출력하세요.`;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 6000,
    temperature: 0.2,
  });

  return parseJsonResponse<PptxReplacement>(text, {});
}

// ─── DOCX 템플릿용: AI가 텍스트 치환 맵 반환 ────────────────

export async function generateDocxReplacements(params: {
  templateName: string;
  templateFileText: string;
  sourceChunks: string[];
  instructions?: string;
}): Promise<DocxReplacement> {
  const { templateName, templateFileText, sourceChunks, instructions } = params;

  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > MAX_CONTEXT_CHARS) break;
    contextText += chunk + '\n---\n';
  }

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

${instructions ? `## 지시사항:\n${instructions}\n\n` : ''}
위 양식의 빈칸과 플레이스홀더를 참조 자료와 지시사항으로 채워 JSON 객체로 출력하세요.`;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 8000,
    temperature: 0.2,
  });

  return parseJsonResponse<DocxReplacement>(text, {});
}

// ─── DOCX 폼 데이터 생성 (빈 셀 채우기) ─────────────────────

/** 테이블 구조를 AI가 읽을 수 있는 텍스트로 변환 */
function tableStructureToText(structure: DocxTableStructure): string {
  const lines: string[] = [];
  for (const table of structure.tables) {
    if (table.rows.length === 0) continue;
    const headerStr = table.headers.filter(h => h).join(' | ');
    lines.push(`### 테이블 ${table.tableIndex} (헤더: ${headerStr || '없음'})`);

    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      if (r === 0) {
        lines.push(`헤더행: ${row.map(c => c.text || '(빈칸)').join(' | ')}`);
        continue;
      }
      const cellDescs = row.map(c => {
        if (c.isEmpty) {
          const ctx = c.contextLabel ? ` (${c.contextLabel})` : '';
          return `[${c.fieldId}: 빈칸${ctx}]`;
        }
        return c.text;
      });
      lines.push(`행 ${r}: ${cellDescs.join(' | ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ─── 프로그래밍 방식 폼 매핑 (AI 미사용, 확정적) ──────────

/** 지시사항에서 "키: 값" 형태의 메타데이터 추출 */
function extractMeta(instructions: string, key: string): string {
  const regex = new RegExp(`${key}[:\\s]*(.+?)(?:\\n|$)`, 'i');
  const m = instructions.match(regex);
  return m ? m[1].trim() : '';
}

/** 지시사항에서 섹션별 내용 추출 (금일 업무, 명일 업무, 비고) */
function extractSection(instructions: string, sectionName: string): string[] {
  // "금일 업무:" 또는 "금일업무:" 뒤의 내용을 다음 섹션 시작 전까지 추출
  const sectionNames = ['금일\\s*업무', '명일\\s*업무', '비고'];
  const otherSections = sectionNames.filter(s => s !== sectionName.replace(/\s+/g, '\\s*'));
  const endPattern = otherSections.length > 0 ? `(?=${otherSections.join('|')})` : '$';
  const regex = new RegExp(`${sectionName}[:\\s]*\\n?([\\s\\S]*?)(?:${endPattern}|$)`, 'i');
  const m = instructions.match(regex);
  if (!m) return [];
  return m[1].split('\n')
    .map(line => line.replace(/^\s*\d+[.)]\s*/, '').replace(/^\s*[-•]\s*/, '').trim())
    .filter(line => line.length > 0);
}

/** 테이블 구조에서 라벨 옆의 빈 셀 fieldId 찾기 */
function findFieldByLabel(structure: DocxTableStructure, label: string): string | null {
  for (const table of structure.tables) {
    for (const row of table.rows) {
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        // 라벨 텍스트 매칭 (공백/전각공백 무시)
        const normalized = cell.text.replace(/[\s\u3000]+/g, '');
        if (normalized.includes(label) && !cell.isEmpty) {
          // 오른쪽 빈 셀 찾기
          if (c + 1 < row.length && row[c + 1].isEmpty) {
            return row[c + 1].fieldId;
          }
        }
      }
    }
  }
  return null;
}

/** 특정 헤더 아래의 본문 빈 셀들 찾기 (행 순서대로) */
function findBodyCells(structure: DocxTableStructure, headerText: string): string[] {
  const fieldIds: string[] = [];
  for (const table of structure.tables) {
    // 헤더행에서 해당 텍스트의 열 인덱스 찾기
    let headerColIdx = -1;
    if (table.rows.length > 0) {
      // 헤더가 아닌 "금일 업무내용" / "명일 업무내용" 행 찾기
      for (let r = 0; r < table.rows.length; r++) {
        for (let c = 0; c < table.rows[r].length; c++) {
          const normalized = table.rows[r][c].text.replace(/[\s\u3000]+/g, '');
          if (normalized.includes(headerText)) {
            headerColIdx = c;
            // 이 행 이후의 같은 열에서 빈 셀 수집
            for (let br = r + 1; br < table.rows.length; br++) {
              if (br < table.rows.length && table.rows[br][headerColIdx]) {
                const bodyCell = table.rows[br][headerColIdx];
                if (bodyCell.isEmpty) fieldIds.push(bodyCell.fieldId);
              }
            }
            return fieldIds;
          }
        }
      }
    }
  }
  return fieldIds;
}

/** 프로그래밍 방식으로 폼 데이터 매핑 (AI 불필요) */
export function mapFormDataDirect(
  structure: DocxTableStructure,
  instructions: string,
): DocxFormData {
  const result: DocxFormData = {};
  console.log('[mapFormDataDirect] instructions:', instructions.slice(0, 500));
  console.log('[mapFormDataDirect] emptyCells:', structure.emptyCells.length);

  // 1. 메타데이터 매핑
  const metaFields: [string, string][] = [
    ['보고번호', '보고번호'],
    ['작성일자', '작성일자'],
    ['작성자', '작성자'],
    ['부서명', '부서'],
    ['제목', '제목'],
  ];

  for (const [key, label] of metaFields) {
    const value = extractMeta(instructions, key);
    const fieldId = findFieldByLabel(structure, label);
    console.log(`[mapFormDataDirect] meta: ${key}=${value}, label=${label}, fieldId=${fieldId}`);
    if (value && fieldId) result[fieldId] = value;
  }

  // 2. 금일 업무 매핑
  const todayItems = extractSection(instructions, '금일\\s*업무');
  const todayCells = findBodyCells(structure, '금일업무내용');
  console.log(`[mapFormDataDirect] 금일: items=${JSON.stringify(todayItems)}, cells=${todayCells.length}`);
  for (let i = 0; i < Math.min(todayItems.length, todayCells.length); i++) {
    result[todayCells[i]] = todayItems[i];
  }

  // 3. 명일 업무 매핑
  const tomorrowItems = extractSection(instructions, '명일\\s*업무');
  const tomorrowCells = findBodyCells(structure, '명일업무내용');
  console.log(`[mapFormDataDirect] 명일: items=${JSON.stringify(tomorrowItems)}, cells=${tomorrowCells.length}`);
  for (let i = 0; i < Math.min(tomorrowItems.length, tomorrowCells.length); i++) {
    result[tomorrowCells[i]] = tomorrowItems[i];
  }

  // 4. 비고 매핑
  const bigoItems = extractSection(instructions, '비고');
  // 비고는 보통 마지막 행의 첫 셀 — 라벨 "비고" 옆 또는 아래
  if (bigoItems.length > 0) {
    // "비고" 라벨이 있는 행에서 빈 셀 찾기
    for (const table of structure.tables) {
      for (const row of table.rows) {
        for (let c = 0; c < row.length; c++) {
          if (row[c].text.replace(/[\s\u3000]+/g, '').includes('비고')) {
            // 같은 행의 다음 빈 셀, 또는 이 셀 자체가 유일한 셀이면 아래 행
            if (c + 1 < row.length && row[c + 1].isEmpty) {
              result[row[c + 1].fieldId] = bigoItems.join(', ');
            }
          }
        }
      }
    }
  }

  console.log('[mapFormDataDirect] RESULT:', JSON.stringify(result));
  return result;
}

export async function generateDocxFormData(params: {
  templateName: string;
  tableStructure: DocxTableStructure;
  sourceChunks: string[];
  instructions?: string;
}): Promise<DocxFormData> {
  const { templateName, tableStructure, sourceChunks, instructions } = params;

  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > MAX_CONTEXT_CHARS) break;
    contextText += chunk + '\n---\n';
  }

  const structureText = tableStructureToText(tableStructure);
  const fieldList = tableStructure.emptyCells.map(c =>
    `- ${c.fieldId}: ${c.contextLabel || '미정'} (행${c.rowIndex}, 열${c.colIndex})`
  ).join('\n');

  const systemPrompt = `당신은 문서 양식 작성 전문 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
1. 제공된 양식의 빈 셀에 들어갈 내용을 JSON 객체로 반환합니다.
2. 각 필드의 위치(어떤 테이블, 어떤 열의 헤더)와 인접 셀의 라벨을 참고하여 적절한 내용을 배치합니다.
3. "지시사항"의 내용을 최우선으로 반영하여 빈칸을 채웁니다.
4. 참조 자료가 없어도 지시사항만으로 빈칸을 채울 수 있습니다.
5. 내용이 없는 필드는 빈 문자열("")로 남겨두세요.
6. 번호가 매겨진 항목(1., 2., 3...)은 해당 행에 맞는 내용을 배치하세요.

## 메타데이터 자동 매핑 (최우선 적용)
지시사항 맨 위에 자동 생성된 메타데이터가 있습니다. 반드시 해당 필드에 매핑하세요:
- "작성일자: ..." → "회의일시", "작성일자", "일시", "날짜" 등 날짜 관련 빈칸에 반드시 배치
- "작성자: ..." → "작성자", "작성자명" 옆 빈칸에 반드시 배치
- "부서명: ..." → "부서", "부서명", "소속" 옆 빈칸에 반드시 배치
- "보고번호: ..." → 보고번호 옆 빈칸에 배치
- "참석자: ..." → 참석자 옆 빈칸에 배치
※ 위 메타데이터 필드는 빈칸으로 남기지 말고 반드시 값을 채우세요.

## 양식 유형별 매핑 가이드

### 회의록
- "회의일시" 옆 빈칸 → 반드시 "작성일자" 또는 "회의일시" 값을 넣으세요 (예: 2026-04-05)
- "부서" 옆 빈칸 → 반드시 "부서명" 또는 "부서" 값을 넣으세요
- "작성자" 옆 빈칸 → 반드시 "작성자" 값을 넣으세요
- "참석자" 옆 빈칸 → 참석자 목록 (쉼표 구분)
- "회의안건" 영역의 번호별 빈칸 → 지시사항의 "안건" 내용을 번호별로 배치
- "회의내용" 영역의 "내용" 열 빈칸 → 지시사항의 모든 회의 내용을 이 열에 상세히 기술 (핵심 내용 전부 여기에)
- "회의내용" 영역의 "비고" 열 빈칸 → 지시사항에 "비고:" 로 명시된 내용만 넣고, 없으면 반드시 빈 문자열("")로 남기세요
- "결정사항" 영역의 "내용" 열 빈칸 → 결정된 사항들
- "결정사항" 영역의 "진행일정" 열 빈칸 → 각 결정사항의 일정/기한
- "특이사항" 영역 빈칸 → 특별히 언급할 사항, 없으면 빈 문자열("")

### 업무일지
- "금일 업무:" 또는 "금일업무:" → "금일 업무내용" 영역의 번호별 행에 배치
- "명일 업무:" 또는 "명일업무:" → "명일 업무내용" 영역에 배치
- "비고:" → "비고" 영역에 배치

### 기타 양식
- 라벨(왼쪽 셀 또는 헤더 행)의 의미를 파악하고 지시사항에서 관련 내용을 추출하여 매핑
- 큰 빈칸(회의내용 등)은 지시사항의 핵심 내용을 충실히 반영하여 상세히 작성

## 출력 형식
반드시 아래 JSON 객체 형식으로만 출력하세요. 다른 텍스트는 포함하지 마세요.

\`\`\`json
{
  "field_0_1_0": "내용1",
  "field_0_2_0": "내용2"
}
\`\`\``;

  const userPrompt = `## 작성할 문서: ${templateName}

## 양식 구조:
${structureText}

## 채워야 할 빈 필드 목록:
${fieldList}

${contextText ? `## 참조 자료:\n${contextText}\n` : ''}
${instructions ? `## 지시사항 (이 내용으로 빈칸을 채우세요):\n${instructions}\n\n` : ''}
위 양식의 빈 필드를 지시사항과 참조 자료를 바탕으로 채워 JSON 객체로 출력하세요.`;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 8000,
    temperature: 0.2,
  });

  return parseJsonResponse<DocxFormData>(text, {});
}

// ─── 통합 생성 엔진 ─────────────────────────────────────────

export async function generateForFormat(params: {
  format: OutputFormat;
  templateName: string;
  templateContent?: string | null;
  templateFileText?: string | null;
  templateBuffer?: Buffer | null;
  sourceChunks: string[];
  instructions?: string;
}): Promise<GenerationResult> {
  const { format, templateName, ...rest } = params;
  const title = templateName;
  const hasTemplateFile = !!rest.templateFileText && !!rest.templateBuffer;

  switch (format) {
    case 'xlsx': {
      // 템플릿 있으면 → 셀 주입 방식, 없으면 → 새로 생성
      if (hasTemplateFile) {
        const excelCellData = await generateExcelCellData({
          templateName,
          templateFileText: rest.templateFileText!,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        });
        return { format, title, excelCellData, templateBuffer: rest.templateBuffer! };
      }
      const excelSheets = await generateExcelContent({
        templateName,
        sourceChunks: rest.sourceChunks,
        instructions: rest.instructions,
      });
      return { format, title, excelSheets };
    }

    case 'pptx': {
      // 템플릿 있으면 → 텍스트 치환 방식, 없으면 → 새로 생성
      if (hasTemplateFile) {
        const pptxReplacements = await generatePptxReplacements({
          templateName,
          templateFileText: rest.templateFileText!,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        });
        return { format, title, pptxReplacements, templateBuffer: rest.templateBuffer! };
      }
      const pptxSlides = await generatePptxContent({
        templateName,
        sourceChunks: rest.sourceChunks,
        instructions: rest.instructions,
      });
      return { format, title, pptxSlides };
    }

    case 'docx': {
      if (hasTemplateFile) {
        try {
          const { extractDocxTableStructure } = await import('@/lib/renderers/docx-renderer');
          const tableStructure = extractDocxTableStructure(rest.templateBuffer!);

          if (tableStructure.hasEmptyCells) {
            // 1차: 프로그래밍 매핑 시도
            const directData = mapFormDataDirect(tableStructure, rest.instructions ?? '');
            const filledCount = Object.values(directData).filter(v => v && v.trim()).length;

            // 채운 셀이 전체 빈 셀의 30% 미만이면 AI로 대체
            if (filledCount < tableStructure.emptyCells.length * 0.3) {
              console.log(`[generateForFormat] 직접 매핑 부족 (${filledCount}/${tableStructure.emptyCells.length}), AI 생성으로 전환`);
              const docxFormData = await generateDocxFormData({
                templateName,
                tableStructure,
                sourceChunks: rest.sourceChunks,
                instructions: rest.instructions,
              });
              return { format, title, docxFormData, tableStructure, templateBuffer: rest.templateBuffer! };
            }

            return { format, title, docxFormData: directData, tableStructure, templateBuffer: rest.templateBuffer! };
          }
        } catch (e) {
          console.error('[generateForFormat] DOCX 구조 분석 실패, 텍스트 치환 폴백:', e);
        }

        // 빈 셀 없으면 → 기존 텍스트 치환 방식
        const docxReplacements = await generateDocxReplacements({
          templateName,
          templateFileText: rest.templateFileText!,
          sourceChunks: rest.sourceChunks,
          instructions: rest.instructions,
        });
        return { format, title, docxReplacements, templateBuffer: rest.templateBuffer! };
      }
      // 템플릿 없으면 → 마크다운 기반 새로 생성
      const markdown = await generateDocumentContent({
        templateName,
        templateContent: rest.templateContent,
        templateFileText: rest.templateFileText,
        sourceChunks: rest.sourceChunks,
        instructions: rest.instructions,
      });
      return { format, title, markdown };
    }

    case 'hwpx': {
      if (hasTemplateFile) {
        try {
          const { extractHwpxTableStructure } = await import('@/lib/renderers/hwpx-renderer');
          const hwpxResult = extractHwpxTableStructure(rest.templateBuffer!);

          console.log('[HWPX] extractHwpxTableStructure result:', hwpxResult ? `tables=${hwpxResult.structure.tables.length}, emptyCells=${hwpxResult.structure.emptyCells.length}` : 'null');
          if (hwpxResult && hwpxResult.structure.hasEmptyCells) {
            // 프로그래밍 방식으로 직접 매핑 (AI 미사용)
            const hwpxFormData = mapFormDataDirect(hwpxResult.structure, rest.instructions ?? '');
            console.log('[HWPX] mapFormDataDirect keys:', Object.keys(hwpxFormData).length);
            return { format, title, hwpxFormData, hwpxTableStructure: hwpxResult.structure, templateBuffer: rest.templateBuffer! };
          }
        } catch (e) {
          console.error('[HWPX] 구조 분석 실패, 마크다운 폴백:', e instanceof Error ? e.message : e, e instanceof Error ? e.stack : '');
        }
        console.warn('[HWPX] Form-fill 경로 실패, 마크다운 폴백 진입');
      }
      // 템플릿 없거나 빈 셀 없으면 → 마크다운 기반 새로 생성
      const hwpxMarkdown = await generateDocumentContent({
        templateName,
        templateContent: rest.templateContent,
        templateFileText: rest.templateFileText,
        sourceChunks: rest.sourceChunks,
        instructions: rest.instructions,
      });
      return { format, title, markdown: hwpxMarkdown };
    }

    case 'pdf': {
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
