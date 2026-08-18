'use client';

import { formatKRW } from '@/lib/work-ledger/calc';

interface Props {
  yearly: { year: number; amount: number }[];
  currentYear: number;
}

export function YearlyRevenueChart({ yearly, currentYear }: Props) {
  const max = Math.max(1, ...yearly.map((y) => y.amount));
  const chartH = 200;
  const groupW = 60;
  const barW = 26;
  const leftPad = 8;
  const totalW = leftPad + groupW * yearly.length;

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h3 className="mb-4 text-[14px] font-semibold text-foreground">연간 매출 추이 · {yearly[0]?.year}~{yearly[yearly.length - 1]?.year} (수금 기준)</h3>
      <div className="overflow-x-auto">
        <svg width={totalW} height={chartH + 40} className="block min-w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <line key={r} x1={0} y1={chartH - r * chartH} x2={totalW} y2={chartH - r * chartH} className="stroke-border" strokeWidth={1} strokeDasharray={r === 0 ? '' : '3 3'} />
          ))}
          {yearly.map((y, i) => {
            const h = (y.amount / max) * chartH;
            const x = leftPad + i * groupW + (groupW - barW) / 2;
            const isCurrent = y.year === currentYear;
            return (
              <g key={y.year}>
                <rect x={x} y={chartH - h} width={barW} height={h} rx={4} fill={isCurrent ? '#2E6FF2' : '#93B4F5'}>
                  <title>{y.year}년: {formatKRW(y.amount)}</title>
                </rect>
                <text x={leftPad + i * groupW + groupW / 2} y={chartH + 18} textAnchor="middle" className={isCurrent ? 'fill-foreground text-[11px] font-semibold' : 'fill-foreground-tertiary text-[11px]'}>{y.year}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
