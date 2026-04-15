'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, AlertCircle, ShieldCheck } from 'lucide-react';
import { RiskSummary } from '@/components/contract-risk/RiskSummary';
import { RiskFilter } from '@/components/contract-risk/RiskFilter';
import { RiskCard } from '@/components/contract-risk/RiskCard';
import { CONTRACT_TYPE_LABELS, PERSPECTIVE_LABELS, CONTRACT_RISK_ITEMS } from '@/lib/contract-risk-items';
import type { ContractRiskAnalysis, RiskFilterState } from '@/lib/types/contract-risk';
import { ClauseFixModal } from '@/components/contract-risk/ClauseFixModal';

export default function ContractRiskResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [analysis, setAnalysis] = useState<ContractRiskAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [showClauseFix, setShowClauseFix] = useState(false);
  const [filter, setFilter] = useState<RiskFilterState>({ level: 'all', category: 'all' });

  useEffect(() => {
    if (!id) return;
    fetch(`/api/contract-risk/${id}`)
      .then(async res => {
        if (!res.ok) {
          const j = await res.json();
          throw new Error(j.message ?? '분석 결과를 찾을 수 없습니다.');
        }
        return res.json();
      })
      .then(json => setAnalysis(json.data))
      .catch(e => setError(e.message ?? '오류가 발생했습니다.'))
      .finally(() => setLoading(false));
  }, [id]);

  const filteredItems = useMemo(() => {
    if (!analysis) return [];
    const found = analysis.risk_result.items.filter(i => i.found);
    return found.filter(item => {
      const def = CONTRACT_RISK_ITEMS.find(d => d.id === item.id);
      if (filter.level !== 'all' && item.risk_level !== filter.level) return false;
      if (filter.category !== 'all' && def?.category !== filter.category) return false;
      return true;
    });
  }, [analysis, filter]);

  const counts = useMemo(() => {
    if (!analysis) return { all: 0, high: 0, medium: 0, low: 0, unfavorable: 0, missing: 0, ambiguous: 0 };
    const found = analysis.risk_result.items.filter(i => i.found);
    return {
      all: found.length,
      high: found.filter(i => i.risk_level === 'high').length,
      medium: found.filter(i => i.risk_level === 'medium').length,
      low: found.filter(i => i.risk_level === 'low').length,
      unfavorable: found.filter(i => CONTRACT_RISK_ITEMS.find(d => d.id === i.id)?.category === 'unfavorable').length,
      missing: found.filter(i => CONTRACT_RISK_ITEMS.find(d => d.id === i.id)?.category === 'missing').length,
      ambiguous: found.filter(i => CONTRACT_RISK_ITEMS.find(d => d.id === i.id)?.category === 'ambiguous').length,
    };
  }, [analysis]);

  const sortedItems = useMemo(() => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...filteredItems].sort((a, b) => (order[a.risk_level] ?? 3) - (order[b.risk_level] ?? 3));
  }, [filteredItems]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/contract-risk/${id}/download`);
      if (!res.ok) { alert('다운로드에 실패했습니다.'); return; }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const match = cd.match(/filename\*=UTF-8''(.+)/i) ?? cd.match(/filename="?([^"]+)"?/i);
      const fileName = match ? decodeURIComponent(match[1]) : `risk-report-${id}.docx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-[#F7F8FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-7 h-7 text-[#2E6FF2]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-[13px] text-[#888]">분석 결과 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-full bg-[#F7F8FA] flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={22} className="text-red-500" />
          </div>
          <p className="text-[15px] font-semibold text-[#1B1F2B] mb-1">결과를 불러올 수 없습니다</p>
          <p className="text-[13px] text-[#888] mb-6">{error}</p>
          <button
            onClick={() => router.push('/contract-risk')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B1F2B] text-white rounded-xl text-[13px] font-medium hover:bg-[#2E3340] transition-colors"
          >
            <ArrowLeft size={14} /> 목록으로
          </button>
        </div>
      </div>
    );
  }

  const total = analysis.risk_count.high + analysis.risk_count.medium + analysis.risk_count.low;

  return (
    <div className="min-h-full bg-[#F7F8FA]">

      {/* ── 상단 헤더 바 ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E2E5EA] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/contract-risk')}
              className="flex items-center gap-1.5 text-[12px] text-[#888] hover:text-[#1B1F2B] transition-colors shrink-0"
            >
              <ArrowLeft size={14} /> 목록
            </button>
            <span className="text-[#E2E5EA]">/</span>
            <p className="text-[13px] font-medium text-[#1B1F2B] truncate">{analysis.file_name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowClauseFix(true)}
              className="flex items-center gap-2 px-4 py-2 border border-[#2E6FF2] text-[#2E6FF2] rounded-xl text-[12px] font-medium hover:bg-[#2E6FF2]/5 transition-colors"
            >
              ⚖️ 조항 수정 제안
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B1F2B] text-white rounded-xl text-[12px] font-medium hover:bg-[#2E3340] transition-colors disabled:opacity-50"
            >
              <Download size={13} />
              {downloading ? '다운로드 중...' : 'DOCX 리포트'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">

        {/* ── 요약 컴포넌트 ────────────────────────────────────────────────── */}
        <RiskSummary
          riskCount={analysis.risk_count}
          fileName={analysis.file_name}
          contractTypeLabel={CONTRACT_TYPE_LABELS[analysis.contract_type] ?? analysis.contract_type}
          perspectiveLabel={PERSPECTIVE_LABELS[analysis.perspective] ?? analysis.perspective}
          createdAt={analysis.created_at}
        />

        {/* ── AI 종합 의견 ─────────────────────────────────────────────────── */}
        {analysis.risk_result.summary && (
          <div className="bg-white border border-[#E2E5EA] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-[#EEF3FE] rounded-lg flex items-center justify-center">
                <ShieldCheck size={13} className="text-[#2E6FF2]" />
              </div>
              <p className="text-[12px] font-semibold text-[#2E6FF2] uppercase tracking-wide">AI 종합 의견</p>
            </div>
            <p className="text-[13px] text-[#333] leading-relaxed">{analysis.risk_result.summary}</p>
          </div>
        )}

        {/* ── 탐지 항목 없음 ───────────────────────────────────────────────── */}
        {total === 0 && (
          <div className="bg-white border border-[#E2E5EA] rounded-2xl p-10 text-center">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={24} className="text-emerald-600" />
            </div>
            <p className="text-[16px] font-bold text-emerald-800 mb-1">리스크가 탐지되지 않았습니다</p>
            <p className="text-[13px] text-emerald-700">분석한 25개 항목에서 리스크가 발견되지 않았습니다.</p>
          </div>
        )}

        {/* ── 필터 + 항목 목록 ─────────────────────────────────────────────── */}
        {counts.all > 0 && (
          <>
            <RiskFilter filter={filter} onChange={setFilter} counts={counts} />

            <div className="space-y-3">
              {sortedItems.length > 0 ? (
                sortedItems.map(item => <RiskCard key={item.id} item={item} />)
              ) : (
                <div className="bg-white border border-[#E2E5EA] rounded-2xl py-10 text-center">
                  <p className="text-[13px] text-[#aaa]">해당 필터 조건의 항목이 없습니다.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 조항 수정 모달 ─────────────────────────────────────────────── */}
        {analysis && (
          <ClauseFixModal
            open={showClauseFix}
            onClose={() => setShowClauseFix(false)}
            analysisId={analysis.id}
            riskItems={analysis.risk_result?.items ?? []}
          />
        )}

        {/* ── 면책 ─────────────────────────────────────────────────────────── */}
        <div className="border-t border-[#E2E5EA] pt-5 pb-2 text-center">
          <p className="text-[11px] text-[#c0c4cc] leading-relaxed">
            ⚠️ 이 분석은 AI가 생성한 참고 자료이며 법적 조언이 아닙니다.<br />
            최종 계약 체결 전 법률 전문가 검토를 권장합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
