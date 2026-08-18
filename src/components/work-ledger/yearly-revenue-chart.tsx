'use client';

import { axisTicks, formatKRW, formatManwon, formatNumber, toKoreanMoney } from '@/lib/work-ledger/calc';

interface Props {
  yearly: { year: number; amount: number }[];
  currentYear: number;
}

const STEP = 50_000_000;
const AXIS_W = 56;
const CHART_H = 200;
const TOP_PAD = 30;

export function YearlyRevenueChart({ yearly, currentYear }: Props) {
  const max = Math.max(1, ...yearly.map((y) => y.amount));
  const ticks = axisTicks(max, STEP);
  const top = ticks[ticks.length - 1];
  const labelEvery = Math.ceil(ticks.length / 9);
  const groupW = 56;
  const barW = 26;
  const leftPad = 6;
  const plotW = leftPad + groupW * yearly.length;
  const totalW = AXIS_W + plotW;

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h3 className="mb-4 text-[14px] font-semibold text-foreground">연간 매출 추이 · {yearly[0]?.year}~{yearly[yearly.length - 1]?.year} <span className="font-normal text-foreground-tertiary">(단위: 만원)</span></h3>
      <div className="overflow-x-auto">
        <svg width={totalW} height={CHART_H + TOP_PAD + 24} className="block min-w-full">
          <text x={AXIS_W - 6} y={TOP_PAD - 6} textAnchor="end" className="fill-foreground-quaternary text-[9px]">(만원)</text>
          {ticks.map((t, ti) => {
            const y = TOP_PAD + CHART_H - (t / top) * CHART_H;
            return (
              <g key={t}>
                <line x1={AXIS_W} y1={y} x2={totalW} y2={y} className="stroke-border" strokeWidth={1} strokeDasharray={t === 0 ? '' : '3 3'} />
                {ti % labelEvery === 0 && (
                  <text x={AXIS_W - 6} y={y + 3} textAnchor="end" className="fill-foreground-quaternary text-[10px]">{formatManwon(t)}</text>
                )}
              </g>
            );
          })}
          {yearly.map((y, i) => {
            const h = (y.amount / top) * CHART_H;
            const barTop = TOP_PAD + CHART_H - h;
            const cx = AXIS_W + leftPad + i * groupW + groupW / 2;
            const x = cx - barW / 2;
            const isCurrent = y.year === currentYear;
            return (
              <g key={y.year}>
                <rect x={x} y={barTop} width={barW} height={h} rx={4} fill={isCurrent ? '#2E6FF2' : '#93B4F5'}>
                  <title>{y.year}년: {formatKRW(y.amount)}</title>
                </rect>
                {y.amount > 0 && (
                  <>
                    <text x={cx} y={Math.max(barTop - 13, 12)} textAnchor="middle" className="fill-foreground text-[9px] font-semibold">{formatNumber(y.amount)}</text>
                    <text x={cx} y={Math.max(barTop - 4, 21)} textAnchor="middle" className="fill-foreground-tertiary text-[8px]">{toKoreanMoney(y.amount)}</text>
                  </>
                )}
                <text x={cx} y={TOP_PAD + CHART_H + 18} textAnchor="middle" className={isCurrent ? 'fill-foreground text-[11px] font-semibold' : 'fill-foreground-tertiary text-[11px]'}>{y.year}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
