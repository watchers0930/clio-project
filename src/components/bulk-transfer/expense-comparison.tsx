'use client';

import { useMemo } from 'react';
import type { FixedExpense, MonthlyExpense } from '@/lib/bulk-transfer/types';
import { currentMonth, monthLabel, monthRange } from '@/lib/bulk-transfer/month-utils';
import { layoutBars } from '@/lib/bulk-transfer/bar-scale';

interface Props {
  fixedExpenses: FixedExpense[];
  monthlyExpenses: MonthlyExpense[];
}

interface MonthRow {
  month: string;
  monthly: number;
  total: number;
  /** 전월 대비 증감 (첫 달은 비교 대상이 없어 null) */
  diff: number | null;
}

const BAR_MAX_PX = 200;

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const diffCls = (d: number) =>
  d > 0 ? 'text-red-500' : d < 0 ? 'text-blue-600' : 'text-foreground-quaternary';
const signed = (d: number) => `${d > 0 ? '+' : ''}${won(d)}`;

export function ExpenseComparison({ fixedExpenses, monthlyExpenses }: Props) {
  const data = useMemo(() => {
    const cur = currentMonth();
    const fixedTotal = fixedExpenses.reduce((s, e) => s + Number(e.amount), 0);

    const byMonth = new Map<string, number>();
    for (const e of monthlyExpenses) {
      byMonth.set(e.month, (byMonth.get(e.month) ?? 0) + Number(e.amount));
    }

    // 월지출이 처음 등록된 달 ~ 마지막 달(당월 포함)까지 빈 달 없이 모두 표시
    const keys = [...byMonth.keys(), cur].sort();
    const months = monthRange(keys[0], keys[keys.length - 1]);

    const rows: MonthRow[] = months.map((month) => {
      const monthly = byMonth.get(month) ?? 0;
      return { month, monthly, total: fixedTotal + monthly, diff: null };
    });
    rows.forEach((r, i) => {
      if (i > 0) r.diff = r.total - rows[i - 1].total;
    });

    const sumTotal = rows.reduce((s, r) => s + r.total, 0);
    const sumMonthly = rows.reduce((s, r) => s + r.monthly, 0);
    const avgTotal = rows.length ? Math.round(sumTotal / rows.length) : 0;
    const peak = rows.reduce<MonthRow | null>((p, r) => (!p || r.total > p.total ? r : p), null);
    const curRow = rows.find((r) => r.month === cur) ?? null;

    return { cur, fixedTotal, rows, sumTotal, sumMonthly, avgTotal, peak, curRow };
  }, [fixedExpenses, monthlyExpenses]);

  const bars = layoutBars(
    data.rows.map((r) => r.total),
    data.fixedTotal,
    BAR_MAX_PX,
  );
  const anyBroken = bars.some((b) => b.broken);

  return (
    <div className="flex flex-col gap-5">
      <div className="text-[13px] text-foreground-secondary">
        월별 총지출(고정지출 + 해당 월 월지출)을 전체 기간으로 비교합니다. 고정지출은 현재 등록된 금액을 모든 달에
        동일하게 적용합니다.
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label={`기간 총지출 (${data.rows.length}개월)`} value={won(data.sumTotal)} />
        <SummaryCard label="월평균 총지출" value={won(data.avgTotal)} />
        <SummaryCard
          label="최대 지출 월"
          value={data.peak ? won(data.peak.total) : '—'}
          sub={data.peak ? monthLabel(data.peak.month) : undefined}
        />
        <SummaryCard
          label="당월 전월 대비"
          value={data.curRow?.diff != null ? signed(data.curRow.diff) : '—'}
          valueCls={data.curRow?.diff != null ? diffCls(data.curRow.diff) : undefined}
          sub={monthLabel(data.cur)}
        />
      </div>

      {/* 막대 그래프 (월이 많으면 가로 스크롤) */}
      <div className="rounded-xl border border-border bg-white px-6 py-6">
        <div className="overflow-x-auto">
          <div className="mx-auto flex w-max items-end gap-6" style={{ height: `${BAR_MAX_PX + 36}px` }}>
            {data.rows.map((r, i) => {
              const isCur = r.month === data.cur;
              const bar = bars[i];
              return (
                <div key={r.month} className="flex w-[84px] flex-col items-center justify-end">
                  <span
                    className={`mb-2 whitespace-nowrap font-mono text-[11px] ${isCur ? 'font-semibold text-foreground' : 'text-foreground-secondary'}`}
                  >
                    {r.total.toLocaleString('ko-KR')}
                  </span>
                  <div
                    className="relative"
                    title={`${monthLabel(r.month)} 총지출 ${won(r.total)} (고정 ${won(data.fixedTotal)} + 월지출 ${won(r.monthly)})${bar.broken ? ' · 막대 중간 생략' : ''}`}
                  >
                    <div
                      className="flex w-[56px] flex-col justify-end overflow-hidden rounded-t-lg"
                      style={{ height: `${bar.heightPx}px` }}
                    >
                      <div className={`flex-1 ${isCur ? 'bg-sidebar/60' : 'bg-gray-200'}`} />
                      <div className={isCur ? 'bg-sidebar' : 'bg-gray-400'} style={{ height: `${bar.fixedPx}px` }} />
                    </div>
                    {bar.broken && <BarBreak top={Math.round((bar.heightPx - bar.fixedPx) * 0.4)} />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mx-auto mt-3 flex w-max gap-6">
            {data.rows.map((r) => (
              <span
                key={r.month}
                className={`w-[84px] text-center text-[11px] ${r.month === data.cur ? 'font-semibold text-foreground' : 'text-foreground-quaternary'}`}
              >
                {monthLabel(r.month)}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-5 text-[12px] text-foreground-secondary">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-400" /> 고정지출
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-200" /> 월지출
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sidebar" /> 당월
          </span>
          {anyBroken && (
            <span className="flex items-center gap-1 text-foreground-quaternary">
              <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
                <path d="M0 4 L14 0 M0 10 L14 6" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              유난히 큰 달은 막대 중간 생략
            </span>
          )}
        </div>
      </div>

      {/* 월별 세부 내역 */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] table-fixed text-[13px]">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr className="bg-surface-secondary">
              <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">월</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground-secondary">고정지출</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground-secondary">월지출</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground">총지출</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground-secondary">전월 대비</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {[...data.rows].reverse().map((r) => {
              const isCur = r.month === data.cur;
              return (
                <tr key={r.month} className={isCur ? 'bg-surface-secondary/40' : undefined}>
                  <td className={`px-4 py-3 ${isCur ? 'font-semibold text-foreground' : 'text-foreground-secondary'}`}>
                    {monthLabel(r.month)}
                    {isCur && <span className="ml-1.5 text-[11px] font-normal text-foreground-quaternary">당월</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{won(data.fixedTotal)}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{won(r.monthly)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{won(r.total)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${r.diff != null ? diffCls(r.diff) : 'text-foreground-quaternary'}`}>
                    {r.diff != null ? signed(r.diff) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-surface-secondary/60">
              <td className="px-4 py-3 text-left font-semibold text-foreground">합계</td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                {won(data.fixedTotal * data.rows.length)}
              </td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{won(data.sumMonthly)}</td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{won(data.sumTotal)}</td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** 막대 중간 생략 표시: 막대보다 살짝 넓은 흰 사선 띠 + 테두리 선 */
function BarBreak({ top }: { top: number }) {
  return (
    <svg
      className="pointer-events-none absolute -left-[6px]"
      style={{ top: `${top}px` }}
      width="68"
      height="14"
      viewBox="0 0 68 14"
      aria-hidden="true"
    >
      <polygon points="0,6 68,0 68,8 0,14" fill="white" />
      <line x1="0" y1="6" x2="68" y2="0" stroke="#9ca3af" strokeWidth="1.5" />
      <line x1="0" y1="14" x2="68" y2="8" stroke="#9ca3af" strokeWidth="1.5" />
    </svg>
  );
}

function SummaryCard({ label, value, sub, valueCls }: { label: string; value: string; sub?: string; valueCls?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3">
      <div className="text-[12px] text-foreground-secondary">{label}</div>
      <div className={`mt-1 font-mono text-[16px] font-semibold ${valueCls ?? 'text-foreground'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-foreground-quaternary">{sub}</div>}
    </div>
  );
}
