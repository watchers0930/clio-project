'use client';

import { ArrowDown, ArrowUp, Plus, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_LABELS, RISK_LEVEL_LABELS } from '@/lib/contract-risk-items';
import type { ComparisonItem, ChangeType } from '@/lib/contract-risk-compare';
import type { RiskCount } from '@/lib/types/contract-risk';

interface Props {
  items: ComparisonItem[];
  beforeLabel: string;
  afterLabel: string;
  beforeCount: RiskCount;
  afterCount: RiskCount;
}

const CHANGE_CONFIG: Record<ChangeType, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  worsened: { label: '악화', color: 'text-red-600', bg: 'bg-red-50', Icon: ArrowUp },
  new: { label: '신규', color: 'text-orange-600', bg: 'bg-orange-50', Icon: Plus },
  improved: { label: '개선', color: 'text-emerald-600', bg: 'bg-emerald-50', Icon: ArrowDown },
  resolved: { label: '해소', color: 'text-blue-600', bg: 'bg-blue-50', Icon: Check },
  unchanged: { label: '동일', color: 'text-foreground-quaternary', bg: 'bg-surface-secondary', Icon: Minus },
};

const RISK_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function CountBadge({ count, label }: { count: RiskCount; label: string }) {
  const total = count.high + count.medium + count.low;
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-[11px] font-medium text-foreground-quaternary mb-2">{label}</p>
      <div className="flex items-center gap-3">
        <span className="text-[20px] font-bold text-foreground">{total}</span>
        <div className="flex gap-1.5">
          {count.high > 0 && <span className="text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-lg px-2 py-0.5">{count.high}상</span>}
          {count.medium > 0 && <span className="text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 rounded-lg px-2 py-0.5">{count.medium}중</span>}
          {count.low > 0 && <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg px-2 py-0.5">{count.low}하</span>}
        </div>
      </div>
    </div>
  );
}

export function ComparisonView({ items, beforeLabel, afterLabel, beforeCount, afterCount }: Props) {
  const changed = items.filter(i => i.change !== 'unchanged');
  const unchanged = items.filter(i => i.change === 'unchanged');

  return (
    <div className="flex flex-col gap-5">
      {/* 요약 비교 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CountBadge count={beforeCount} label={`이전: ${beforeLabel}`} />
        <CountBadge count={afterCount} label={`이후: ${afterLabel}`} />
      </div>

      {/* 변경 요약 뱃지 */}
      <div className="flex flex-wrap gap-2">
        {(['worsened', 'new', 'improved', 'resolved', 'unchanged'] as ChangeType[]).map(type => {
          const count = items.filter(i => i.change === type).length;
          if (count === 0) return null;
          const cfg = CHANGE_CONFIG[type];
          return (
            <span key={type} className={cn('inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium border border-border', cfg.bg, cfg.color)}>
              <cfg.Icon size={11} /> {cfg.label} {count}건
            </span>
          );
        })}
      </div>

      {/* 변경된 항목 */}
      {changed.length > 0 && (
        <div>
          <p className="text-[13px] font-semibold text-foreground mb-3">변경된 항목 ({changed.length}건)</p>
          <div className="flex flex-col gap-2">
            {changed.map(item => {
              const cfg = CHANGE_CONFIG[item.change];
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
                  <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg shrink-0', cfg.bg)}>
                    <cfg.Icon size={13} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono text-foreground-quaternary">{item.id}</span>
                      <span className="text-[12px] font-semibold text-foreground">{item.name}</span>
                      {item.category && (
                        <span className="text-[10px] text-foreground-quaternary bg-surface-secondary rounded-md px-2 py-0.5">
                          {CATEGORY_LABELS[item.category] ?? ''}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      {item.before && (
                        <span className={cn('rounded-lg border px-2 py-0.5 font-bold', RISK_BADGE[item.before.risk_level] ?? '')}>
                          {RISK_LEVEL_LABELS[item.before.risk_level] ?? ''}
                        </span>
                      )}
                      {item.before && item.after && <span className="text-foreground-quaternary">→</span>}
                      {item.after && (
                        <span className={cn('rounded-lg border px-2 py-0.5 font-bold', RISK_BADGE[item.after.risk_level] ?? '')}>
                          {RISK_LEVEL_LABELS[item.after.risk_level] ?? ''}
                        </span>
                      )}
                      {!item.before && <span className="text-foreground-quaternary">(이전 없음)</span>}
                      {!item.after && <span className="text-foreground-quaternary">(이후 해소)</span>}
                    </div>
                  </div>
                  <span className={cn('text-[11px] font-medium shrink-0', cfg.color)}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 변경 없는 항목 */}
      {unchanged.length > 0 && (
        <div>
          <p className="text-[13px] font-semibold text-foreground-quaternary mb-3">변경 없음 ({unchanged.length}건)</p>
          <div className="flex flex-col gap-1.5">
            {unchanged.map(item => (
              <div key={item.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-secondary px-4 py-2.5">
                <span className="text-[11px] font-mono text-foreground-quaternary">{item.id}</span>
                <span className="text-[12px] text-foreground-secondary">{item.name}</span>
                {item.after && (
                  <span className={cn('ml-auto text-[10px] rounded-lg border px-2 py-0.5 font-bold', RISK_BADGE[item.after.risk_level] ?? '')}>
                    {RISK_LEVEL_LABELS[item.after.risk_level] ?? ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
