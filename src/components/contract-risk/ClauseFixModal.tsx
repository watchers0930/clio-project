'use client';

/**
 * ClauseFixModal — 법령 기반 계약 조항 수정 제안 모달
 * Step 1: 위험 조항 선택
 * Step 2: 법령 검색 + AI 수정 제안 확인
 * Step 3: 수락/수정/거부 선택 후 계약서 재다운로드
 */

import { useState, useCallback } from 'react';
import {
  X, Search, Scale, Wand2, Check, ThumbsDown, Edit3,
  Download, ChevronRight, AlertCircle, Loader2,
} from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import type { RiskItem } from '@/lib/types/contract-risk';
import { CONTRACT_RISK_ITEMS } from '@/lib/contract-risk-items';

interface LawResult {
  lawName: string;
  lawId: string;
  articleNo: string;
  articleContent: string;
  promulgationDate: string;
}

interface ClauseFixState {
  fixId: string | null;
  suggestedFix: string;
  lawResults: LawResult[];
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  finalText: string;
  loading: boolean;
}

interface ClauseFixModalProps {
  open: boolean;
  onClose: () => void;
  analysisId: string;
  riskItems: RiskItem[];    // HIGH/MEDIUM 조항 목록
}

const RISK_LEVEL_CLS: Record<string, string> = {
  high:   'bg-red-50 text-red-700 border border-red-200',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  low:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
};
const RISK_LEVEL_LABEL: Record<string, string> = {
  high: '고위험', medium: '중위험', low: '저위험',
};

export function ClauseFixModal({ open, onClose, analysisId, riskItems }: ClauseFixModalProps) {
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-[#E2E5EA] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2E6FF2]/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-[#2E6FF2]" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#1B1F2B]">법령 기반 조항 수정</h2>
              <p className="text-[12px] text-[#6B7280]">위험 조항을 법령에 근거하여 수정합니다</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-[#F7F8FA] flex items-center justify-center">
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        {/* 단계 표시 */}
        <div className="flex items-center gap-0 px-8 py-3 bg-[#F7F8FA] border-b border-[#E2E5EA] shrink-0">
          {(['조항 선택', 'AI 수정 제안', '다운로드'] as const).map((label, idx) => {
            const s = idx + 1;
            const active = step === s;
            const done = step > s;
            return (
              <div key={s} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    done ? 'bg-emerald-500 text-white' : active ? 'bg-[#2E6FF2] text-white' : 'bg-[#E2E5EA] text-[#6B7280]'
                  }`}>{done ? '✓' : s}</div>
                  <span className={`text-[12px] font-medium ${active ? 'text-[#1B1F2B]' : 'text-[#9CA3AF]'}`}>{label}</span>
                </div>
                {idx < 2 && <ChevronRight className="w-4 h-4 text-[#D1D5DB] mx-3" />}
              </div>
            );
          })}
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 px-8 py-6">

          {/* Step 1: 조항 선택 */}
          {step === 1 && (
            <div className="flex flex-col gap-[10px]">
              <p className="text-[13px] text-[#6B7280] mb-4">
                위험도 <span className="font-semibold text-red-600">고위험</span> /
                <span className="font-semibold text-amber-600"> 중위험</span> 조항 {targetItems.length}개 — 수정할 조항을 선택하세요.
              </p>
              {targetItems.map((item, idx) => {
                const fixed = allFixes.get(idx);
                const def = getItemDef(item);
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectItem(idx)}
                    className="w-full text-left border border-[#E2E5EA] rounded-xl p-4 hover:border-[#2E6FF2] hover:bg-[#2E6FF2]/5 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RISK_LEVEL_CLS[item.risk_level]}`}>
                            {RISK_LEVEL_LABEL[item.risk_level]}
                          </span>
                          {fixed && fixed.status !== 'pending' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-200">
                              {fixed.status === 'accepted' ? '수락됨' : fixed.status === 'rejected' ? '거부됨' : '수정됨'}
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] font-medium text-[#1B1F2B] group-hover:text-[#2E6FF2] transition-colors">
                          {def?.name ?? item.id}
                        </p>
                        {item.explanation && (
                          <p className="text-[12px] text-[#6B7280] mt-1 line-clamp-2">{item.explanation}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#9CA3AF] shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: 법령 검색 + AI 제안 */}
          {step === 2 && selectedIdx !== null && (
            <div className="space-y-5">
              <div className="p-4 bg-[#F7F8FA] rounded-xl border border-[#E2E5EA]">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RISK_LEVEL_CLS[targetItems[selectedIdx].risk_level]}`}>
                    {RISK_LEVEL_LABEL[targetItems[selectedIdx].risk_level]}
                  </span>
                </div>
                <p className="text-[14px] font-semibold text-[#1B1F2B]">
                  {getItemDef(targetItems[selectedIdx])?.name ?? targetItems[selectedIdx].id}
                </p>
              </div>

              {/* 법령 검색 */}
              <div>
                <label className="text-[12px] font-medium text-[#374151] mb-2 block">법령 검색</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={legalQuery}
                    onChange={e => setLegalQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLegalSearch()}
                    placeholder="검색어 입력 (예: 손해배상, 계약해지)"
                    className="flex-1 text-[13px] px-3 py-2 border border-[#E2E5EA] rounded-lg focus:outline-none focus:border-[#2E6FF2] bg-[#F7F8FA]"
                  />
                  <button
                    onClick={handleLegalSearch}
                    disabled={searchLoading || !legalQuery.trim()}
                    className="px-4 py-2 bg-[#1B1F2B] text-white rounded-lg text-[13px] font-medium disabled:opacity-40 hover:bg-[#2E6FF2] transition-colors flex items-center gap-1.5"
                  >
                    {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    검색
                  </button>
                </div>

                {/* 법령 결과 */}
                {fixState.lawResults.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {fixState.lawResults.map((law, i) => (
                      <div key={i} className="p-3 border border-[#E2E5EA] rounded-lg bg-white">
                        <div className="flex items-center gap-2 mb-1">
                          <Scale className="w-3 h-3 text-[#2E6FF2]" />
                          <span className="text-[12px] font-semibold text-[#2E6FF2]">
                            {law.lawName}{law.articleNo ? ` 제${law.articleNo}조` : ''}
                          </span>
                          {law.promulgationDate && (
                            <span className="text-[10px] text-[#9CA3AF]">{law.promulgationDate}</span>
                          )}
                        </div>
                        {law.articleContent && (
                          <p className="text-[12px] text-[#4B5563] line-clamp-3">{law.articleContent}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI 수정 제안 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-medium text-[#374151]">AI 수정 제안</label>
                  <button
                    onClick={handleSuggest}
                    disabled={fixState.loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2E6FF2] text-white rounded-lg text-[12px] font-medium disabled:opacity-40 hover:bg-[#2560d8] transition-colors"
                  >
                    {fixState.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    {fixState.suggestedFix ? '재생성' : 'AI 제안 받기'}
                  </button>
                </div>

                {fixState.suggestedFix ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-[#F0F7FF] rounded-xl border border-[#BFDBFE] text-[13px] text-[#1E3A5F] whitespace-pre-wrap leading-relaxed">
                      {fixState.suggestedFix}
                    </div>

                    {/* 수락/수정/거부 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusChange('accepted')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium border transition-colors ${
                          fixState.status === 'accepted'
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'border-[#E2E5EA] text-[#6B7280] hover:border-emerald-400 hover:text-emerald-600'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" /> 수락
                      </button>
                      <button
                        onClick={() => handleStatusChange('modified')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium border transition-colors ${
                          fixState.status === 'modified'
                            ? 'bg-[#2E6FF2] text-white border-[#2E6FF2]'
                            : 'border-[#E2E5EA] text-[#6B7280] hover:border-[#2E6FF2] hover:text-[#2E6FF2]'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> 수정 후 수락
                      </button>
                      <button
                        onClick={() => handleStatusChange('rejected')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium border transition-colors ${
                          fixState.status === 'rejected'
                            ? 'bg-red-500 text-white border-red-500'
                            : 'border-[#E2E5EA] text-[#6B7280] hover:border-red-400 hover:text-red-500'
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" /> 거부
                      </button>
                    </div>

                    {/* 수정 텍스트 영역 */}
                    {fixState.status === 'modified' && (
                      <textarea
                        value={fixState.finalText}
                        onChange={e => {
                          const updated = { ...fixState, finalText: e.target.value };
                          setFixState(updated);
                          if (selectedIdx !== null) setAllFixes(prev => new Map(prev).set(selectedIdx, updated));
                        }}
                        rows={6}
                        className="w-full text-[13px] px-3 py-3 border border-[#2E6FF2] rounded-xl focus:outline-none bg-white leading-relaxed"
                        placeholder="수정할 내용을 입력하세요"
                      />
                    )}
                  </div>
                ) : (
                  <div className="p-8 border border-dashed border-[#E2E5EA] rounded-xl text-center text-[13px] text-[#9CA3AF]">
                    법령 검색 후 &quot;AI 제안 받기&quot; 버튼을 눌러주세요
                  </div>
                )}
              </div>

              {/* 면책조항 */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  이 수정 제안은 AI가 생성한 참고 정보입니다. <strong>법률 전문가의 검토를 대체하지 않으며</strong>,
                  중요한 계약 체결 전 반드시 법무팀 또는 변호사와 상담하시기 바랍니다.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: 완료 */}
          {step === 3 && (
            <div className="text-center space-y-6 py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[#1B1F2B]">수정 계약서 생성 완료</h3>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  {acceptedCount}개 조항이 수정된 계약서가 준비됐습니다.
                </p>
              </div>
              <div className="bg-[#F7F8FA] rounded-xl p-4 text-left">
                <p className="text-[12px] text-[#6B7280]">완성 파일</p>
                <p className="text-[14px] font-medium text-[#1B1F2B] mt-1">{downloadFileName}</p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200 text-left">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-700">
                  이 문서는 AI 수정 제안이 반영된 초안입니다. 법률 전문가 검토 후 사용하시기 바랍니다.
                </p>
              </div>
              {downloadUrl && (
                <button
                  onClick={() => { const a = document.createElement('a'); a.href = downloadUrl; a.download = downloadFileName; a.click(); }}
                  className="flex items-center gap-2 mx-auto px-6 py-3 bg-[#2E6FF2] text-white rounded-xl text-[14px] font-medium hover:bg-[#2560d8] transition-colors"
                >
                  <Download className="w-4 h-4" />
                  수정 계약서 다운로드
                </button>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-[#E2E5EA] bg-[#F7F8FA] shrink-0">
          <button
            onClick={() => {
              if (step === 1) handleClose();
              else if (step === 2) setStep(1);
              else setStep(2);
            }}
            disabled={generating}
            className="px-4 py-2 text-[13px] text-[#6B7280] hover:text-[#1B1F2B] disabled:opacity-40 transition-colors"
          >
            {step === 1 ? '취소' : '← 이전'}
          </button>

          {step === 1 && targetItems.length === 0 && (
            <p className="text-[13px] text-[#9CA3AF]">수정 가능한 위험 조항이 없습니다</p>
          )}

          {step === 2 && (
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-[#6B7280]">
                처리됨: <span className="font-semibold text-[#1B1F2B]">{Array.from(allFixes.values()).filter(f => f.status !== 'pending').length}</span>/{targetItems.length}
              </span>
              <button
                onClick={() => setStep(3)}
                disabled={acceptedCount === 0 || generating}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2E6FF2] text-white rounded-xl text-[13px] font-medium hover:bg-[#2560d8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="다른 조항도 선택하거나 바로 계약서 생성"
              >
                다른 조항 추가하기 →
              </button>
              <button
                onClick={handleGenerate}
                disabled={acceptedCount === 0 || generating}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1B1F2B] text-white rounded-xl text-[13px] font-medium hover:bg-[#2E6FF2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? <><Spinner size="sm" /> 생성 중...</> : <><Download className="w-4 h-4" /> 계약서 재생성</>}
              </button>
            </div>
          )}

          {step === 3 && (
            <button
              onClick={handleClose}
              className="px-5 py-2.5 bg-[#1B1F2B] text-white rounded-xl text-[13px] font-medium hover:bg-[#2d3344] transition-colors"
            >
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
