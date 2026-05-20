'use client';

import type { QualityCheckItem as QualityCheckItemType } from '@/lib/supabase/types';
import { QualityCheckBadge } from './QualityCheckBadge';

const CATEGORY_LABEL: Record<string, string> = {
  spelling: '맞춤법',
  format:   '공문서 규격',
  logic:    '논리 흐름',
  missing:  '누락 항목',
};

interface QualityCheckItemProps {
  item: QualityCheckItemType;
}

export function QualityCheckItemCard({ item }: QualityCheckItemProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-semibold text-foreground">
          {CATEGORY_LABEL[item.category] ?? item.category}
        </span>
        <QualityCheckBadge severity={item.severity} />
      </div>

      {item.original && (
        <div className="flex items-start gap-2.5">
          <span className="text-[10px] font-medium text-foreground-secondary shrink-0 mt-0.5">원문</span>
          <span className="text-xs text-foreground font-mono bg-surface-secondary rounded-md px-2.5 py-1 leading-relaxed">
            &ldquo;{item.original}&rdquo;
          </span>
        </div>
      )}

      {item.suggestion && (
        <div className="flex items-start gap-2.5">
          <span className="text-[10px] font-medium text-success shrink-0 mt-0.5">제안</span>
          <span className="text-xs text-foreground leading-relaxed">{item.suggestion}</span>
        </div>
      )}

      <p className="text-xs text-foreground-secondary leading-relaxed">{item.description}</p>
    </div>
  );
}
