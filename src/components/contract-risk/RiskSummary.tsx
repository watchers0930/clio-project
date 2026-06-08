'use client';

import { RiskScoreChart } from '@/components/contract-risk/RiskScoreChart';
import type { RiskCount } from '@/lib/types/contract-risk';

interface RiskSummaryProps {
  riskCount: RiskCount;
  fileName: string;
  contractTypeLabel: string;
  perspectiveLabel: string;
  createdAt: string;
}

const STAT_CARDS = [
  {
    key: 'high' as keyof RiskCount,
    label: '상위 리스크',
    color: 'text-red-600',
    bg: 'bg-red-50',
    bar: 'bg-red-500',
  },
  {
    key: 'medium' as keyof RiskCount,
    label: '중위 리스크',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    bar: 'bg-amber-400',
  },
  {
    key: 'low' as keyof RiskCount,
    label: '하위 리스크',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    bar: 'bg-emerald-500',
  },
];

export function RiskSummary({
  riskCount,
  fileName,
  contractTypeLabel,
  perspectiveLabel,
  createdAt,
}: RiskSummaryProps) {
  const total = riskCount.high + riskCount.medium + riskCount.low;
  const dateStr = new Date(createdAt).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden">
      {/* 파일 정보 */}
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-[15px] font-bold text-foreground truncate">{fileName}</h2>
        <p className="text-[12px] text-foreground-quaternary mt-1 flex flex-wrap gap-x-3">
          <span>{contractTypeLabel}</span>
          <span>·</span>
          <span>입장: {perspectiveLabel}</span>
          <span>·</span>
          <span>{dateStr}</span>
        </p>
      </div>

      {/* 도넛 차트 + 카드 그리드 */}
      <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-start sm:gap-6">
        {/* 좌: 안전 점수 도넛 */}
        <div className="shrink-0">
          <RiskScoreChart riskCount={riskCount} />
        </div>

        {/* 우: 리스크 카운트 카드 */}
        <div className="grid flex-1 grid-cols-1 gap-[10px] sm:grid-cols-2 xl:grid-cols-2 w-full">
          {STAT_CARDS.map(s => (
            <div key={s.key} className={`px-4 py-4 rounded-xl ${s.bg}`}>
              <p className={`text-[11px] font-semibold ${s.color} mb-1`}>{s.label}</p>
              <p className={`text-[28px] font-bold leading-none ${s.color}`}>
                {riskCount[s.key]}
                <span className="text-[13px] font-normal ml-0.5">건</span>
              </p>
              <div className="mt-2 h-1 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full ${s.bar} rounded-full transition-all`}
                  style={{ width: total > 0 ? `${(riskCount[s.key] / total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          ))}
          {/* 총 탐지 */}
          <div className="rounded-xl bg-surface-secondary px-4 py-4">
            <p className="text-[11px] font-semibold text-foreground-quaternary mb-1">총 탐지</p>
            <p className="text-[28px] font-bold text-foreground leading-none">
              {total}
              <span className="text-[13px] font-normal ml-0.5">건</span>
            </p>
            <div className="mt-2 h-1 bg-border rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
