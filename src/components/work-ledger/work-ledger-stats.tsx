'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { formatKRW } from '@/lib/work-ledger/calc';
import { MonthlyRevenueChart } from './monthly-revenue-chart';
import { YearlyRevenueChart } from './yearly-revenue-chart';

interface StatsData {
  year: number;
  prevYear: number;
  monthly: number[];
  yearly: { year: number; amount: number }[];
  totalCurrent: number;
  totalPrevious: number;
}

export function WorkLedgerStats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/work-projects/stats');
        const json = (await res.json()) as { data?: StatsData };
        setStats(json.data ?? null);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-[13px] text-foreground-secondary">통계를 불러오지 못했습니다.</p>;
  }

  const diff = stats.totalCurrent - stats.totalPrevious;
  const rate = stats.totalPrevious > 0 ? (diff / stats.totalPrevious) * 100 : null;
  const up = diff >= 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/work-ledger" className="mb-3 inline-flex items-center gap-1 text-[13px] text-foreground-secondary hover:text-foreground">
          <ArrowLeft size={15} /> 작업내역으로
        </Link>
        <h2 className="text-[16px] font-semibold text-foreground">매출 통계</h2>
        <p className="mt-1 text-[13px] text-foreground-secondary">수금 완료된 대금 기준 월별 매출 추이입니다.</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white px-5 py-6">
          <p className="text-[12px] text-foreground-secondary">{stats.year}년 총 수금</p>
          <p className="mt-3 text-[19px] font-semibold text-foreground">{formatKRW(stats.totalCurrent)}</p>
        </div>
        <div className="rounded-xl border border-border bg-white px-5 py-6">
          <p className="text-[12px] text-foreground-secondary">{stats.prevYear}년 총 수금</p>
          <p className="mt-3 text-[19px] font-semibold text-foreground">{formatKRW(stats.totalPrevious)}</p>
        </div>
        <div className="rounded-xl border border-border bg-white px-5 py-6">
          <p className="text-[12px] text-foreground-secondary">전년 대비</p>
          <p className={`mt-3 flex items-center gap-1.5 text-[19px] font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>
            {up ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            {rate === null ? '—' : `${up ? '+' : ''}${rate.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-[11px] text-foreground-quaternary">{up ? '+' : ''}{formatKRW(diff)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MonthlyRevenueChart monthly={stats.monthly} year={stats.year} />
        <YearlyRevenueChart yearly={stats.yearly} currentYear={stats.year} />
      </div>
    </div>
  );
}
