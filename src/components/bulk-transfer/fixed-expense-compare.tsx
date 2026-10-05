'use client';

import { useMemo } from 'react';
import type { FixedExpense } from '@/lib/bulk-transfer/types';

interface Props {
  expenses: FixedExpense[];
}

/** 'YYYY-MM' → 'YY.MM' 짧은 표기 */
function shortMonth(m: string): string {
  const [y, mm] = m.split('-');
  return `${y.slice(2)}.${mm}`;
}

export function FixedExpenseCompare({ expenses }: Props) {
  const { months, rows, monthTotals, totalAll, unassigned } = useMemo(() => {
    const withMonth = expenses.filter((e) => e.month);
    const unassignedCount = expenses.length - withMonth.length;

    const monthSet = new Set<string>();
    const labelSet = new Set<string>();
    const cell = new Map<string, number>(); // `${label}__${month}` → 합계
    const labelTotal = new Map<string, number>();
    const mTotals = new Map<string, number>();

    for (const e of withMonth) {
      const m = e.month as string;
      const amt = Number(e.amount);
      monthSet.add(m);
      labelSet.add(e.label);
      const key = `${e.label}__${m}`;
      cell.set(key, (cell.get(key) ?? 0) + amt);
      labelTotal.set(e.label, (labelTotal.get(e.label) ?? 0) + amt);
      mTotals.set(m, (mTotals.get(m) ?? 0) + amt);
    }

    const monthsArr = [...monthSet].sort(); // 오름차순 (과거 → 최근)
    // 항목은 총액 큰 순
    const labelsArr = [...labelSet].sort((a, b) => (labelTotal.get(b) ?? 0) - (labelTotal.get(a) ?? 0));

    const rowsArr = labelsArr.map((label) => ({
      label,
      values: monthsArr.map((m) => cell.get(`${label}__${m}`) ?? null),
      total: labelTotal.get(label) ?? 0,
    }));

    return {
      months: monthsArr,
      rows: rowsArr,
      monthTotals: monthsArr.map((m) => mTotals.get(m) ?? 0),
      totalAll: withMonth.reduce((s, e) => s + Number(e.amount), 0),
      unassigned: unassignedCount,
    };
  }, [expenses]);

  if (months.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-[13px] text-foreground-secondary">
          월별로 고정지출을 비교합니다. &lsquo;월 고정지출&rsquo; 탭에서 적용 월을 지정해 항목을 추가하면 자동으로 표가 만들어집니다.
        </div>
        <div className="rounded-xl border border-border bg-white py-14 text-center text-[13px] text-foreground-tertiary">
          비교할 월별 데이터가 없습니다.
          {unassigned > 0 && <span className="block mt-1 text-foreground-quaternary">(월 미지정 항목 {unassigned}건은 비교표에서 제외됩니다.)</span>}
        </div>
      </div>
    );
  }

  const fmt = (n: number | null) => (n == null ? '—' : n.toLocaleString('ko-KR'));

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[13px] text-foreground-secondary">
        항목별 월 지출을 나란히 비교합니다. 가장 아래 행은 월 합계와 전월 대비 증감입니다.
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-[13px]">
          <thead>
            <tr className="bg-surface-secondary">
              <th className="sticky left-0 z-10 bg-surface-secondary px-4 py-3 text-left font-semibold text-foreground-secondary">
                항목
              </th>
              {months.map((m) => (
                <th key={m} className="whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground-secondary">
                  {shortMonth(m)}
                </th>
              ))}
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">합계</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {rows.map((r) => (
              <tr key={r.label} className="hover:bg-surface-secondary/50 transition-colors">
                <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.label}</td>
                {r.values.map((v, i) => (
                  <td key={i} className={`px-4 py-3 text-right font-mono ${v == null ? 'text-foreground-quaternary' : 'text-foreground'}`}>
                    {fmt(v)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-mono font-medium text-foreground">{fmt(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {/* 월 합계 */}
            <tr className="border-t-2 border-border bg-surface-secondary/60">
              <td className="sticky left-0 z-10 bg-surface-secondary/60 px-4 py-3 text-left font-semibold text-foreground">월 합계</td>
              {monthTotals.map((t, i) => (
                <td key={i} className="px-4 py-3 text-right font-mono font-semibold text-foreground">{t.toLocaleString('ko-KR')}</td>
              ))}
              <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{totalAll.toLocaleString('ko-KR')}</td>
            </tr>
            {/* 전월 대비 */}
            <tr className="bg-white">
              <td className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-[12px] font-medium text-foreground-secondary">전월 대비</td>
              {monthTotals.map((t, i) => {
                if (i === 0) return <td key={i} className="px-4 py-3 text-right text-[12px] text-foreground-quaternary">—</td>;
                const diff = t - monthTotals[i - 1];
                const cls = diff > 0 ? 'text-red-500' : diff < 0 ? 'text-blue-600' : 'text-foreground-quaternary';
                const sign = diff > 0 ? '+' : '';
                return (
                  <td key={i} className={`px-4 py-3 text-right font-mono text-[12px] ${cls}`}>
                    {diff === 0 ? '0' : `${sign}${diff.toLocaleString('ko-KR')}`}
                  </td>
                );
              })}
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[11px] text-foreground-quaternary">
        항목 {rows.length}종 · {months.length}개월 비교
        {unassigned > 0 && ` · 월 미지정 ${unassigned}건 제외`}
      </p>
    </div>
  );
}
