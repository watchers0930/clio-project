/**
 * XLSX 렌더러
 * - renderXlsx: AI JSON → 새 Excel 생성 (템플릿 없을 때)
 * - renderXlsxFromTemplate: 기존 XLSX 로드 → 셀 값 주입 (템플릿 있을 때)
 */

import type { ExcelSheet, ExcelCellData, RenderOutput, CorporateTheme } from './types';
import { DEFAULT_THEME } from './types';

export async function renderXlsx(
  sheets: ExcelSheet[],
  title: string,
  theme: CorporateTheme = DEFAULT_THEME,
): Promise<RenderOutput> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CLIO AI';
  workbook.created = new Date();

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.sheetName);

    // 헤더 행
    const headerRow = ws.addRow(sheet.headers);
    headerRow.eachCell(cell => {
      cell.font = {
        name: theme.fontFamilyEn,
        bold: true,
        size: theme.fontSize,
        color: { argb: 'FFFFFFFF' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${theme.primaryColor}` },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // 데이터 행
    for (let rowIdx = 0; rowIdx < sheet.rows.length; rowIdx++) {
      const dataRow = ws.addRow(sheet.rows[rowIdx]);
      dataRow.eachCell(cell => {
        cell.font = { name: theme.fontFamilyEn, size: theme.fontSize - 1 };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E5EA' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E5EA' } },
          left: { style: 'thin', color: { argb: 'FFE2E5EA' } },
          right: { style: 'thin', color: { argb: 'FFE2E5EA' } },
        };
        // 짝수 행 배경색
        if (rowIdx % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF7F8FA' },
          };
        }
      });
    }

    // 컬럼 너비 자동 조절
    ws.columns.forEach((col, idx) => {
      const header = sheet.headers[idx] ?? '';
      let maxLen = header.length;
      for (const row of sheet.rows) {
        const cellVal = String(row[idx] ?? '');
        if (cellVal.length > maxLen) maxLen = cellVal.length;
      }
      col.width = Math.min(Math.max(maxLen + 4, 10), 40);
    });

    // 필터 설정
    if (sheet.headers.length > 0 && sheet.rows.length > 0) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.headers.length },
      };
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
    fileName: `${title}.xlsx`,
  };
}

/**
 * 템플릿 기반 XLSX 생성
 * 기존 XLSX 파일을 로드하여 서식 유지 + AI가 지정한 셀에 값 주입
 */
export async function renderXlsxFromTemplate(
  templateBuffer: Buffer,
  cellData: ExcelCellData,
  title: string,
): Promise<RenderOutput> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  // AI가 지정한 셀에 값 주입 (기존 서식 유지)
  for (const [sheetName, cells] of Object.entries(cellData)) {
    const ws = workbook.getWorksheet(sheetName);
    if (!ws) {
      console.warn(`[xlsx-template] 시트를 찾을 수 없음: ${sheetName}`);
      continue;
    }

    for (const [cellAddr, value] of Object.entries(cells)) {
      const cell = ws.getCell(cellAddr);
      // 서식(font, fill, border, alignment)은 유지하고 값만 변경
      cell.value = typeof value === 'number' ? value : String(value);
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
    fileName: `${title}.xlsx`,
  };
}
