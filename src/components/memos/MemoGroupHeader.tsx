'use client';

import { CheckCircle2 } from 'lucide-react';

interface MemoGroupHeaderProps {
  name: string;
  count: number;
  selected: boolean;
}

export default function MemoGroupHeader({ name, count, selected }: MemoGroupHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px w-6 bg-[#E2E5EA] flex-shrink-0" />
      <span className={`text-[13px] font-semibold whitespace-nowrap transition-colors ${selected ? 'text-[#2E6FF2]' : 'text-[#1B1F2B]'}`}>
        {name}
      </span>
      <span className="text-[12px] text-[#A0A7B5] whitespace-nowrap">({count}개)</span>
      <div className={`h-px flex-1 transition-colors ${selected ? 'bg-[#2E6FF2]/30' : 'bg-[#E2E5EA]'}`} />
      {selected && (
        <CheckCircle2 size={15} className="text-[#2E6FF2] flex-shrink-0" />
      )}
    </div>
  );
}
