// DOCX/HWPX 표 양식 매핑 유틸 — 지시사항·보고서 데이터를 빈 셀 fieldId에 직접 매핑 (AI 호출 없음)
import type { DocxFormData, DocxTableStructure } from '@/lib/renderers/types';

interface RuntimeOverrideMeta {
  userName: string;
  userPosition: string;
  userDept: string;
  todayStr: string;
  templateName: string;
}

export interface ReportTemplateData {
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


export function tableStructureToText(structure: DocxTableStructure): string {
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

export function mapAcademicReportFormData(structure: DocxTableStructure, report: ReportTemplateData): DocxFormData {
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
