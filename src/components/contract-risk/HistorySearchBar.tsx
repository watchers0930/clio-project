'use client';

import { Search } from 'lucide-react';
import { CONTRACT_TYPE_LABELS } from '@/lib/contract-risk-items';

export interface HistoryFilter {
  q: string;
  contractType: string;
  sort: string;
}

interface Props {
  filter: HistoryFilter;
  onChange: (f: HistoryFilter) => void;
}

const SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
  { value: 'risk_high', label: '고위험순' },
];

export function HistorySearchBar({ filter, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      {/* 검색 */}
      <div className="relative flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-quaternary" />
        <input
          type="text"
          value={filter.q}
          onChange={e => onChange({ ...filter, q: e.target.value })}
          placeholder="파일명 검색..."
          className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-3 text-[12px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* 계약 유형 */}
      <select
        value={filter.contractType}
        onChange={e => onChange({ ...filter, contractType: e.target.value })}
        className="rounded-xl border border-border bg-white px-3 py-2.5 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">유형 전체</option>
        {Object.entries(CONTRACT_TYPE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      {/* 정렬 */}
      <select
        value={filter.sort}
        onChange={e => onChange({ ...filter, sort: e.target.value })}
        className="rounded-xl border border-border bg-white px-3 py-2.5 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {SORT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
