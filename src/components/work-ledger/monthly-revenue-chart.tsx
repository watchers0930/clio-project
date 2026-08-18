'use client';

import { formatKRW } from '@/lib/work-ledger/calc';

interface Props {
  monthlyCurrent: number[];
  monthlyPrevious: number[];
  year: number;
  prevYear: number;
}

export function MonthlyRevenueChart({ monthlyCurrent, monthlyPrevious, year, prevYear }: Props) {
  const max = Math.max(1, ...monthlyCurrent, ...monthlyPrevious);
  const chartH = 200;
  const groupW = 56;      // 월별 그룹 폭
  const barW = 18;        // 막대 폭
  const gap = 6;          // 그룹 내 막대 간격
  const leftPad = 8;
  const totalW = leftPad + groupW * 12;

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-foreground">월별 매출 추이 (수금 기준)</h3>
        <div className="flex items-center gap-4 text-[12px] text-foreground-secondary">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#2E6FF2' }} />{year}년</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#C7CDD6' }} />{prevYear}년</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width={totalW} height={chartH + 40} className="block min-w-full">
          {/* 가로 기준선 */}
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <line key={r} x1={0} y1={chartH - r * chartH} x2={totalW} y2={chartH - r * chartH} className="stroke-border" strokeWidth={1} strokeDasharray={r === 0 ? '' : '3 3'} />
          ))}
          {monthlyCurrent.map((cur, i) => {
            const prev = monthlyPrevious[i];
            const curH = (cur / max) * chartH;
            const prevH = (prev / max) * chartH;
            const gx = leftPad + i * groupW + (groupW - (barW * 2 + gap)) / 2;
            return (
              <g key={i}>
                <rect x={gx} y={chartH - prevH} width={barW} height={prevH} rx={4} fill="#C7CDD6">
                  <title>{prevYear}년 {i + 1}월: {formatKRW(prev)}</title>
                </rect>
                <rect x={gx + barW + gap} y={chartH - curH} width={barW} height={curH} rx={4} fill="#2E6FF2">
                  <title>{year}년 {i + 1}월: {formatKRW(cur)}</title>
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
