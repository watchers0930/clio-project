'use client';

import { cn } from '@/lib/utils';
import type { RiskFilterState, RiskLevel, Category } from '@/lib/types/contract-risk';

interface RiskFilterProps {
  filter: RiskFilterState;
  onChange: (f: RiskFilterState) => void;
  counts: {
    all: number;
    high: number;
    medium: number;
    low: number;
    unfavorable: number;
    missing: number;
    ambiguous: number;
  };
}

export function RiskFilter({ filter, onChange, counts }: RiskFilterProps) {
  const levels: { key: RiskLevel | 'all'; label: string; count: number; dot?: string }[] = [
    { key: 'all',    label: '전체',      count: counts.all },
    { key: 'high',   label: '상위',      count: counts.high,   dot: 'bg-red-500' },
    { key: 'medium', label: '중위',      count: counts.medium, dot: 'bg-amber-400' },
    { key: 'low',    label: '하위',      count: counts.low,    dot: 'bg-emerald-500' },
  ];

  const categories: { key: Category | 'all'; label: string; count: number }[] = [
    { key: 'all',          label: '유형 전체',      count: counts.all },
    { key: 'unfavorable',  label: '불리한 조항',    count: counts.unfavorable },
    { key: 'missing',      label: '필수 항목 누락', count: counts.missing },
    { key: 'ambiguous',    label: '모호한 표현',    count: counts.ambiguous },
  ];

  return (
    <div className="bg-white border border-[#E2E5EA] rounded-2xl p-4 space-y-3">
      {/* 리스크 수준 */}
      <div className="mb-[5px] flex flex-wrap items-center gap-2 pb-[5px]">
        {levels.map(btn => (
          <button
            key={btn.key}
            onClick={() => onChange({ ...filter, level: btn.key })}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-all sm:px-3.5',
              filter.level === btn.key
                ? 'bg-[#2E6FF2] text-white border-[#2E6FF2] shadow-sm'
                : 'bg-white text-[#555] border-[#E2E5EA] hover:border-[#2E6FF2]/60',
            )}
          >
            {btn.dot && (
              <span className={cn('w-2 h-2 rounded-full shrink-0', filter.level === btn.key ? 'bg-white/80' : btn.dot)} />
            )}
            {btn.label}
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-md font-semibold',
              filter.level === btn.key ? 'bg-white/20 text-white' : 'bg-[#F0F2F5] text-[#888]',
            )}>
              {btn.count}
            </span>
          </button>
        ))}
      </div>


      {/* 유형 */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map(btn => (
          <button
            key={btn.key}
            onClick={() => onChange({ ...filter, category: btn.key })}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-all sm:px-3.5',
              filter.category === btn.key
                ? 'bg-[#1B1F2B] text-white border-[#1B1F2B] shadow-sm'
                : 'bg-white text-[#555] border-[#E2E5EA] hover:border-[#1B1F2B]/40',
            )}
          >
            {btn.label}
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-md font-semibold',
              filter.category === btn.key ? 'bg-white/20 text-white' : 'bg-[#F0F2F5] text-[#888]',
            )}>
              {btn.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
