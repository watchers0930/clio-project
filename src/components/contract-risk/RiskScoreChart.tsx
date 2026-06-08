'use client';

import type { RiskCount } from '@/lib/types/contract-risk';

interface Props {
  riskCount: RiskCount;
}

const TOTAL_ITEMS = 25;
const SIZE = 160;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const COLORS = {
  high: '#C0392B',
  medium: '#D68910',
  low: '#1E8449',
  none: '#E2E5EA',
};

function computeSafetyScore(rc: RiskCount): number {
  const raw = rc.high * 10 + rc.medium * 5 + rc.low * 2;
  return Math.round(Math.max(0, 100 - (raw / 250) * 100));
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#1E8449';
  if (score >= 50) return '#D68910';
  return '#C0392B';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return '양호';
  if (score >= 50) return '주의';
  return '위험';
}

export function RiskScoreChart({ riskCount }: Props) {
  const total = riskCount.high + riskCount.medium + riskCount.low;
  const safetyScore = computeSafetyScore(riskCount);
  const scoreColor = getScoreColor(safetyScore);
  const scoreLabel = getScoreLabel(safetyScore);

  // 도넛 세그먼트 계산 (25개 항목 기준 비율)
  const segments = [
    { count: riskCount.high, color: COLORS.high },
    { count: riskCount.medium, color: COLORS.medium },
    { count: riskCount.low, color: COLORS.low },
    { count: TOTAL_ITEMS - total, color: COLORS.none },
  ].filter(s => s.count > 0);

  let offset = 0;
  const paths = segments.map((seg, i) => {
    const ratio = seg.count / TOTAL_ITEMS;
    const dash = CIRCUMFERENCE * ratio;
    const gap = CIRCUMFERENCE - dash;
    const strokeOffset = -offset;
    offset += dash;

    return (
      <circle
        key={i}
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={seg.color}
        strokeWidth={STROKE}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={strokeOffset}
        strokeLinecap="round"
        className="transition-all duration-700"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
    );
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* 배경 원 */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#F0F1F4"
            strokeWidth={STROKE}
          />
          {paths}
        </svg>
        {/* 중앙 점수 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-bold leading-none" style={{ color: scoreColor }}>{safetyScore}</span>
          <span className="text-[11px] font-medium text-foreground-quaternary mt-0.5">/ 100점</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: scoreColor }} />
        <span className="text-[12px] font-semibold" style={{ color: scoreColor }}>{scoreLabel}</span>
      </div>
      {/* 범례 */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <LegendItem color={COLORS.high} label="상" count={riskCount.high} />
        <LegendItem color={COLORS.medium} label="중" count={riskCount.medium} />
        <LegendItem color={COLORS.low} label="하" count={riskCount.low} />
      </div>
    </div>
  );
}

function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-foreground-quaternary">{label} <span className="font-medium text-foreground">{count}</span></span>
    </div>
  );
}
