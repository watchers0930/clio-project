'use client';

import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { buildTrendSeries } from '@/lib/maintenance-fees/calc';
import { won } from '@/lib/maintenance-fees/format';
import type { YearlyView } from '@/lib/maintenance-fees/types';

interface Props {
  view: YearlyView;
  year: number;
}

const CHART_H = 160;
const SELECT = 'h-9 rounded-xl border border-border bg-white px-3 text-[13px] text-foreground-secondary focus:outline-none focus:ring-1 focus:ring-primary';

/** 월별 탭 — 1~12월 관리비 추이 막대 그래프(전체 합계 또는 항목 하나) */
export function FeeTrendChart({ view, year }: Props) {
  const [itemId, setItemId] = useState<string>('');
  // 선택한 항목이 다른 연도에 없으면 전체 합계로 본다
  const selected = view.rows.some((r) => r.item.id === itemId) ? itemId : '';
  const series = useMemo(() => buildTrendSeries(view, selected || null), [view, selected]);
  const max = Math.max(...series.map((v) => v ?? 0), 1);
  const label = selected ? view.rows.find((r) => r.item.id === selected)?.item.name ?? '' : '부과액 합계';

  return (
    <div className="rounded-xl border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-tint">
            <TrendingUp size={15} className="text-primary" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-foreground">{year}년 월별 추이</span>
            <span className="text-[11px] text-foreground-tertiary">{label} · 단위 원</span>
          </div>
        </div>
        <select value={selected} onChange={(e) => setItemId(e.target.value)} className={SELECT} aria-label="그래프 항목">
          <option value="">전체 합계</option>
          {view.rows.map((r) => (
            <option key={r.item.id} value={r.item.id}>{r.item.name}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto px-5 py-6">
        <div className="grid min-w-[640px] grid-cols-12 gap-2">
          {series.map((v, i) => {
            const h = v === null ? 0 : Math.max(Math.round((v / max) * CHART_H), v > 0 ? 4 : 0);
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="flex w-full flex-col items-center justify-end gap-1.5" style={{ height: `${CHART_H + 20}px` }}>
                  {v !== null && <span className="font-mono text-[10px] font-semibold text-foreground">{won(v)}</span>}
                  <div
                    className={`w-full max-w-[36px] rounded-t-md ${v === null ? 'bg-surface-secondary' : 'bg-primary'}`}
                    style={{ height: `${v === null ? CHART_H : h}px`, opacity: v === null ? 0.6 : 1 }}
                    title={v === null ? `${i + 1}월 기록 없음` : `${i + 1}월 ${won(v)}원`}
                  />
                </div>
                <span className="text-[11px] text-foreground-tertiary">{i + 1}월</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
