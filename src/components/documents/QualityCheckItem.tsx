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
    <div className="rounded-xl border border-[#e5e5e7] bg-white p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[#1d1d1f]">
          {CATEGORY_LABEL[item.category] ?? item.category}
        </span>
        <QualityCheckBadge severity={item.severity} />
      </div>

      {item.original && (
        <div className="flex items-start gap-2">
          <span className="text-[10px] font-medium text-[#6e6e73] shrink-0 mt-0.5">원문</span>
          <span className="text-xs text-[#1d1d1f] font-mono bg-[#f5f5f7] rounded px-2 py-0.5 leading-relaxed">
            &ldquo;{item.original}&rdquo;
          </span>
        </div>
      )}

      {item.suggestion && (
        <div className="flex items-start gap-2">
          <span className="text-[10px] font-medium text-[#34c759] shrink-0 mt-0.5">제안</span>
          <span className="text-xs text-[#1d1d1f] leading-relaxed">{item.suggestion}</span>
        </div>
      )}

      <p className="text-xs text-[#6e6e73] leading-relaxed">{item.description}</p>
    </div>
  );
}
