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
      <div className={cn('flex gap-7 border-b border-border', className)}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 pb-4 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-secondary hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                'ml-1 px-2 py-1 rounded-full text-[11px] font-semibold',
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary'
                  : 'bg-surface-secondary text-foreground-secondary'
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
    <div className={cn('flex gap-1.5 bg-surface-secondary rounded-md p-1.5 w-fit', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-sm transition-all',
            activeTab === tab.id
              ? 'bg-white text-foreground shadow-sm'
              : 'text-foreground-secondary hover:text-foreground'
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'ml-0.5 px-2 py-1 rounded-full text-[11px] font-semibold',
              activeTab === tab.id
                ? 'bg-primary/10 text-primary'
                : 'bg-border text-foreground-secondary'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
