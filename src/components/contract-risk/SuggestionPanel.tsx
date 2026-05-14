'use client';

import { CheckCircle, SkipForward } from 'lucide-react';
import { LawReferenceCard } from './LawReferenceCard';
import { RevisedClauseBox } from './RevisedClauseBox';
import { cn } from '@/lib/utils';
import type { SuggestionState } from '@/lib/types/contract-suggest';

interface SuggestionPanelProps {
  suggestion: SuggestionState | null;
  onAccept: (key: string) => void;
  onSkip: (key: string) => void;
  isLoading: boolean;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-6 bg-[#F7F8FA] rounded-2xl w-2/3" />
      <div className="space-y-2">
        <div className="h-4 bg-[#F7F8FA] rounded w-1/4" />
        <div className="h-24 bg-[#F7F8FA] rounded-2xl" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-[#F7F8FA] rounded w-1/4" />
        <div className="h-20 bg-[#EEF3FE] rounded-2xl" />
        <div className="h-20 bg-[#EEF3FE] rounded-2xl" />
      </div>
      <div className="h-28 bg-[#F0F5FF] rounded-2xl" />
    </div>
  );
}

export function SuggestionPanel({ suggestion, onAccept, onSkip, isLoading }: SuggestionPanelProps) {
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!suggestion) {
    return (
      <div className="flex-1 flex items-center justify-center text-[12px] text-[#888]">
        좌측 목록에서 항목을 선택하면 수정 제안이 표시됩니다.
      </div>
    );
  }

  const isAccepted = suggestion.decision === 'accepted';
  const isSkipped = suggestion.decision === 'skipped';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-4 sm:gap-5">
      {/* 헤더 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-mono text-[#888] bg-[#F7F8FA] border border-[#E2E5EA] px-1.5 py-0.5 rounded">
          {suggestion.item_key}
        </span>
        <span className="text-[14px] font-semibold text-[#1B1F2B]">
          {suggestion.item_name}
        </span>
        {isAccepted && (
          <span className="ml-auto flex items-center gap-1 text-[12px] text-green-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> 적용됨
          </span>
        )}
        {isSkipped && (
          <span className="ml-auto flex items-center gap-1 text-[12px] text-[#888] font-medium">
            <SkipForward className="w-3.5 h-3.5" /> 건너뜀
          </span>
        )}
      </div>

      {/* 원문 조항 */}
      <div className="flex flex-col">
        <span className="text-[12px] font-semibold text-[#888] block mb-2">원문 조항</span>
        <div className="rounded-2xl border border-[#E2E5EA] bg-[#F7F8FA] px-4 py-3.5 my-2.5">
          <p className="text-[13px] text-[#1B1F2B] leading-relaxed whitespace-pre-wrap">
            {suggestion.original || '(해당 조항이 계약서에 존재하지 않아 신규 추가가 필요합니다.)'}
          </p>
        </div>
      </div>

      {/* 관련 법령 */}
      {suggestion.laws.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-[#888] block">관련 법령</span>
          {suggestion.laws.map((law, i) => (
            <LawReferenceCard key={law.id} law={law} index={i + 1} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="rounded-2xl border border-[#E2E5EA] bg-[#F7F8FA] px-4 py-3.5 text-[12px] text-[#888] my-2.5">
            관련 법령을 찾지 못했습니다. 일반 계약 원칙에 따라 수정 제안이 작성되었습니다.
          </div>
        </div>
      )}

      {/* 수정 제안 조항 + 이유 */}
      <RevisedClauseBox revised={suggestion.revised} reason={suggestion.reason} />

      {/* 액션 버튼 */}
      {suggestion.decision === 'pending' && (
      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:gap-3">
        <button
          onClick={() => onSkip(suggestion.item_key)}
          className="flex-1 py-2.5 rounded-xl border border-[#E2E5EA] text-[13px] text-[#888] hover:bg-[#F7F8FA] transition-colors"
          >
            건너뜀
          </button>
          <button
            onClick={() => onAccept(suggestion.item_key)}
            className="flex-1 py-2.5 rounded-xl bg-[#2E6FF2] text-[13px] text-white font-medium hover:bg-[#245ED0] transition-colors"
          >
            이 조항 적용 ✓
          </button>
        </div>
      )}

      {suggestion.decision !== 'pending' && (
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:gap-3">
          <button
            onClick={() => onSkip(suggestion.item_key)}
            className={cn(
              'flex-1 py-2.5 rounded-xl border text-[13px] transition-colors',
              isSkipped
                ? 'border-[#E2E5EA] bg-[#F7F8FA] text-[#888]'
                : 'border-[#E2E5EA] text-[#888] hover:bg-[#F7F8FA]',
            )}
          >
            건너뜀
          </button>
          <button
            onClick={() => onAccept(suggestion.item_key)}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-colors',
              isAccepted
                ? 'bg-green-600 text-white'
                : 'bg-[#2E6FF2] text-white hover:bg-[#245ED0]',
            )}
          >
            {isAccepted ? '✓ 적용됨' : '이 조항 적용 ✓'}
          </button>
        </div>
      )}
    </div>
  );
}
