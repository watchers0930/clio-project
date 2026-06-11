'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CONTRACT_RISK_ITEMS } from '@/lib/contract-risk-items';
import type { ContractRiskAnalysis, RiskFilterState } from '@/lib/types/contract-risk';
import type { SuggestionItem, SuggestionState, DecisionStatus } from '@/lib/types/contract-suggest';

export function useContractRiskResult() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // ── 기본 상태 ─────────────────────────────────────────────────────────
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
  const [applyError, setApplyError] = useState<{ type: 'file_not_found' | 'general'; message: string } | null>(null);

  // ── 데이터 로드 ───────────────────────────────────────────────────────
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
      .then(json => {
        const nextAnalysis = json.data as ContractRiskAnalysis;
        setAnalysis(nextAnalysis);
        if (nextAnalysis.file_type === 'hwpx') setOutputFormat('hwpx');
        else setOutputFormat('docx');
      })
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
  const total = analysis ? analysis.risk_count.high + analysis.risk_count.medium + analysis.risk_count.low : 0;
  const canApplySuggestions = analysis?.file_type === 'docx' || analysis?.file_type === 'hwpx';
  const allowedOutputFormats = useMemo<('docx' | 'hwpx')[]>(() => {
    if (analysis?.file_type === 'hwpx') return ['hwpx'];
    return ['docx'];
  }, [analysis?.file_type]);

  // ── DOCX 리포트 다운로드 ──────────────────────────────────────────────
  const handleDownload = useCallback(async (format: 'docx' | 'pdf' = 'docx') => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/contract-risk/${id}/download?format=${format}`);
      if (!res.ok) { alert('다운로드에 실패했습니다.'); return; }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const match = cd.match(/filename\*=UTF-8''(.+)/i) ?? cd.match(/filename="?([^"]+)"?/i);
      const fileName = match ? decodeURIComponent(match[1]) : `risk-report-${id}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [id]);

  // ── 수정 제안 모드 진입/퇴장 ──────────────────────────────────────────
  const handleEnterSuggestMode = useCallback(() => {
    if (!canApplySuggestions) {
      alert('조항 수정 파일 생성은 DOCX 또는 HWPX 원본에서만 지원합니다.');
      return;
    }
    const keys = new Set(foundItems.map(i => i.id));
    setSelectedKeys(keys);
    setSuggestions([]);
    setActiveKey(null);
    setSuggestMode(true);
  }, [canApplySuggestions, foundItems]);

  const handleExitSuggestMode = useCallback(() => {
    setSuggestMode(false);
    setSuggestions([]);
    setSelectedKeys(new Set());
    setActiveKey(null);
  }, []);

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
  const handleSuggestStart = useCallback(async () => {
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
  }, [id, selectedKeys, isSuggesting]);

  // ── 조항 수락/건너뜀 ─────────────────────────────────────────────────
  const advanceToNext = useCallback((key: string) => {
    setSuggestions(prev => {
      const idx = prev.findIndex(s => s.item_key === key);
      const next = prev.slice(idx + 1).find(s => s.decision === 'pending');
      if (next) setActiveKey(next.item_key);
      return prev;
    });
  }, []);

  const handleAccept = useCallback((key: string) => {
    setSuggestions(prev =>
      prev.map(s => s.item_key === key ? { ...s, decision: 'accepted' as DecisionStatus } : s),
    );
    advanceToNext(key);
  }, [advanceToNext]);

  const handleSkip = useCallback((key: string) => {
    setSuggestions(prev =>
      prev.map(s => s.item_key === key ? { ...s, decision: 'skipped' as DecisionStatus } : s),
    );
    advanceToNext(key);
  }, [advanceToNext]);

  // ── 수정 제안 편집 ───────────────────────────────────────────────────
  const handleEditRevised = useCallback((key: string, text: string) => {
    setSuggestions(prev =>
      prev.map(s => s.item_key === key ? { ...s, editedRevised: text } : s),
    );
  }, []);

  // ── 파일 다운로드 (apply API) ─────────────────────────────────────────
  const handleBulkDownload = useCallback(async () => {
    const accepted = suggestions.filter(s => s.decision === 'accepted');
    if (accepted.length === 0) return;
    setIsApplying(true);

    try {
      const res = await fetch(`/api/contract-risk/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestions: accepted.map(s => ({
            item_key: s.item_key,
            revised: s.editedRevised ?? s.revised,
          })),
          outputFormat,
        }),
      });

      if (!res.ok) {
        const j = await res.json();
        if (j.error === 'NOT_FOUND' && j.message?.includes('원본 계약서')) {
          setApplyError({ type: 'file_not_found', message: j.message });
        } else {
          setApplyError({ type: 'general', message: j.message ?? '파일 생성에 실패했습니다.' });
        }
        return;
      }

      const json = await res.json() as { signedUrl: string; fileName: string };
      const a = document.createElement('a');
      a.href = json.signedUrl;
      a.download = json.fileName;
      a.target = '_blank';
      a.click();
    } catch {
      setApplyError({ type: 'general', message: '파일 다운로드 중 오류가 발생했습니다.' });
    } finally {
      setIsApplying(false);
    }
  }, [id, suggestions, outputFormat]);

  const activeSuggestion = suggestions.find(s => s.item_key === activeKey) ?? null;
  const acceptedCount = suggestions.filter(s => s.decision === 'accepted').length;

  return {
    // 기본
    id, router, analysis, loading, error, downloading, total,
    // 필터
    filter, setFilter, counts, sortedItems, foundItems,
    // 제안 모드
    suggestMode, selectedKeys, suggestions, activeKey, setActiveKey,
    isSuggesting, isApplying, outputFormat, setOutputFormat, applyError, setApplyError,
    activeSuggestion, acceptedCount,
    // 핸들러
    canApplySuggestions, allowedOutputFormats,
    handleDownload, handleEnterSuggestMode, handleExitSuggestMode,
    toggleSelect, selectAll, clearAll,
    handleSuggestStart, handleAccept, handleSkip, handleEditRevised, handleBulkDownload,
  };
}
