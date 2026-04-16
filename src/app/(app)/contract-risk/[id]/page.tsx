'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, AlertCircle, ShieldCheck, Scale, X } from 'lucide-react';
import { RiskSummary } from '@/components/contract-risk/RiskSummary';
import { RiskFilter } from '@/components/contract-risk/RiskFilter';
import { RiskCard } from '@/components/contract-risk/RiskCard';
import { RiskItemSidebar } from '@/components/contract-risk/RiskItemSidebar';
import { SuggestionPanel } from '@/components/contract-risk/SuggestionPanel';
import { BulkApplyBar } from '@/components/contract-risk/BulkApplyBar';
import { CONTRACT_TYPE_LABELS, PERSPECTIVE_LABELS, CONTRACT_RISK_ITEMS } from '@/lib/contract-risk-items';
import type { ContractRiskAnalysis, RiskFilterState } from '@/lib/types/contract-risk';
import type { SuggestionItem, SuggestionState, DecisionStatus } from '@/lib/types/contract-suggest';

export default function ContractRiskResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // ── 기존 상태 ─────────────────────────────────────────────────────────
  const [analysis, setAnalysis] = useState<ContractRiskAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [filter, setFilter] = useState<RiskFilterState>({ level: 'all', category: 'all' });

  // ── 수정 제안 상태 ────────────────────────────────────────────────────
  const [suggestMode, setSuggestMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<SuggestionState[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [outputFormat, setOutputFormat] = useState<'docx' | 'hwpx'>('docx');

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

  // ── 필터링 / 정렬 ─────────────────────────────────────────────────────
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

  const foundItems = useMemo(() => analysis?.risk_result.items.filter(i => i.found) ?? [], [analysis]);

  // ── DOCX 리포트 다운로드 ──────────────────────────────────────────────
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

  // ── 수정 제안 모드 진입 ───────────────────────────────────────────────
  const handleEnterSuggestMode = () => {
    // found 항목 전체 선택 상태로 진입
    const keys = new Set(foundItems.map(i => i.id));
    setSelectedKeys(keys);
    setSuggestions([]);
    setActiveKey(null);
    setSuggestMode(true);
  };

  const handleExitSuggestMode = () => {
    setSuggestMode(false);
    setSuggestions([]);
    setSelectedKeys(new Set());
    setActiveKey(null);
  };

  // ── 항목 선택/해제 ────────────────────────────────────────────────────
  const toggleSelect = useCallback((key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(foundItems.map(i => i.id)));
  }, [foundItems]);

  const clearAll = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  // ── 수정 제안 생성 API 호출 ──────────────────────────────────────────
  const handleSuggestStart = async () => {
    if (selectedKeys.size === 0 || isSuggesting) return;
    setIsSuggesting(true);
    setSuggestions([]);

    try {
      const res = await fetch(`/api/contract-risk/${id}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_keys: Array.from(selectedKeys) }),
      });

      if (!res.ok) {
        const j = await res.json();
        alert(j.message ?? '수정 제안 생성에 실패했습니다.');
        return;
      }

      const json = await res.json() as { suggestions: SuggestionItem[] };
      const states: SuggestionState[] = json.suggestions.map(s => ({ ...s, decision: 'pending' as DecisionStatus }));
      setSuggestions(states);
      setActiveKey(states[0]?.item_key ?? null);
    } catch {
      alert('수정 제안 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSuggesting(false);
    }
  };

  // ── 조항 수락/건너뜀 ─────────────────────────────────────────────────
  const handleAccept = useCallback((key: string) => {
    setSuggestions(prev =>
      prev.map(s => s.item_key === key ? { ...s, decision: 'accepted' as DecisionStatus } : s),
    );
    // 다음 pending 항목으로 이동
    setSuggestions(prev => {
      const idx = prev.findIndex(s => s.item_key === key);
      const next = prev.slice(idx + 1).find(s => s.decision === 'pending');
      if (next) setActiveKey(next.item_key);
      return prev;
    });
  }, []);

  const handleSkip = useCallback((key: string) => {
    setSuggestions(prev =>
      prev.map(s => s.item_key === key ? { ...s, decision: 'skipped' as DecisionStatus } : s),
    );
    setSuggestions(prev => {
      const idx = prev.findIndex(s => s.item_key === key);
      const next = prev.slice(idx + 1).find(s => s.decision === 'pending');
      if (next) setActiveKey(next.item_key);
      return prev;
    });
  }, []);

  // ── 파일 다운로드 (apply API) ─────────────────────────────────────────
  const handleBulkDownload = async () => {
    const accepted = suggestions.filter(s => s.decision === 'accepted');
    if (accepted.length === 0) return;
    setIsApplying(true);

    try {
      const res = await fetch(`/api/contract-risk/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestions: accepted.map(s => ({ item_key: s.item_key, revised: s.revised })),
          outputFormat,
        }),
      });

      if (!res.ok) {
        const j = await res.json();
        alert(j.message ?? '파일 생성에 실패했습니다.');
        return;
      }

      const json = await res.json() as { signedUrl: string; fileName: string };
      const a = document.createElement('a');
      a.href = json.signedUrl;
      a.download = json.fileName;
      a.target = '_blank';
      a.click();
    } catch {
      alert('파일 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  const activeSuggestion = suggestions.find(s => s.item_key === activeKey) ?? null;
  const acceptedCount = suggestions.filter(s => s.decision === 'accepted').length;

  // ── 로딩 / 에러 화면 ─────────────────────────────────────────────────
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

  // ── 수정 제안 모드 (2컬럼) ────────────────────────────────────────────
  if (suggestMode) {
    return (
      <div className="h-full flex flex-col bg-[#F7F8FA]">
        {/* 헤더 */}
        <div className="bg-white border-b border-[#E2E5EA] sticky top-0 z-20">
          <div className="px-6 py-0 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={handleExitSuggestMode}
                className="flex items-center gap-1.5 text-[12px] text-[#888] hover:text-[#1B1F2B] transition-colors shrink-0"
              >
                <ArrowLeft size={14} /> 분석 결과로
              </button>
              <span className="text-[#E2E5EA]">/</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[#EEF3FE] rounded-lg flex items-center justify-center shrink-0">
                  <Scale size={12} className="text-[#2E6FF2]" />
                </div>
                <span className="text-[13px] font-semibold text-[#1B1F2B]">
                  법령 기반 조항 수정 제안
                </span>
              </div>
            </div>
            <button
              onClick={handleExitSuggestMode}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#888] hover:text-[#1B1F2B] hover:bg-[#F7F8FA] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 2컬럼 본문 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 좌: 항목 사이드바 (320px 고정) */}
          <div className="w-80 flex-shrink-0 bg-white border-r border-[#E2E5EA] flex flex-col overflow-hidden">
            <RiskItemSidebar
              items={foundItems}
              selectedKeys={selectedKeys}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAll}
              onClearAll={clearAll}
              activeKey={activeKey}
              onActivate={setActiveKey}
              suggestions={suggestions}
              isSuggesting={isSuggesting}
              onSuggestStart={handleSuggestStart}
            />
          </div>

          {/* 우: 수정 제안 패널 */}
          <div className="flex-1 bg-white flex flex-col overflow-hidden">
            <SuggestionPanel
              suggestion={activeSuggestion}
              onAccept={handleAccept}
              onSkip={handleSkip}
              isLoading={isSuggesting}
            />
          </div>
        </div>

        {/* 하단 BulkApplyBar */}
        <BulkApplyBar
          acceptedCount={acceptedCount}
          totalCount={suggestions.length}
          outputFormat={outputFormat}
          onFormatChange={setOutputFormat}
          onDownload={handleBulkDownload}
          isApplying={isApplying}
        />
      </div>
    );
  }

  // ── 기본 단일 컬럼 (기존 분석 결과 뷰) ───────────────────────────────
  return (
    <div className="min-h-full bg-[#F7F8FA]">

      {/* 상단 헤더 바 */}
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
            {total > 0 && (
              <button
                onClick={handleEnterSuggestMode}
                className="flex items-center gap-2 px-4 py-2 border border-[#2E6FF2] text-[#2E6FF2] rounded-xl text-[12px] font-medium hover:bg-[#2E6FF2]/5 transition-colors"
              >
                <Scale size={13} /> 조항 수정 제안
              </button>
            )}
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

        {/* 탐지 항목 없음 */}
        {total === 0 && (
          <div className="bg-white border border-[#E2E5EA] rounded-2xl p-10 text-center">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={24} className="text-emerald-600" />
            </div>
            <p className="text-[16px] font-bold text-emerald-800 mb-1">리스크가 탐지되지 않았습니다</p>
            <p className="text-[13px] text-emerald-700">분석한 25개 항목에서 리스크가 발견되지 않았습니다.</p>
          </div>
        )}

        {/* 필터 + 항목 목록 */}
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

        {/* 면책 */}
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
