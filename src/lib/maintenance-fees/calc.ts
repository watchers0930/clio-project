// 관리비 - 금액 계산·월별/연도별 집계 (순수 함수, 서버·화면 공용)
import { TAX_TYPES } from './types';
import type { FeeEntry, FeeItem, MonthlyLine, MonthlyRow, MonthlyView, TaxType, YearlyLine, YearlyRow, YearlyView } from './types';

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
/** DB amount numeric(15,0) 에 들어가는 범위 */
export const MAX_ABS_AMOUNT = 1e13;

export function resolveAmount(i: {
  usage: number | null;
  unit_price: number | null;
  amount: number | null;
  amount_overridden: boolean;
}): { amount: number; amount_overridden: boolean } | { error: string } {
  const tooLarge = { error: '금액이 너무 큽니다. 사용량과 단가를 확인해 주세요.' };
  if (i.amount_overridden) {
    if (i.amount === null) return { error: '직접 입력한 금액이 없습니다.' };
    if (Math.abs(i.amount) > MAX_ABS_AMOUNT) return tooLarge;
    return { amount: i.amount, amount_overridden: true };
  }
  const computed = computeAmount(i.usage, i.unit_price);
  if (computed !== null) return Math.abs(computed) > MAX_ABS_AMOUNT ? tooLarge : { amount: computed, amount_overridden: false };
  if (i.amount === null) return { error: '금액을 입력하거나 사용량과 단가를 함께 입력해 주세요.' };
  if (Math.abs(i.amount) > MAX_ABS_AMOUNT) return tooLarge;
  return { amount: i.amount, amount_overridden: false };
}

/** 'YYYY-MM' 의 전월. */
export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** 항목 표시 순서 단일 기준: 구분(과세 → 부가세 → 비과세) → sort_order → 이름 */
export function compareFeeItems(a: FeeItem, b: FeeItem): number {
  return TAX_TYPES.indexOf(a.tax_type) - TAX_TYPES.indexOf(b.tax_type) || a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ko');
}

export function sortFeeItems(items: FeeItem[]): FeeItem[] {
  return [...items].sort(compareFeeItems);
}

/**
 * 같은 구분 안에서 항목 하나를 위(-1)·아래(+1)로 옮긴 전체 순서(id 목록). 옮길 수 없으면 null.
 * 서버(reorder)는 이 목록 위치를 sort_order 로 저장한다.
 */
export function moveFeeItem(items: FeeItem[], id: string, delta: -1 | 1): string[] | null {
  const sorted = sortFeeItems(items);
  const from = sorted.findIndex((it) => it.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= sorted.length || sorted[to].tax_type !== sorted[from].tax_type) return null;
  [sorted[from], sorted[to]] = [sorted[to], sorted[from]];
  return sorted.map((it) => it.id);
}

const sumOrNull = (vals: (number | null | undefined)[]): number | null => {
  const present = vals.filter((v): v is number => v !== null && v !== undefined);
  return present.length ? present.reduce((s, v) => s + v, 0) : null;
};

/**
 * 고지서 순서의 줄: [과세 머리줄, 과세 항목…, 공급가액] [부가세…, 과세합] [비과세 머리줄, 비과세 항목…, 비과세합]
 * 묶음에 항목이 없으면 그 묶음 줄을 만들지 않는다. 소계 금액은 make.subtotal 이 구분 목록으로 계산한다.
 */
function buildLines<R extends { item: FeeItem }, L>(
  rows: R[],
  make: {
    header: (t: TaxType) => L;
    item: (r: R) => L;
    subtotal: (key: 'supply' | 'taxTotal' | 'exemptTotal', types: TaxType[]) => L;
  },
): L[] {
  const of = (t: TaxType) => rows.filter((r) => r.item.tax_type === t);
  const taxable = of('taxable');
  const vat = of('vat');
  const exempt = of('exempt');
  const lines: L[] = [];
  // 부가세만 있는 달도 과세 묶음 머리줄로 시작한다(고지서와 같은 모양)
  if (taxable.length || vat.length) lines.push(make.header('taxable'));
  if (taxable.length) lines.push(...taxable.map(make.item), make.subtotal('supply', ['taxable']));
  lines.push(...vat.map(make.item));
  if (taxable.length || vat.length) lines.push(make.subtotal('taxTotal', ['taxable', 'vat']));
  if (exempt.length) lines.push(make.header('exempt'), ...exempt.map(make.item), make.subtotal('exemptTotal', ['exempt']));
  return lines;
}

/** 월별 표: 그 달 기록이 있는 항목만, 전월 대비·고지서 순서 소계 포함. */
export function buildMonthlyView(items: FeeItem[], entries: FeeEntry[], month: string): MonthlyView {
  const prev = prevMonth(month);
  const itemById = new Map(items.map((it) => [it.id, it]));
  const prevByItem = new Map(entries.filter((e) => e.month === prev).map((e) => [e.item_id, e.amount]));
  const rows: MonthlyRow[] = entries
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
    .sort((a, b) => compareFeeItems(a.item, b.item));
  // 전월 소계는 이번 달 줄과 상관없이 그 구분 항목의 전월 기록 전부로 센다
  const prevSum = (types: TaxType[]) =>
    sumOrNull([...prevByItem].filter(([id]) => types.includes(itemById.get(id)?.tax_type as TaxType)).map(([, v]) => v));
  const sum = (types: TaxType[]) => rows.filter((r) => types.includes(r.item.tax_type)).reduce((s, r) => s + r.entry.amount, 0);
  const lines = buildLines<MonthlyRow, MonthlyLine>(rows, {
    header: (taxType) => ({ kind: 'header', taxType }),
    item: (row) => ({ kind: 'item', row }),
    subtotal: (key, types) => ({ kind: 'subtotal', key, amount: sum(types), prevAmount: prevSum(types) }),
  });
  const total = rows.reduce((s, r) => s + r.entry.amount, 0);
  const prevTotal = prevByItem.size ? [...prevByItem.values()].reduce((s, v) => s + v, 0) : null;
  return { rows, lines, supply: sum(['taxable']), total, prevTotal };
}

/** 연도별 표: 그 연도에 기록이 1건 이상인 항목(숨김 포함) × 1~12월, 고지서 순서 소계 포함. */
export function buildYearlyView(items: FeeItem[], entries: FeeEntry[], year: number): YearlyView {
  const prefix = `${year}-`;
  const yearEntries = entries.filter((e) => e.month.startsWith(prefix));
  const monthTotals = Array<number>(12).fill(0);
  const rows: YearlyRow[] = [];
  for (const item of sortFeeItems(items)) {
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
  const lines = buildLines<YearlyRow, YearlyLine>(rows, {
    header: (taxType) => ({ kind: 'header', taxType }),
    item: (row) => ({ kind: 'item', row }),
    subtotal: (key, types) => {
      const group = rows.filter((r) => types.includes(r.item.tax_type));
      const months = Array.from({ length: 12 }, (_, i) => sumOrNull(group.map((r) => r.months[i])));
      return { kind: 'subtotal', key, months, total: group.reduce((s, r) => s + r.amountTotal, 0) };
    },
  });
  return { rows, lines, monthTotals, grandTotal: monthTotals.reduce((s, v) => s + v, 0) };
}

/** 월별 추이 그래프 값 — itemId 가 null 이면 전체 부과액 합계. 그 달 기록이 하나도 없으면 null(빈 막대). */
export function buildTrendSeries(view: YearlyView, itemId: string | null): (number | null)[] {
  if (itemId) return view.rows.find((r) => r.item.id === itemId)?.months ?? Array(12).fill(null);
  return view.monthTotals.map((v, i) => (view.rows.every((r) => r.months[i] === null) ? null : v));
}
