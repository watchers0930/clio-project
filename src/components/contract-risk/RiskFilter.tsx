'use client';

import { ChevronsUpDown } from 'lucide-react';
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
  isAllExpanded?: boolean;
  onToggleExpandAll?: () => void;
}

export function RiskFilter({ filter, onChange, counts, isAllExpanded, onToggleExpandAll }: RiskFilterProps) {
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
    <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
      {/* 리스크 수준 + 펼치기/접기 */}
      <div className="flex flex-wrap items-center gap-2">
        {levels.map(btn => (
          <button
            key={btn.key}
            onClick={() => onChange({ ...filter, level: btn.key })}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-all sm:px-3.5',
              filter.level === btn.key
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white text-foreground-secondary border-border hover:border-primary/60',
            )}
          >
            {btn.dot && (
              <span className={cn('w-2 h-2 rounded-full shrink-0', filter.level === btn.key ? 'bg-white/80' : btn.dot)} />
            )}
            {btn.label}
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-md font-semibold',
              filter.level === btn.key ? 'bg-white/20 text-white' : 'bg-surface-secondary text-foreground-quaternary',
            )}>
              {btn.count}
            </span>
          </button>
        ))}
        {onToggleExpandAll && (
          <button
            onClick={onToggleExpandAll}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12px] font-medium text-foreground-secondary hover:border-primary/60 hover:text-foreground transition-all"
          >
            <ChevronsUpDown size={13} />
            {isAllExpanded ? '전체 접기' : '전체 펼치기'}
          </button>
        )}
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
                ? 'bg-foreground text-white border-foreground shadow-sm'
                : 'bg-white text-foreground-secondary border-border hover:border-foreground/40',
            )}
          >
            {btn.label}
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-md font-semibold',
              filter.category === btn.key ? 'bg-white/20 text-white' : 'bg-surface-secondary text-foreground-quaternary',
            )}>
              {btn.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
