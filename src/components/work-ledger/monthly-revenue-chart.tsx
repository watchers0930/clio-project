'use client';

import { axisTicks, formatKRW, formatManwon, formatNumber, toKoreanMoney } from '@/lib/work-ledger/calc';

interface Props {
  monthly: number[];
  year: number;
}

const STEP = 10_000_000;
const AXIS_W = 48;
const CHART_H = 200;
const TOP_PAD = 30;

export function MonthlyRevenueChart({ monthly, year }: Props) {
  const max = Math.max(1, ...monthly);
  const ticks = axisTicks(max, STEP);
  const top = ticks[ticks.length - 1];
  const labelEvery = Math.ceil(ticks.length / 9);
  const groupW = 40;
  const barW = 16;
  const leftPad = 6;
  const plotW = leftPad + groupW * 12;
  const totalW = AXIS_W + plotW;

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h3 className="mb-4 text-[14px] font-semibold text-foreground">월별 매출 추이 · {year}년 <span className="font-normal text-foreground-tertiary">(단위: 만원)</span></h3>
      <svg viewBox={`0 0 ${totalW} ${CHART_H + TOP_PAD + 24}`} width="100%" preserveAspectRatio="xMidYMid meet" className="block">
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
        {monthly.map((val, i) => {
          const h = (val / top) * CHART_H;
          const barTop = TOP_PAD + CHART_H - h;
          const cx = AXIS_W + leftPad + i * groupW + groupW / 2;
          const x = cx - barW / 2;
          return (
            <g key={i}>
              <rect x={x} y={barTop} width={barW} height={h} rx={4} fill="#2E6FF2">
                <title>{year}년 {i + 1}월: {formatKRW(val)}</title>
              </rect>
              {val > 0 && (
                <>
                  <text x={cx} y={Math.max(barTop - 13, 12)} textAnchor="middle" className="fill-foreground text-[9px] font-semibold">{formatNumber(val)}</text>
                  <text x={cx} y={Math.max(barTop - 4, 21)} textAnchor="middle" className="fill-foreground-tertiary text-[8px]">{toKoreanMoney(val)}</text>
                </>
              )}
              <text x={cx} y={TOP_PAD + CHART_H + 18} textAnchor="middle" className="fill-foreground-tertiary text-[11px]">{i + 1}월</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
