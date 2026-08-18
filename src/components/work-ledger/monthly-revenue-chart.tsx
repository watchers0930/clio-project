'use client';

import { formatKRW } from '@/lib/work-ledger/calc';

interface Props {
  monthly: number[];
  year: number;
}

export function MonthlyRevenueChart({ monthly, year }: Props) {
  const max = Math.max(1, ...monthly);
  const chartH = 200;
  const groupW = 56;
  const barW = 22;
  const leftPad = 8;
  const totalW = leftPad + groupW * 12;

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h3 className="mb-4 text-[14px] font-semibold text-foreground">월별 매출 추이 · {year}년 (수금 기준)</h3>
      <div className="overflow-x-auto">
        <svg width={totalW} height={chartH + 40} className="block min-w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <line key={r} x1={0} y1={chartH - r * chartH} x2={totalW} y2={chartH - r * chartH} className="stroke-border" strokeWidth={1} strokeDasharray={r === 0 ? '' : '3 3'} />
          ))}
          {monthly.map((val, i) => {
            const h = (val / max) * chartH;
            const x = leftPad + i * groupW + (groupW - barW) / 2;
            return (
              <g key={i}>
                <rect x={x} y={chartH - h} width={barW} height={h} rx={4} fill="#2E6FF2">
                  <title>{year}년 {i + 1}월: {formatKRW(val)}</title>
                </rect>
                <text x={leftPad + i * groupW + groupW / 2} y={chartH + 18} textAnchor="middle" className="fill-foreground-tertiary text-[11px]">{i + 1}월</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
