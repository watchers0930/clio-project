'use client';

import { useMemo } from 'react';
import type { FixedExpense, MonthlyExpense } from '@/lib/bulk-transfer/types';
import { currentMonth, prevMonth, monthLabel } from '@/lib/bulk-transfer/month-utils';

interface Props {
  fixedExpenses: FixedExpense[];
  monthlyExpenses: MonthlyExpense[];
}

const BAR_MAX_PX = 200;

export function ExpenseComparison({ fixedExpenses, monthlyExpenses }: Props) {
  const data = useMemo(() => {
    const cur = currentMonth();
    const prev = prevMonth(cur);
    const fixedTotal = fixedExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const sumMonth = (m: string) =>
      monthlyExpenses.filter((e) => e.month === m).reduce((s, e) => s + Number(e.amount), 0);
    const prevMonthly = sumMonth(prev);
    const curMonthly = sumMonth(cur);
    const prevTotal = fixedTotal + prevMonthly;
    const curTotal = fixedTotal + curMonthly;
    return { cur, prev, fixedTotal, prevMonthly, curMonthly, prevTotal, curTotal };
  }, [fixedExpenses, monthlyExpenses]);

  const max = Math.max(data.prevTotal, data.curTotal, 1);
  const barPx = (v: number) => Math.max(v > 0 ? 4 : 0, Math.round((v / max) * BAR_MAX_PX));
  const diff = data.curTotal - data.prevTotal;
  const diffCls = diff > 0 ? 'text-red-500' : diff < 0 ? 'text-blue-600' : 'text-foreground-quaternary';
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-[13px] text-foreground-secondary">
        전월과 당월의 총지출(고정지출 + 해당 월 월지출)을 비교합니다.
      </div>

      {/* 막대 그래프 */}
      <div className="rounded-xl border border-border bg-white px-6 py-6">
        <div className="flex items-end justify-center gap-10" style={{ height: `${BAR_MAX_PX + 36}px` }}>
          {/* 전월 */}
          <div className="flex flex-col items-center justify-end">
            <span className="mb-2 font-mono text-[13px] font-medium text-foreground">{won(data.prevTotal)}</span>
            <div
              className="rounded-t-lg bg-gray-300"
              style={{ width: '72px', height: `${barPx(data.prevTotal)}px` }}
              title={`전월 ${won(data.prevTotal)}`}
            />
          </div>
          {/* 당월 */}
          <div className="flex flex-col items-center justify-end">
            <span className="mb-2 font-mono text-[13px] font-semibold text-foreground">{won(data.curTotal)}</span>
            <div
              className="rounded-t-lg bg-sidebar"
              style={{ width: '72px', height: `${barPx(data.curTotal)}px` }}
              title={`당월 ${won(data.curTotal)}`}
            />
          </div>
        </div>
        {/* 범례(월 라벨) */}
        <div className="mt-3 flex justify-center gap-10">
          <div className="flex w-[72px] flex-col items-center">
            <span className="flex items-center gap-1 text-[12px] text-foreground-secondary">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-300" /> 전월
            </span>
            <span className="text-[11px] text-foreground-quaternary">{monthLabel(data.prev)}</span>
          </div>
          <div className="flex w-[72px] flex-col items-center">
            <span className="flex items-center gap-1 text-[12px] font-medium text-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sidebar" /> 당월
            </span>
            <span className="text-[11px] text-foreground-quaternary">{monthLabel(data.cur)}</span>
          </div>
        </div>
      </div>

      {/* 증감 요약 */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary px-5 py-4">
        <span className="text-[13px] font-medium text-foreground-secondary">전월 대비 증감</span>
        <span className={`font-mono text-[18px] font-semibold ${diffCls}`}>
          {diff > 0 ? '+' : ''}
          {won(diff)}
        </span>
      </div>

      {/* 세부 내역 */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full table-fixed text-[13px]">
          <colgroup>
            <col className="w-[40%]" />
            <col className="w-[30%]" />
            <col className="w-[30%]" />
          </colgroup>
          <thead>
            <tr className="bg-surface-secondary">
              <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">구분</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground-secondary">{monthLabel(data.prev)}</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground">{monthLabel(data.cur)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            <tr>
              <td className="px-4 py-3 text-foreground-secondary">고정지출</td>
              <td className="px-4 py-3 text-right font-mono text-foreground">{won(data.fixedTotal)}</td>
              <td className="px-4 py-3 text-right font-mono text-foreground">{won(data.fixedTotal)}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-foreground-secondary">월지출</td>
              <td className="px-4 py-3 text-right font-mono text-foreground">{won(data.prevMonthly)}</td>
              <td className="px-4 py-3 text-right font-mono text-foreground">{won(data.curMonthly)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-surface-secondary/60">
              <td className="px-4 py-3 text-left font-semibold text-foreground">총지출</td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{won(data.prevTotal)}</td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{won(data.curTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
