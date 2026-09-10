// 하나은행 대량이체 업로드 파일(.xls) 생성 — 서버 전용(node)
// 원본 양식(data/bulk-transfer/HNB_대량이체_KO.xls)의 Sheet1 구조를 그대로 복제한다.
// "Excel Sheet의 구조는 절대로 변경하지 마십시오" — 헤더/순서/시트를 보존한다.
import * as XLSX from 'xlsx';
import type { HanaBulkRow } from './types';

// Sheet1 헤더 — 원본 순서 고정 (변경 금지)
const SHEET1_HEADER = [
  '입금은행',
  '입금계좌번호',
  '입금액',
  '예상예금주',
  '입금통장표시',
  '출금통장표시',
  '메모',
  'CMS코드',
  '받는분 휴대폰번호',
];

// Sheet2 안내문 — 원본 파일 내용 복제 (은행 파서가 시트 구조를 확인할 수 있어 유지)
const SHEET2_GUIDE = [
  '[필수] 1. 입금은행에는 은행코드 및 은행명을 입력합니다.',
  '          예를들면 하나은행의 경우 "081" 혹은 "하나" 혹은 "하나은행"으로 입력하면 됩니다.',
  '[필수] 2. 입금계좌번호에는 구분자(-)를 제외한 숫자만 입력합니다.',
  '[필수] 3. 입금액에는 이체할 금액을 입력합니다.',
  '[선택] 4. 예상예금주는 입금계좌의 예금주를 입력합니다.',
  '[선택] 5. 입금통장표시내용은 필요한 경우만 입력합니다.',
  '[선택] 6. 출금통장표시내용은 필요한 경우만 입력합니다.',
  '[선택] 7. 메모는 필요한 경우만 입력합니다.',
  '[선택] 8. CMS코드는 필요한 경우만 입력합니다.',
  '[선택] 9. 받는 분 휴대폰번호는 구분자(-)를 제외한 숫자만 입력합니다.',
  '* Excel Sheet의 구조는 절대로 변경하지 마십시오.',
  '* 입금은행, 입금계좌번호, 입금액은 필수입력사항입니다.',
];

/** 문자열 텍스트 셀 (계좌번호·은행코드 앞자리 0, 큰 숫자 정밀도 보존) */
function textCell(v: string | number | null | undefined): XLSX.CellObject {
  return { t: 's', v: v == null ? '' : String(v) };
}

/**
 * 이체 행 목록 → 하나은행 대량이체 .xls 버퍼.
 * 원본과 동일하게 모든 데이터 셀을 텍스트로 기록한다.
 */
export function generateHanaBulkXls(rows: HanaBulkRow[]): Buffer {
  const wb = XLSX.utils.book_new();

  // --- Sheet1: 데이터 ---
  const matrix: XLSX.CellObject[][] = [SHEET1_HEADER.map((h) => textCell(h))];
  for (const r of rows) {
    matrix.push([
      textCell(r.bankCode),
      textCell(r.account),
      textCell(String(Math.round(r.amount))), // 콤마 없는 숫자 문자열
      textCell(r.accountHolder),
      textCell(r.depositDisplay),
      textCell(r.withdrawDisplay),
      textCell(r.memo),
      textCell(r.cmsCode),
      textCell(r.notifyPhone),
    ]);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(matrix);
  XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1');

  // --- Sheet2: 안내문 ---
  const ws2 = XLSX.utils.aoa_to_sheet(SHEET2_GUIDE.map((line) => [line]));
  XLSX.utils.book_append_sheet(wb, ws2, 'Sheet2');

  const out = XLSX.write(wb, { bookType: 'xls', type: 'buffer' });
  return out as Buffer;
}

/** 다운로드 파일명 (예: 하나은행_대량이체_2026-09-10.xls) */
export function hanaBulkFilename(dateISO: string): string {
  return `하나은행_대량이체_${dateISO}.xls`;
}
