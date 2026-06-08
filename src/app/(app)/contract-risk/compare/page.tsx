'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ComparisonView } from '@/components/contract-risk/ComparisonView';
import { compareAnalyses } from '@/lib/contract-risk-compare';
import type { ContractRiskAnalysis } from '@/lib/types/contract-risk';
import type { ComparisonItem } from '@/lib/contract-risk-compare';

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const aId = searchParams.get('a') ?? '';
  const bId = searchParams.get('b') ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [before, setBefore] = useState<ContractRiskAnalysis | null>(null);
  const [after, setAfter] = useState<ContractRiskAnalysis | null>(null);
  const [items, setItems] = useState<ComparisonItem[]>([]);

  useEffect(() => {
    if (!aId || !bId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('비교할 두 개의 분석 결과를 선택해주세요.');
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/contract-risk/${aId}`).then(r => r.json()),
      fetch(`/api/contract-risk/${bId}`).then(r => r.json()),
    ])
      .then(([aJson, bJson]) => {
        if (!aJson.data || !bJson.data) {
          setError('분석 결과를 찾을 수 없습니다.');
          return;
        }
        const a = aJson.data as ContractRiskAnalysis;
        const b = bJson.data as ContractRiskAnalysis;

        const aDate = new Date(a.created_at).getTime();
        const bDate = new Date(b.created_at).getTime();
        const [beforeData, afterData] = aDate <= bDate ? [a, b] : [b, a];

        setBefore(beforeData);
        setAfter(afterData);
        setItems(compareAnalyses(beforeData, afterData));
      })
      .catch(() => setError('비교 데이터를 불러오는 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false));
  }, [aId, bId]);

  return (
    <div className="min-h-full bg-surface-secondary">
      <div className="bg-white border-b border-border sticky top-0 z-20">
        <div className="mx-auto flex h-auto max-w-4xl items-center gap-3 px-4 py-4 sm:h-[68px] sm:px-6 sm:py-0">
          <button
            onClick={() => router.push('/contract-risk')}
            className="flex items-center gap-2 text-[12px] text-foreground-quaternary hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft size={14} /> 목록
          </button>
          <span className="text-border">/</span>
          <p className="text-[13px] font-medium text-foreground">분석 결과 비교</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-7">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
            <p className="text-[14px] font-semibold text-foreground mb-1">{error}</p>
            <button
              onClick={() => router.push('/contract-risk')}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-white rounded-xl text-[13px] font-medium hover:bg-sidebar-hover transition-colors"
            >
              <ArrowLeft size={14} /> 목록으로
            </button>
          </div>
        ) : before && after ? (
          <ComparisonView
            items={items}
            beforeLabel={before.file_name}
            afterLabel={after.file_name}
            beforeCount={before.risk_count}
            afterCount={after.risk_count}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function ContractRiskComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-full bg-surface-secondary flex items-center justify-center">
        <svg className="animate-spin w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
