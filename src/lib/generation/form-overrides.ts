import type { DocxFormData, DocxTableStructure, OutputFormat } from '@/lib/renderers/types';
export function consolidateSectionCells(
  fd: Record<string, string>,
  emptyCells: Array<{ fieldId: string; tableIndex: number; rowIndex: number; colIndex: number }>,
) {
  const groups = new Map<string, Array<{ fieldId: string; rowIndex: number }>>();

  for (const cell of emptyCells) {
    const key = `${cell.tableIndex}_${cell.colIndex}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ fieldId: cell.fieldId, rowIndex: cell.rowIndex });
  }

  for (const [, cells] of groups) {
    if (cells.length <= 1) continue;
    cells.sort((a, b) => a.rowIndex - b.rowIndex);

    const merged = cells
      .map(c => fd[c.fieldId] || '')
      .filter(v => v.trim() !== '')
      .join('\n');

    fd[cells[0].fieldId] = merged;
    for (let i = 1; i < cells.length; i++) {
      fd[cells[i].fieldId] = '';
    }
  }
}

export function applyWorklogTemplateOverrides(
  formData: DocxFormData,
  structure: DocxTableStructure,
  documentInputs: Record<string, string>,
) {
  const noteValue = documentInputs.note?.trim() ?? '';
  const tomorrowValue = documentInputs.tomorrow_work?.trim() ?? '';

  for (const table of structure.tables) {
    const normalizedHeaders = table.headers.map((header) => header.replace(/\s+/g, ''));
    const isNextPlanTable = normalizedHeaders.includes('번호') && normalizedHeaders.includes('작업내용');
    const isTodayTable = normalizedHeaders.includes('업무내용') && normalizedHeaders.includes('비고');

    if (isTodayTable) {
      const bigoColIndex = normalizedHeaders.findIndex((header) => header === '비고');
      if (bigoColIndex >= 0) {
        for (const row of table.rows.slice(1)) {
          const bigoCell = row[bigoColIndex];
          if (bigoCell?.isEmpty) formData[bigoCell.fieldId] = '';
        }
      }

      for (const row of table.rows) {
        const labelCell = row[0];
        if (!labelCell) continue;
        const normalizedLabel = labelCell.text.replace(/\s+/g, '');
        if (!normalizedLabel.includes('특이사항') && !normalizedLabel.includes('건의사항')) continue;

        const targetCells = row.filter((cell, index) => index > 0 && cell.isEmpty);
        if (targetCells.length === 0) continue;

        formData[targetCells[0].fieldId] = noteValue;
        for (const cell of targetCells.slice(1)) {
          formData[cell.fieldId] = '';
        }
      }
    }

    if (isNextPlanTable) {
      const contentColIndex = normalizedHeaders.findIndex((header) => header === '작업내용');
      if (contentColIndex >= 0) {
        const contentCells = table.rows
          .slice(1)
          .map((row) => row[contentColIndex])
          .filter((cell) => cell?.isEmpty);

        if (contentCells.length > 0) {
          formData[contentCells[0].fieldId] = tomorrowValue;
          for (const cell of contentCells.slice(1)) {
            formData[cell.fieldId] = '';
          }
        }
      }

      const bigoColIndex = normalizedHeaders.findIndex((header) => header === '비고');
      if (bigoColIndex >= 0) {
        for (const row of table.rows.slice(1)) {
          const bigoCell = row[bigoColIndex];
          if (bigoCell?.isEmpty) formData[bigoCell.fieldId] = '';
        }
      }
    }
  }

  return formData;
}

export const VALID_FORMATS: OutputFormat[] = ['docx', 'pdf', 'hwpx', 'xlsx', 'pptx'];

export function isMouTemplateName(templateName: string | null | undefined) {
  return Boolean(templateName && /업무협약서|MOU|양해각서/i.test(templateName));
}

export function buildDocumentSummary(params: {
  id?: string;
  title: string;
  templateName: string;
  createdAt: string;
  status: '초안' | '완료';
  sourceCount: number;
  content: string;
  versionNumber?: number | null;
  parentId?: string | null;
  originDocumentId?: string | null;
  originContext?: string | null;
  outputFormat?: string | null;
}) {
  return {
    id: params.id,
    title: params.title,
    template: params.templateName,
    createdAt: params.createdAt,
    status: params.status,
    sourceCount: params.sourceCount,
    content: params.content,
    versionNumber: params.versionNumber ?? 1,
    parentId: params.parentId ?? null,
    originDocumentId: params.originDocumentId ?? null,
    originContext: params.originContext ?? null,
    outputFormat: params.outputFormat ?? null,
  };
}

export function buildDocumentInputInstructions(documentInputs: Record<string, string>) {
  const lines: string[] = [];
  const labelMap: Record<string, string> = {
    demand_org: '수요기관명',
    proposer_name: '제안사명',
    project_name: '사업명 또는 과업명',
    proposal_objective: '제안 목적',
    scope_summary: '핵심 수행 범위',
    special_notes: '특기사항 또는 작성 메모',
  };

  const pushLine = (label: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) lines.push(`${label}: ${trimmed}`);
  };

  pushLine('제목', documentInputs.report_title);
  pushLine('부제목', documentInputs.subtitle);
  pushLine('금일업무내용', documentInputs.today_work);
  pushLine('특이사항', documentInputs.note);
  pushLine('차일업무계획', documentInputs.tomorrow_work);

  // 프롬프트에 넣지 않을 키: 위에서 이미 처리한 필드 + base64 이미지/메타 필드
  // (base64 data URL은 수만 토큰을 차지해 TPM 한도 초과를 유발하므로 반드시 제외)
  const SKIP_KEYS = new Set([
    'report_title', 'subtitle', 'today_work', 'tomorrow_work', 'note',
    'signature_image_src', 'employee_signature_src', 'company_logo_src', 'company_logo_pattern_size',
  ]);

  for (const [key, value] of Object.entries(documentInputs)) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    if (SKIP_KEYS.has(key)) continue;
    // 방어적 처리: base64 data URL 등 비정상적으로 긴 값은 프롬프트에서 제외
    if (trimmed.startsWith('data:') || trimmed.length > 2000) continue;
    lines.push(`${labelMap[key] ?? key}: ${trimmed}`);
  }

  return lines.length > 0 ? `## 기본 입력값\n${lines.join('\n')}` : '';
}

