// 작업내역 엑셀 내보내기 (클라이언트 다운로드)
import { STATUS_LABELS, PAYMENT_TYPE_LABELS, type WorkProject } from './types';
import { expectedProfit, paidTotal, unpaidTotal, toKoreanMoney } from './calc';

/** 대금 단계 요약 텍스트 (예: "계약금 2,000,000(09-01) / 잔금 …") */
function paymentSummary(project: WorkProject): string {
  return project.payments
    .map((p) => {
      const label = p.type === 'interim' ? `중도금${p.seq}` : PAYMENT_TYPE_LABELS[p.type];
      const due = p.due_date ? `(${p.due_date})` : '';
      const mark = p.paid ? '✓' : '';
      return `${label} ${p.amount.toLocaleString('ko-KR')}${due}${mark}`;
    })
    .join(' / ');
}

/** 프로젝트 목록을 xlsx로 내보내 브라우저 다운로드 */
export async function exportWorkLedgerExcel(projects: WorkProject[]): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('작업내역');

  ws.columns = [
    { header: '상태', key: 'status', width: 10 },
    { header: '프로젝트명', key: 'name', width: 28 },
    { header: '발주처', key: 'client', width: 18 },
    { header: '매입처', key: 'supplier', width: 18 },
    { header: '담당자', key: 'manager', width: 12 },
    { header: '계약일', key: 'contract_date', width: 13 },
    { header: '완료예정일', key: 'due_date', width: 13 },
    { header: '계약총액', key: 'contract_amount', width: 16 },
    { header: '계약총액(한글)', key: 'contract_amount_ko', width: 22 },
    { header: '수익률(%)', key: 'margin_rate', width: 11 },
    { header: '예상수익', key: 'expected_profit', width: 16 },
    { header: '수금완료', key: 'paid', width: 16 },
    { header: '미수금', key: 'unpaid', width: 16 },
    { header: '대금단계', key: 'payments', width: 50 },
    { header: '비고', key: 'note', width: 24 },
  ];

  ws.getRow(1).font = { bold: true };

  for (const p of projects) {
    ws.addRow({
      status: STATUS_LABELS[p.status],
      name: p.name,
      client: p.client_name ?? '',
      supplier: p.supplier_name ?? '',
      manager: p.manager_name ?? '',
      contract_date: p.contract_date ?? '',
      due_date: p.due_date ?? '',
      contract_amount: p.contract_amount,
      contract_amount_ko: toKoreanMoney(p.contract_amount),
      margin_rate: p.margin_rate,
      expected_profit: expectedProfit(p.contract_amount, p.margin_rate),
      paid: paidTotal(p),
      unpaid: unpaidTotal(p),
      payments: paymentSummary(p),
      note: p.note ?? '',
    });
  }

  // 금액 컬럼 천단위 콤마
  ['contract_amount', 'expected_profit', 'paid', 'unpaid'].forEach((key) => {
    ws.getColumn(key).numFmt = '#,##0';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `작업내역_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}
