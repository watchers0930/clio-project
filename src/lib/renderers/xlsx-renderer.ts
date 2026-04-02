/**
 * XLSX 렌더러 — AI JSON → Excel 파일 변환
 * exceljs 사용
 */

import type { ExcelSheet, RenderOutput, CorporateTheme } from './types';
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
