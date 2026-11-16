// 관리비 - 금액 계산·월별/연도별 집계 (순수 함수, 서버·화면 공용)
import type { FeeEntry, FeeItem, MonthlyView, YearlyRow, YearlyView } from './types';

/** 부호를 살린 원 단위 반올림. 곱셈 부동소수 오차(1.15×100=114.999…)를 먼저 없앤다. */
function roundWon(x: number): number {
  const raw = Number(x.toFixed(6));
  return Math.sign(raw) * Math.round(Math.abs(raw));
}

/** 사용량 × 단가 → 원 단위. 둘 중 하나라도 없으면 null. */
export function computeAmount(usage: number | null, unitPrice: number | null): number | null {
  if (usage === null || unitPrice === null) return null;
  return roundWon(usage * unitPrice) || 0;
}

/**
 * 저장할 금액 결정 (서버가 단일 기준).
 * - 직접 입력(amount_overridden): 넘어온 금액을 그대로 쓴다 — 사용량·단가가 바뀌어도 덮어쓰지 않는다.
 * - 자동: 사용량·단가가 있으면 계산값, 없으면(일반관리비 등) 넘어온 금액.
 */
export function resolveAmount(i: {
  usage: number | null;
  unit_price: number | null;
  amount: number | null;
  amount_overridden: boolean;
}): { amount: number; amount_overridden: boolean } | { error: string } {
  if (i.amount_overridden) {
    if (i.amount === null) return { error: '직접 입력한 금액이 없습니다.' };
    return { amount: i.amount, amount_overridden: true };
  }
  const computed = computeAmount(i.usage, i.unit_price);
  if (computed !== null) return { amount: computed, amount_overridden: false };
  if (i.amount === null) return { error: '금액을 입력하거나 사용량과 단가를 함께 입력해 주세요.' };
  return { amount: i.amount, amount_overridden: false };
}

/** 'YYYY-MM' 의 전월. */
export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function byOrder(a: FeeItem, b: FeeItem): number {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ko');
}

/** 월별 표: 그 달 기록이 있는 항목만, 전월 대비 포함. */
export function buildMonthlyView(items: FeeItem[], entries: FeeEntry[], month: string): MonthlyView {
  const prev = prevMonth(month);
  const itemById = new Map(items.map((it) => [it.id, it]));
  const prevByItem = new Map(entries.filter((e) => e.month === prev).map((e) => [e.item_id, e.amount]));
  const rows = entries
    .filter((e) => e.month === month && itemById.has(e.item_id))
    .map((entry) => {
      const prevAmount = prevByItem.get(entry.item_id) ?? null;
      return {
        item: itemById.get(entry.item_id) as FeeItem,
        entry,
        prevAmount,
        diff: prevAmount === null ? null : entry.amount - prevAmount,
      };
    })
    .sort((a, b) => byOrder(a.item, b.item));
  const total = rows.reduce((s, r) => s + r.entry.amount, 0);
  const prevTotal = prevByItem.size ? [...prevByItem.values()].reduce((s, v) => s + v, 0) : null;
  return { rows, total, prevTotal };
}

/** 연도별 표: 그 연도에 기록이 1건 이상인 항목(숨김 포함) × 1~12월. */
export function buildYearlyView(items: FeeItem[], entries: FeeEntry[], year: number): YearlyView {
  const prefix = `${year}-`;
  const yearEntries = entries.filter((e) => e.month.startsWith(prefix));
  const monthTotals = Array<number>(12).fill(0);
  const rows: YearlyRow[] = [];
  for (const item of [...items].sort(byOrder)) {
    const own = yearEntries.filter((e) => e.item_id === item.id);
    if (!own.length) continue;
    const months = Array<number | null>(12).fill(null);
    let usageSum = 0;
    let usageAmount = 0;
    let hasUsage = false;
    for (const e of own) {
      const idx = Number(e.month.slice(5, 7)) - 1;
      months[idx] = e.amount;
      monthTotals[idx] += e.amount;
      if (e.usage !== null) {
        hasUsage = true;
        usageSum += e.usage;
        usageAmount += e.amount;
      }
    }
    rows.push({
      item,
      months,
      usageTotal: hasUsage ? Number(usageSum.toFixed(3)) : null,
      avgUnitPrice: hasUsage && usageSum > 0 ? Math.round((usageAmount / usageSum) * 100) / 100 : null,
      amountTotal: own.reduce((s, e) => s + e.amount, 0),
    });
  }
  return { rows, monthTotals, grandTotal: monthTotals.reduce((s, v) => s + v, 0) };
}
