'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Trash2, FileText, ChevronRight } from 'lucide-react';
import { CONTRACT_TYPE_LABELS } from '@/lib/contract-risk-items';
import type { ContractRiskListItem } from '@/lib/types/contract-risk';

export function AnalysisHistory() {
  const [items, setItems] = useState<ContractRiskListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/contract-risk/history?limit=20');
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm('이 분석 이력을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/contract-risk/${id}`, { method: 'DELETE' });
    if (res.ok) setItems(prev => prev.filter(i => i.id !== id));
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-border rounded-xl h-[72px] animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-border rounded-2xl py-10 px-5 text-center">
        <div className="w-10 h-10 bg-surface-secondary rounded-xl flex items-center justify-center mx-auto mb-3">
          <FileText size={18} className="text-foreground-quaternary" />
        </div>
        <p className="text-[13px] font-medium text-foreground-quaternary">분석 이력 없음</p>
        <p className="text-[11px] text-foreground-quaternary mt-1">계약서를 분석하면 여기에 표시됩니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(item => {
        const total = item.risk_count.high + item.risk_count.medium + item.risk_count.low;
        const dateStr = new Date(item.created_at).toLocaleDateString('ko-KR', {
          month: '2-digit',
          day: '2-digit',
        });

        return (
          <Link
            key={item.id}
            href={`/contract-risk/${item.id}`}
            className="group flex items-center gap-3.5 bg-white border border-border rounded-xl px-4 py-3.5 hover:border-primary/50 hover:shadow-sm transition-all"
          >
            {/* 아이콘 */}
            <div className="w-8 h-8 bg-primary-tint rounded-lg flex items-center justify-center shrink-0">
              <ShieldCheck size={14} className="text-primary" />
            </div>

            {/* 내용 */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                {item.file_name}
              </p>
              <p className="mt-1 text-[10px] text-foreground-quaternary truncate">
                {CONTRACT_TYPE_LABELS[item.contract_type] ?? item.contract_type} · {dateStr}
              </p>
            </div>

            {/* 리스크 배지 */}
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

            {/* 삭제 */}
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
  );
}
