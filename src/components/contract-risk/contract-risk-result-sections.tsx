import { ArrowLeft, AlertCircle, RefreshCw, Scale, X } from 'lucide-react';
import { RiskItemSidebar } from '@/components/contract-risk/RiskItemSidebar';
import { SuggestionPanel } from '@/components/contract-risk/SuggestionPanel';
import { BulkApplyBar } from '@/components/contract-risk/BulkApplyBar';
import type { RiskItem } from '@/lib/types/contract-risk';
import type { SuggestionState } from '@/lib/types/contract-suggest';

export function ContractRiskResultLoading() {
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

export function ContractRiskResultError({
  error,
  onBack,
}: {
  error: string | null;
  onBack: () => void;
}) {
  return (
    <div className="min-h-full bg-[#F7F8FA] flex items-center justify-center p-6">
      <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={22} className="text-red-500" />
        </div>
        <p className="text-[15px] font-semibold text-[#1B1F2B] mb-1">결과를 불러올 수 없습니다</p>
        <p className="text-[13px] text-[#888] mb-6">{error}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B1F2B] text-white rounded-xl text-[13px] font-medium hover:bg-[#2E3340] transition-colors"
        >
          <ArrowLeft size={14} /> 목록으로
        </button>
      </div>
    </div>
  );
}

export function ContractRiskSuggestLayout({
  foundItems,
  selectedKeys,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  activeKey,
  onActivate,
  suggestions,
  activeSuggestion,
  isSuggesting,
  onSuggestStart,
  onAccept,
  onSkip,
  acceptedCount,
  outputFormat,
  onFormatChange,
  onDownload,
  isApplying,
  onExit,
}: {
  foundItems: RiskItem[];
  selectedKeys: Set<string>;
  onToggleSelect: (key: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  activeKey: string | null;
  onActivate: (key: string | null) => void;
  suggestions: SuggestionState[];
  activeSuggestion: SuggestionState | null;
  isSuggesting: boolean;
  onSuggestStart: () => void;
  onAccept: (key: string) => void;
  onSkip: (key: string) => void;
  acceptedCount: number;
  outputFormat: 'docx' | 'hwpx';
  onFormatChange: (format: 'docx' | 'hwpx') => void;
  onDownload: () => void;
  isApplying: boolean;
  onExit: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#F7F8FA]">
      <div className="bg-white border-b border-[#E2E5EA] sticky top-0 z-20">
        <div className="flex h-auto items-center justify-between gap-3 px-4 py-3 sm:h-14 sm:px-6 sm:py-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 text-[12px] text-[#888] hover:text-[#1B1F2B] transition-colors shrink-0"
            >
              <ArrowLeft size={14} /> 분석 결과로
            </button>
            <span className="text-[#E2E5EA]">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#EEF3FE] rounded-lg flex items-center justify-center shrink-0">
                <Scale size={12} className="text-[#2E6FF2]" />
              </div>
              <span className="text-[13px] font-semibold text-[#1B1F2B]">법령 기반 조항 수정 제안</span>
            </div>
          </div>
          <button
            onClick={onExit}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#888] hover:text-[#1B1F2B] hover:bg-[#F7F8FA] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex max-h-[42vh] flex-col overflow-hidden border-b border-[#E2E5EA] bg-white lg:max-h-none lg:w-[380px] lg:flex-shrink-0 lg:border-b-0 lg:border-r">
          <RiskItemSidebar
            items={foundItems}
            selectedKeys={selectedKeys}
            onToggleSelect={onToggleSelect}
            onSelectAll={onSelectAll}
            onClearAll={onClearAll}
            activeKey={activeKey}
            onActivate={onActivate}
            suggestions={suggestions}
            isSuggesting={isSuggesting}
            onSuggestStart={onSuggestStart}
          />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden bg-white">
          <SuggestionPanel
            suggestion={activeSuggestion}
            onAccept={onAccept}
            onSkip={onSkip}
            isLoading={isSuggesting}
          />
        </div>
      </div>

      <BulkApplyBar
        acceptedCount={acceptedCount}
        totalCount={suggestions.length}
        outputFormat={outputFormat}
        onFormatChange={onFormatChange}
        onDownload={onDownload}
        isApplying={isApplying}
      />
    </div>
  );
}

export function ContractRiskApplyErrorModal({
  applyError,
  onClose,
  onRetry,
}: {
  applyError: { type: 'file_not_found' | 'general'; message: string } | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  if (!applyError) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertCircle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#1B1F2B] mb-1">
              {applyError.type === 'file_not_found' ? '원본 파일을 찾을 수 없습니다' : '파일 생성 실패'}
            </p>
            <p className="text-[12px] text-[#888] leading-relaxed">
              {applyError.type === 'file_not_found'
                ? '이 분석은 이전 버전에서 생성되어 원본 파일이 저장되지 않았습니다. 계약서 파일을 다시 업로드하여 새로 분석하면 다운로드가 가능합니다.'
                : applyError.message}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E2E5EA] text-[13px] text-[#888] hover:bg-[#F7F8FA] transition-colors"
          >
            닫기
          </button>
          {applyError.type === 'file_not_found' && (
            <button
              onClick={onRetry}
              className="flex-1 py-2.5 rounded-xl bg-[#2E6FF2] text-[13px] text-white font-medium hover:bg-[#245ED0] transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={13} /> 새로 분석하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
