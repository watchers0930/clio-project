'use client';

import { useState } from 'react';
import { ChevronDown, Copy, Check, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONTRACT_RISK_ITEMS, CATEGORY_LABELS } from '@/lib/contract-risk-items';
import type { RiskItem } from '@/lib/types/contract-risk';

interface RiskCardProps {
  item: RiskItem;
}

const RISK_CONFIG = {
  high: {
    label: '상',
    Icon: AlertCircle,
    badgeCls: 'bg-red-100 text-red-700 border-red-200',
    borderCls: 'border-l-red-500',
    iconCls: 'text-red-500',
    iconBg: 'bg-red-50',
    labelCls: 'text-red-700',
    sectionLabel: 'text-red-600',
  },
  medium: {
    label: '중',
    Icon: AlertTriangle,
    badgeCls: 'bg-amber-100 text-amber-700 border-amber-200',
    borderCls: 'border-l-amber-500',
    iconCls: 'text-amber-500',
    iconBg: 'bg-amber-50',
    labelCls: 'text-amber-700',
    sectionLabel: 'text-amber-600',
  },
  low: {
    label: '하',
    Icon: Info,
    badgeCls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    borderCls: 'border-l-emerald-500',
    iconCls: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    labelCls: 'text-emerald-700',
    sectionLabel: 'text-emerald-700',
  },
} as const;

export function RiskCard({ item }: RiskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const def = CONTRACT_RISK_ITEMS.find(d => d.id === item.id);
  const cfg = RISK_CONFIG[item.risk_level] ?? RISK_CONFIG.low;

  const handleCopy = () => {
    const text = [
      `[${cfg.label}] ${item.id} ${def?.name ?? ''}`,
      item.excerpt ? `원문: ${item.excerpt}` : '',
      `분석: ${item.explanation}`,
      item.recommendation ? `권고: ${item.recommendation}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }, () => {});
  };

  return (
    <div className={cn('bg-white border border-border border-l-4 rounded-2xl overflow-hidden', cfg.borderCls)}>

      {/* 헤더 (클릭하여 토글) */}
      <button
        className="w-full text-left px-5 py-4 flex items-start gap-3.5 hover:bg-surface-tertiary transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {/* 아이콘 */}
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5', cfg.iconBg)}>
          <cfg.Icon size={15} className={cfg.iconCls} />
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <div className="mb-1.5 flex items-center gap-2.5 flex-wrap">
            <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-lg border leading-none', cfg.badgeCls)}>
              {cfg.label}위 리스크
            </span>
            <span className="text-[11px] font-mono text-foreground-quaternary">{item.id}</span>
            {def && (
              <span className="text-[10px] text-foreground-quaternary bg-surface-secondary rounded-md px-2 py-1">
                {CATEGORY_LABELS[def.category] ?? ''}
              </span>
            )}
          </div>
          <p className="text-[14px] font-semibold text-foreground leading-snug">
            {def?.name ?? item.id}
          </p>
        </div>

        {/* 액션 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); handleCopy(); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-quaternary hover:text-foreground hover:bg-surface-secondary transition-colors"
            title="복사"
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          </button>
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-transform', expanded && 'rotate-180')}>
            <ChevronDown size={15} className="text-foreground-quaternary" />
          </div>
        </div>
      </button>

      {/* 상세 내용 */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-border bg-surface-tertiary space-y-4 pt-4">
          {item.excerpt && (
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">원문 발췌</p>
              <div className="bg-white border border-border rounded-xl p-3.5 text-[12px] text-foreground-secondary italic leading-relaxed">
                {item.excerpt}
              </div>
            </div>
          )}
          {item.explanation && (
            <div>
              <p className="text-[10px] font-bold text-foreground uppercase tracking-widest mb-2">AI 분석</p>
              <p className="text-[13px] text-foreground leading-relaxed">{item.explanation}</p>
            </div>
          )}
          {item.recommendation && (
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">권고사항</p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                <p className="text-[13px] text-emerald-800 leading-relaxed">{item.recommendation}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
