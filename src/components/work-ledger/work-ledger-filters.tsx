'use client';

import { Plus, Search, Download } from 'lucide-react';
import { STATUS_LABELS, type WorkProjectStatus } from '@/lib/work-ledger/types';

export type StatusFilter = 'all' | WorkProjectStatus;
export type SortKey = 'recent' | 'due' | 'amount';

interface Props {
  query: string;
  onQuery: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilter: (v: StatusFilter) => void;
  sortKey: SortKey;
  onSortKey: (v: SortKey) => void;
  onExport: () => void;
  onAdd: () => void;
  exportDisabled: boolean;
}

const CTRL = 'h-9 rounded-xl border border-border bg-white px-3 text-[13px] text-foreground-secondary focus:outline-none focus:ring-1 focus:ring-primary';

export function WorkLedgerFilters({
  query, onQuery, statusFilter, onStatusFilter, sortKey, onSortKey, onExport, onAdd, exportDisabled,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-quaternary" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="프로젝트명·발주처 검색"
          className="h-9 w-60 rounded-xl border border-border bg-surface-secondary pl-10 pr-3 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={statusFilter} onChange={(e) => onStatusFilter(e.target.value as StatusFilter)} className={CTRL}>
          <option value="all">전체 상태</option>
          {(Object.keys(STATUS_LABELS) as WorkProjectStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select value={sortKey} onChange={(e) => onSortKey(e.target.value as SortKey)} className={CTRL}>
          <option value="recent">최신순</option>
          <option value="due">수금예정일순</option>
          <option value="amount">계약액순</option>
        </select>
        <button
          onClick={onExport}
          disabled={exportDisabled}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground hover:bg-surface-secondary disabled:opacity-40 transition-colors"
        >
          <Download size={15} strokeWidth={1.5} />
          엑셀
        </button>
        <button
          onClick={onAdd}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-[13px] font-medium text-white hover:bg-primary-dark transition-colors"
        >
          <Plus size={15} strokeWidth={1.5} />
          작업 추가
        </button>
      </div>
    </div>
  );
}
