import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import type { RiskItem } from '@/lib/types/contract-risk';
import { CONTRACT_RISK_ITEMS } from '@/lib/contract-risk-items';
import type { ClauseFixState } from '@/components/contract-risk/clause-fix-types';

interface UseClauseFixParams {
  onClose: () => void;
  analysisId: string;
  riskItems: RiskItem[];
}

/** ClauseFixModal 상태·핸들러 — 조항 선택, 법령 검색, AI 제안, 계약서 재생성 */
export function useClauseFix({ onClose, analysisId, riskItems }: UseClauseFixParams) {
  const toast = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [legalQuery, setLegalQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [fixState, setFixState] = useState<ClauseFixState>({
    fixId: null, suggestedFix: '', lawResults: [],
    status: 'pending', finalText: '', loading: false,
  });
  const [allFixes, setAllFixes] = useState<Map<number, ClauseFixState>>(new Map());
  const [generating, setGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState('');

  // HIGH/MEDIUM만 노출
  const targetItems = riskItems.filter(item =>
    item.risk_level === 'high' || item.risk_level === 'medium'
  );

  // id로 정의에서 name/description 조회
  const getItemDef = (item: RiskItem) =>
    CONTRACT_RISK_ITEMS.find(r => r.id === item.id);

  const handleClose = useCallback(() => {
    setStep(1);
    setSelectedIdx(null);
    setLegalQuery('');
    setFixState({ fixId: null, suggestedFix: '', lawResults: [], status: 'pending', finalText: '', loading: false });
    setAllFixes(new Map());
    setGenerating(false);
    setDownloadUrl(null);
    onClose();
  }, [onClose]);

  const handleSelectItem = (idx: number) => {
    setSelectedIdx(idx);
    const existing = allFixes.get(idx);
    if (existing) {
      setFixState(existing);
    } else {
      setFixState({ fixId: null, suggestedFix: '', lawResults: [], status: 'pending', finalText: '', loading: false });
    }
    // 법령 쿼리 자동 세팅
    const item = targetItems[idx];
    const def = getItemDef(item);
    setLegalQuery(def?.name ?? item.id);
    setStep(2);
  };

  const handleLegalSearch = async () => {
    if (!legalQuery.trim()) return;
    setSearchLoading(true);

    try {
      const res = await fetch(`/api/legal-search?query=${encodeURIComponent(legalQuery)}&display=5`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? '법령 검색에 실패했습니다.'); return; }
      setFixState(prev => ({ ...prev, lawResults: data.results ?? [] }));
    } catch {
      toast.error('네트워크 오류가 발생했습니다.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSuggest = async () => {
    if (selectedIdx === null) return;
    const item = targetItems[selectedIdx];

    setFixState(prev => ({ ...prev, loading: true }));
    const def = getItemDef(item);
    try {
      const res = await fetch('/api/contract-fix/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId,
          clauseIndex: selectedIdx,
          clauseTitle: def?.name ?? item.id,
          clauseText: item.explanation || item.excerpt || def?.description || item.id,
          lawReferences: fixState.lawResults,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'AI 제안에 실패했습니다.'); return; }

      const updated: ClauseFixState = {
        ...fixState,
        fixId: data.fixId,
        suggestedFix: data.suggestedFix,
        finalText: data.suggestedFix,
        loading: false,
      };
      setFixState(updated);
      setAllFixes(prev => new Map(prev).set(selectedIdx, updated));
    } catch {
      toast.error('네트워크 오류가 발생했습니다.');
    } finally {
      setFixState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleStatusChange = (status: 'accepted' | 'rejected' | 'modified') => {
    const updated = { ...fixState, status };
    setFixState(updated);
    if (selectedIdx !== null) {
      setAllFixes(prev => new Map(prev).set(selectedIdx, updated));
    }
  };

  const handleGenerate = async () => {
    const fixes = Array.from(allFixes.entries())
      .filter(([, f]) => f.fixId && f.status !== 'pending')
      .map(([, f]) => ({
        fixId: f.fixId!,
        finalText: f.finalText,
        status: f.status as 'accepted' | 'rejected' | 'modified',
      }));

    if (fixes.length === 0) {
      toast.error('수락 또는 수정된 제안이 없습니다.');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/contract-fix/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId, fixes }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? '계약서 재생성에 실패했습니다.'); return; }

      setDownloadUrl(data.downloadUrl);
      setDownloadFileName(data.fileName);
      setStep(3);
    } catch {
      toast.error('네트워크 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const acceptedCount = Array.from(allFixes.values()).filter(f => f.status !== 'pending' && f.status !== 'rejected').length;

  return {
    step, setStep, selectedIdx, legalQuery, setLegalQuery, searchLoading,
    fixState, setFixState, allFixes, setAllFixes, generating,
    downloadUrl, downloadFileName, targetItems, getItemDef, acceptedCount,
    handleClose, handleSelectItem, handleLegalSearch, handleSuggest,
    handleStatusChange, handleGenerate,
  };
}
