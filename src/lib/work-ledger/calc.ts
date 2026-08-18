// 작업내역 계산 유틸 (순수 함수)
import type { WorkPayment, WorkProject, WorkLedgerSummary } from './types';

/** 예상수익 금액 = 계약총액 × 수익률(%) */
export function expectedProfit(contractAmount: number, marginRate: number): number {
  return Math.round((contractAmount * marginRate) / 100);
}

/** yyyy-mm-dd 문자열 (로컬 기준) */
export function todayStr(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 미수금 + 예정일 경과 → 연체 */
export function isPaymentOverdue(p: WorkPayment, today: string = todayStr()): boolean {
  return !p.paid && !!p.due_date && p.due_date < today;
}

/** 프로젝트의 수금 완료 합계 */
export function paidTotal(project: WorkProject): number {
  return project.payments.reduce((sum, p) => sum + (p.paid ? p.amount : 0), 0);
}

/** 프로젝트의 미수금 합계 */
export function unpaidTotal(project: WorkProject): number {
  return project.payments.reduce((sum, p) => sum + (p.paid ? 0 : p.amount), 0);
}

/** 프로젝트에 연체 대금이 하나라도 있는지 */
export function hasOverdue(project: WorkProject, today: string = todayStr()): boolean {
  return project.payments.some((p) => isPaymentOverdue(p, today));
}

/** yyyy-mm 접두어 (해당 월 여부 판정용) */
function monthPrefix(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** 이번 달 수금 예정액 (미수금 & 예정일이 이번 달) */
export function thisMonthDueAmount(projects: WorkProject[], now: Date = new Date()): number {
  const prefix = monthPrefix(now);
  return projects.reduce((sum, project) => {
    return sum + project.payments.reduce((acc, p) => {
      if (!p.paid && p.due_date && p.due_date.startsWith(prefix)) return acc + p.amount;
      return acc;
    }, 0);
  }, 0);
}

/** 상단 요약 통계 */
export function summarize(projects: WorkProject[], now: Date = new Date()): WorkLedgerSummary {
  const today = todayStr(now);
  let activeCount = 0;
  let plannedCount = 0;
  let totalContract = 0;
  let totalExpectedProfit = 0;
  let overdueCount = 0;

  for (const project of projects) {
    if (project.status === 'in_progress') activeCount += 1;
    if (project.status === 'planned') plannedCount += 1;
    totalContract += project.contract_amount;
    totalExpectedProfit += expectedProfit(project.contract_amount, project.margin_rate);
    if (hasOverdue(project, today)) overdueCount += 1;
  }

  return {
    activeCount,
    plannedCount,
    totalContract,
    totalExpectedProfit,
    thisMonthDue: thisMonthDueAmount(projects, now),
    overdueCount,
  };
}

/** 원화 표기 (천단위 콤마 + 원) */
export function formatKRW(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

/** 천단위 콤마 (단위 없음) */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('ko-KR');
}


/** 대금 단계 금액 합계 */
export function paymentsTotal(payments: WorkPayment[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

const KO_DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const KO_SMALL = ['', '십', '백', '천'];
const KO_BIG = ['', '만', '억', '조', '경'];

/** 계약서 표준 한글 금액 표기 (예: 10000000 → "금 일천만원정") */
export function toKoreanMoney(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return '금 영원정';
  let num = n;
  let result = '';
  let bigIdx = 0;
  while (num > 0) {
    const chunk = num % 10000;
    if (chunk > 0) {
      let chunkStr = '';
      let c = chunk;
      let smallIdx = 0;
      while (c > 0) {
        const d = c % 10;
        if (d > 0) chunkStr = KO_DIGITS[d] + KO_SMALL[smallIdx] + chunkStr;
        c = Math.floor(c / 10);
        smallIdx += 1;
      }
      result = chunkStr + KO_BIG[bigIdx] + result;
    }
    num = Math.floor(num / 10000);
    bigIdx += 1;
  }
  return `금 ${result}원정`;
}
