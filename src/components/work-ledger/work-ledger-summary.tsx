'use client';

import { Briefcase, Wallet, TrendingUp, AlertTriangle, CalendarClock } from 'lucide-react';
import { formatKRW, summarize } from '@/lib/work-ledger/calc';
import type { WorkProject } from '@/lib/work-ledger/types';

interface Props {
  projects: WorkProject[];
}

export function WorkLedgerSummary({ projects }: Props) {
  const s = summarize(projects);

  const cards = [
    { label: '진행중', value: `${s.activeCount}건`, icon: Briefcase, color: '#2E6FF2' },
    { label: '진행예정', value: `${s.plannedCount}건`, icon: CalendarClock, color: '#0EA5E9' },
    { label: '총 계약액', value: formatKRW(s.totalContract), icon: Wallet, color: '#12805C' },
    { label: '예상수익 합계', value: formatKRW(s.totalExpectedProfit), icon: TrendingUp, color: '#7C3AED' },
    {
      label: s.overdueCount > 0 ? `연체 ${s.overdueCount}건 · 이번달 수금예정` : '이번달 수금예정',
      value: formatKRW(s.thisMonthDue),
      icon: AlertTriangle,
      color: s.overdueCount > 0 ? '#DC2626' : '#B7791F',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-5 lg:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="rounded-xl border border-border bg-white px-5 py-6">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${c.color}14`, color: c.color }}
              >
                <Icon size={16} strokeWidth={1.8} />
              </span>
              <span className="text-[12px] text-foreground-secondary">{c.label}</span>
            </div>
            <p className="mt-4 text-[19px] font-semibold text-foreground">{c.value}</p>
          </div>
        );
      })}
    </div>
  );
}
