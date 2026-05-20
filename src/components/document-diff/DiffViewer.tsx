'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown, AlignLeft, Columns2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SideBySideView } from './SideBySideView';
import { InlineView } from './InlineView';
import { DiffAnalysisPanel } from './DiffAnalysisPanel';
import { VersionSelector } from './VersionSelector';
import type { DiffResult } from '@/lib/utils/myers-diff';

interface VersionMeta {
  id: string;
  versionNumber: number;
  createdAt: string;
  title: string;
}

interface DiffViewerProps {
  baseDocumentId: string;       // 기준(구) 버전 ID
  compareDocumentId: string;    // 비교(신) 버전 ID
  documentType?: string;
  onCompareChange?: (newCompareId: string) => void; // URL 쿼리스트링 업데이트용
}

export function DiffViewer({
  baseDocumentId,
  compareDocumentId,
  documentType,
  onCompareChange,
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'inline'>('side-by-side');
  const [diffResult, setDiffResult] = useState<(DiffResult & { truncated?: boolean; from?: VersionMeta; to?: VersionMeta }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentChangeIdx, setCurrentChangeIdx] = useState(0);
  const changeRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // 반응형: 1024px 미만 시 inline 강제
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1024) setViewMode('inline');
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // diff 계산
  useEffect(() => {
    if (!baseDocumentId || !compareDocumentId) return;

    async function fetchDiff() {
      setIsLoading(true);
      setError(null);
      setDiffResult(null);
      changeRefs.current = [];
      setCurrentChangeIdx(0);

      try {
        const res = await fetch(`/api/documents/${baseDocumentId}/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ compareWith: compareDocumentId }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error?.message ?? 'diff 계산에 실패했습니다.');
          return;
        }
        setDiffResult(json);
      } catch {
        setError('네트워크 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDiff();
  }, [baseDocumentId, compareDocumentId]);

  const totalChanges = diffResult
    ? diffResult.stats.added + diffResult.stats.removed + diffResult.stats.changed
    : 0;

  const handleChangeRef = useCallback((idx: number, el: HTMLTableRowElement | null) => {
    changeRefs.current[idx] = el;
  }, []);

  function navigateChange(delta: number) {
    const next = currentChangeIdx + delta;
    if (next < 0 || next >= totalChanges) return;
    setCurrentChangeIdx(next);
    changeRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 버전 선택 바 */}
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:p-4 bg-white border border-border rounded-xl">
        <div className="flex-1">
          <VersionSelector
            label="기준 버전 (구)"
            currentDocumentId={baseDocumentId}
            selectedVersionId={baseDocumentId}
            disabledVersionId={compareDocumentId}
            onVersionChange={(id) => onCompareChange && onCompareChange(id)}
          />
        </div>
        <div className="flex items-end justify-center pb-1">
          <span className="text-foreground-quaternary text-sm">→</span>
        </div>
        <div className="flex-1">
          <VersionSelector
            label="비교 버전 (신)"
            currentDocumentId={baseDocumentId}
            selectedVersionId={compareDocumentId}
            disabledVersionId={baseDocumentId}
            onVersionChange={(id) => onCompareChange && onCompareChange(id)}
          />
        </div>
      </div>

      {/* 통계 바 + 뷰 토글 */}
      {diffResult && (
        <div className="flex flex-col gap-3.5 px-4 py-4 sm:px-5 bg-white border border-border rounded-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[13px]">
            <span className="font-semibold text-foreground">변경 통계</span>
            <span className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2.5 py-1 rounded-full text-[12px]">
              <span>+{diffResult.stats.added}</span>
            </span>
            <span className="flex items-center gap-1.5 text-red-700 bg-red-50 px-2.5 py-1 rounded-full text-[12px]">
              <span>-{diffResult.stats.removed}</span>
            </span>
            <span className="flex items-center gap-1.5 text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-full text-[12px]">
              <span>~{diffResult.stats.changed}</span>
            </span>
            {diffResult.truncated && (
              <span className="flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-orange-600 text-[11px]">
                <AlertTriangle size={12} />
                50,000자 초과 — 일부만 표시
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* 변경 네비게이션 */}
            {totalChanges > 0 && (
              <div className="flex w-full items-center gap-1 border border-border rounded-lg overflow-hidden sm:w-auto">
                <button
                  onClick={() => navigateChange(-1)}
                  disabled={currentChangeIdx === 0}
                  className="px-2.5 py-2 hover:bg-surface-secondary disabled:opacity-30 transition-colors"
                  aria-label="이전 변경"
                >
                  <ChevronUp size={14} />
                </button>
                <span className="px-3 text-[12px] text-foreground-secondary min-w-[72px] text-center">
                  {currentChangeIdx + 1} / {totalChanges}
                </span>
                <button
                  onClick={() => navigateChange(1)}
                  disabled={currentChangeIdx >= totalChanges - 1}
                  className="px-2.5 py-2 hover:bg-surface-secondary disabled:opacity-30 transition-colors"
                  aria-label="다음 변경"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            )}

            {/* 뷰 모드 토글 (1024px 이상만) */}
            <div className="hidden lg:flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('side-by-side')}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 text-[12px] transition-colors',
                  viewMode === 'side-by-side'
                    ? 'bg-primary text-white'
                    : 'text-foreground-secondary hover:bg-surface-secondary',
                )}
              >
                <Columns2 size={13} />
                Side-by-Side
              </button>
              <button
                onClick={() => setViewMode('inline')}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 text-[12px] transition-colors',
                  viewMode === 'inline'
                    ? 'bg-primary text-white'
                    : 'text-foreground-secondary hover:bg-surface-secondary',
                )}
              >
                <AlignLeft size={13} />
                Inline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white border border-border rounded-xl">
          <svg className="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-[13px] text-foreground-quaternary">두 버전의 차이를 계산하는 중...</p>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-red-700">diff 계산 실패</p>
            <p className="text-[12px] text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* 변경 없음 */}
      {diffResult && totalChanges === 0 && (
        <div className="py-16 text-center bg-white border border-border rounded-xl">
          <p className="text-[32px] mb-3">✅</p>
          <p className="text-[14px] font-medium text-foreground">변경 사항이 없습니다</p>
          <p className="text-[12px] text-foreground-quaternary mt-1">두 버전의 내용이 완전히 동일합니다.</p>
        </div>
      )}

      {/* diff 뷰 */}
      {diffResult && totalChanges > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          {/* 버전 헤더 */}
          {diffResult.from && diffResult.to && (
            <div className="grid grid-cols-1 border-b border-border text-[12px] sm:grid-cols-2">
              <div className="px-3 py-2 text-foreground-secondary font-medium border-b border-border sm:px-4 sm:border-b-0 sm:border-r">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span>v{diffResult.from.versionNumber} — {diffResult.from.createdAt}</span>
                  <span className="text-foreground-quaternary font-normal break-all">{diffResult.from.title}</span>
                </div>
              </div>
              <div className="px-3 py-2 text-foreground-secondary font-medium sm:px-4">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span>v{diffResult.to.versionNumber} — {diffResult.to.createdAt}</span>
                  <span className="text-foreground-quaternary font-normal break-all">{diffResult.to.title}</span>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'side-by-side' ? (
            <SideBySideView lines={diffResult.lines} onChangeRef={handleChangeRef} />
          ) : (
            <InlineView lines={diffResult.lines} onChangeRef={handleChangeRef} />
          )}
        </div>
      )}

      {/* AI 분석 패널 */}
      {diffResult && totalChanges > 0 && (
        <DiffAnalysisPanel
          diffResult={diffResult}
          documentType={documentType}
          baseDocumentId={baseDocumentId}
          documentTitle={diffResult.to?.title ?? diffResult.from?.title}
        />
      )}
    </div>
  );
}
