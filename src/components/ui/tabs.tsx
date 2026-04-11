'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  /** pill: 배경 있는 알약형 탭 / underline: 밑줄 탭 */
  variant?: 'pill' | 'underline';
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, variant = 'pill', className }: TabsProps) {
  if (variant === 'underline') {
    return (
      <div className={cn('flex gap-6 border-b border-[#e5e5e7]', className)}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-[#0071e3] text-[#0071e3]'
                : 'border-transparent text-[#6e6e73] hover:text-[#1d1d1f]'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                'ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold',
                activeTab === tab.id
                  ? 'bg-[#0071e3]/10 text-[#0071e3]'
                  : 'bg-[#f5f5f7] text-[#6e6e73]'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // pill variant (default)
  return (
    <div className={cn('flex gap-1 bg-[#f5f5f7] rounded-xl p-1 w-fit', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium rounded-lg transition-all',
            activeTab === tab.id
              ? 'bg-white text-[#1d1d1f] shadow-sm'
              : 'text-[#6e6e73] hover:text-[#1d1d1f]'
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold',
              activeTab === tab.id
                ? 'bg-[#0071e3]/10 text-[#0071e3]'
                : 'bg-[#e5e5e7] text-[#6e6e73]'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
