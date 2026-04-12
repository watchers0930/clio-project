'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, AlertCircle } from 'lucide-react';
import { RiskSummary } from '@/components/contract-risk/RiskSummary';
import { RiskFilter } from '@/components/contract-risk/RiskFilter';
import { RiskCard } from '@/components/contract-risk/RiskCard';
import { CONTRACT_TYPE_LABELS, PERSPECTIVE_LABELS, CONTRACT_RISK_ITEMS } from '@/lib/contract-risk-items';
import type { ContractRiskAnalysis, RiskFilterState } from '@/lib/types/contract-risk';

export default function ContractRiskResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [analysis, setAnalysis] = useState<ContractRiskAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
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

  // 필터 적용된 found 항목 목록
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

  // 필터 카운트
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

  // 상 → 중 → 하 정렬
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
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin w-6 h-6 text-[#2E6FF2]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-5">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-semibold text-red-700">결과를 불러올 수 없습니다</p>
            <p className="text-[12px] text-red-600 mt-1">{error}</p>
          </div>
        </div>
        <button onClick={() => router.push('/contract-risk')} className="mt-4 text-[13px] text-[#2E6FF2] flex items-center gap-1">
          <ArrowLeft size={14} /> 목록으로
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/contract-risk')}
          className="flex items-center gap-1.5 text-[13px] text-[#888] hover:text-[#1B1F2B] transition-colors"
        >
          <ArrowLeft size={15} /> 목록으로
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B1F2B] text-white rounded-lg text-[12px] font-medium hover:bg-[#2E3340] transition-colors disabled:opacity-50"
        >
          <Download size={14} />
          {downloading ? '다운로드 중...' : 'DOCX 리포트'}
        </button>
      </div>

      {/* 요약 */}
      <RiskSummary
        riskCount={analysis.risk_count}
        fileName={analysis.file_name}
        contractTypeLabel={CONTRACT_TYPE_LABELS[analysis.contract_type] ?? analysis.contract_type}
        perspectiveLabel={PERSPECTIVE_LABELS[analysis.perspective] ?? analysis.perspective}
        createdAt={analysis.created_at}
      />

      {/* AI 종합 의견 */}
      {analysis.risk_result.summary && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-[#2E6FF2] mb-1">AI 종합 의견</p>
          <p className="text-[13px] text-[#333] leading-relaxed">{analysis.risk_result.summary}</p>
        </div>
      )}

      {/* 필터 */}
      {counts.all > 0 && (
        <div className="mt-4">
          <RiskFilter filter={filter} onChange={setFilter} counts={counts} />
        </div>
      )}

      {/* 항목 목록 */}
      <div className="mt-4 flex flex-col gap-3">
        {sortedItems.length > 0 ? (
          sortedItems.map(item => <RiskCard key={item.id} item={item} />)
        ) : counts.all === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <p className="text-[24px] mb-2">✅</p>
            <p className="text-[14px] font-semibold text-green-800">탐지된 리스크 항목이 없습니다</p>
            <p className="text-[12px] text-green-700 mt-1">분석한 25개 항목에서 리스크가 발견되지 않았습니다.</p>
          </div>
        ) : (
          <div className="text-center py-6 text-[#aaa] text-[13px]">
            해당 필터 조건의 항목이 없습니다.
          </div>
        )}
      </div>

      {/* 면책 문구 */}
      <div className="mt-8 border-t border-[#E2E5EA] pt-5 text-center">
        <p className="text-[11px] text-[#aaa]">
          ⚠️ 이 분석은 AI가 생성한 참고 자료이며 법적 조언이 아닙니다.<br />
          최종 계약 체결 전 법률 전문가 검토를 권장합니다.
        </p>
      </div>
    </div>
  );
}
