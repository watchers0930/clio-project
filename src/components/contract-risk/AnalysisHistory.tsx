'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Trash2, FileText, ChevronRight, GitCompareArrows } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONTRACT_TYPE_LABELS } from '@/lib/contract-risk-items';
import { HistorySearchBar, type HistoryFilter } from '@/components/contract-risk/HistorySearchBar';
import type { ContractRiskListItem } from '@/lib/types/contract-risk';

export function AnalysisHistory() {
  const router = useRouter();
  const [items, setItems] = useState<ContractRiskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryFilter>({ q: '', contractType: '', sort: 'latest' });
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());

  const fetchHistory = useCallback(async (f: HistoryFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (f.q) params.set('q', f.q);
      if (f.contractType) params.set('contract_type', f.contractType);
      if (f.sort && f.sort !== 'latest') params.set('sort', f.sort);

      const res = await fetch(`/api/contract-risk/history?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(filter); }, [filter, fetchHistory]);

  const handleFilterChange = (f: HistoryFilter) => {
    setFilter(f);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('이 분석 이력을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/contract-risk/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== id));
      setCompareIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const toggleCompare = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < 2) { next.add(id); }
      return next;
    });
  };

  const handleCompare = () => {
    const ids = Array.from(compareIds);
    if (ids.length === 2) {
      router.push(`/contract-risk/compare?a=${ids[0]}&b=${ids[1]}`);
    }
  };

  return (
    <div className="space-y-4">
      <HistorySearchBar filter={filter} onChange={handleFilterChange} />

      {/* 비교 바 */}
      {compareIds.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary-tint px-4 py-2.5">
          <span className="text-[12px] text-primary font-medium">
            {compareIds.size === 2 ? '2개 선택됨 — 비교 가능' : `${compareIds.size}개 선택됨 — 1개 더 선택하세요`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompareIds(new Set())}
              className="text-[11px] text-foreground-quaternary hover:text-foreground transition-colors"
            >
              선택 해제
            </button>
            <button
              onClick={handleCompare}
              disabled={compareIds.size !== 2}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-[11px] text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-40"
            >
              <GitCompareArrows size={12} /> 비교하기
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-border rounded-xl h-[72px] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl py-10 px-5 text-center">
          <div className="w-10 h-10 bg-surface-secondary rounded-xl flex items-center justify-center mx-auto mb-3">
            <FileText size={18} className="text-foreground-quaternary" />
          </div>
          <p className="text-[13px] font-medium text-foreground-quaternary">
            {filter.q || filter.contractType ? '검색 결과 없음' : '분석 이력 없음'}
          </p>
          <p className="text-[11px] text-foreground-quaternary mt-1">
            {filter.q || filter.contractType ? '검색 조건을 변경해 보세요' : '계약서를 분석하면 여기에 표시됩니다'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
        {items.map(item => {
          const total = item.risk_count.high + item.risk_count.medium + item.risk_count.low;
          const dateStr = new Date(item.created_at).toLocaleDateString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
          });
          const isSelected = compareIds.has(item.id);

          return (
            <Link
              key={item.id}
              href={`/contract-risk/${item.id}`}
              className={cn(
                'group flex items-center gap-3.5 bg-white border rounded-xl px-4 py-3.5 hover:shadow-sm transition-all',
                isSelected ? 'border-primary bg-primary-tint' : 'border-border hover:border-primary/50',
              )}
            >
              {/* 비교 체크 */}
              <button
                onClick={e => toggleCompare(item.id, e)}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-md border-2 shrink-0 transition-colors',
                  isSelected ? 'border-primary bg-primary text-white' : 'border-border hover:border-primary/60',
                )}
                title="비교 선택"
              >
                {isSelected && <span className="text-[10px] font-bold">✓</span>}
              </button>

              <div className="w-8 h-8 bg-primary-tint rounded-lg flex items-center justify-center shrink-0">
                <ShieldCheck size={14} className="text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                  {item.file_name}
                </p>
                <p className="mt-1 text-[10px] text-foreground-quaternary truncate">
                  {CONTRACT_TYPE_LABELS[item.contract_type] ?? item.contract_type} · {dateStr}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.risk_count.high > 0 && (
                  <span className="text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-lg px-2 py-1">
                    {item.risk_count.high}상
                  </span>
                )}
                {item.risk_count.medium > 0 && (
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 rounded-lg px-2 py-1">
                    {item.risk_count.medium}중
                  </span>
                )}
                {item.risk_count.low > 0 && (
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg px-2 py-1">
                    {item.risk_count.low}하
                  </span>
                )}
                {total === 0 && (
                  <span className="text-[10px] text-foreground-quaternary">탐지 없음</span>
                )}
              </div>

              <button
                onClick={e => handleDelete(item.id, e)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground-quaternary hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                title="삭제"
              >
                <Trash2 size={12} />
              </button>

              <ChevronRight size={13} className="text-foreground-quaternary group-hover:text-primary transition-colors shrink-0" />
            </Link>
          );
        })}
        </div>
      )}
    </div>
  );
}
