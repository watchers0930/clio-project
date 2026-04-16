'use client';

import { AlertCircle, AlertTriangle, Info, CheckCircle, SkipForward, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONTRACT_RISK_ITEMS } from '@/lib/contract-risk-items';
import type { RiskItem } from '@/lib/types/contract-risk';
import type { SuggestionState, DecisionStatus } from '@/lib/types/contract-suggest';

interface RiskItemSidebarProps {
  items: RiskItem[];
  selectedKeys: Set<string>;
  onToggleSelect: (key: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  activeKey: string | null;
  onActivate: (key: string) => void;
  suggestions: SuggestionState[];
  isSuggesting: boolean;
  onSuggestStart: () => void;
}

const RISK_ICON = {
  high: AlertCircle,
  medium: AlertTriangle,
  low: Info,
};
const RISK_COLOR = {
  high: 'text-red-500',
  medium: 'text-amber-500',
  low: 'text-emerald-600',
};

function getDecision(key: string, suggestions: SuggestionState[]): DecisionStatus | null {
  const s = suggestions.find((s) => s.item_key === key);
  return s ? s.decision : null;
}

export function RiskItemSidebar({
  items,
  selectedKeys,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  activeKey,
  onActivate,
  suggestions,
  isSuggesting,
  onSuggestStart,
}: RiskItemSidebarProps) {
  const foundItems = items.filter((i) => i.found);

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E5EA]">
        <span className="text-[14px] font-semibold text-[#1B1F2B]">조항 목록</span>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-[12px] text-[#2E6FF2] hover:underline"
          >
            전체선택
          </button>
          <span className="text-[#E2E5EA]">|</span>
          <button
            onClick={onClearAll}
            className="text-[12px] text-[#888] hover:underline"
          >
            해제
          </button>
        </div>
      </div>

      {/* 항목 목록 */}
      <div className="flex-1 overflow-y-auto py-2">
        {foundItems.length === 0 && (
          <p className="px-5 py-4 text-[12px] text-[#888]">탐지된 리스크 항목이 없습니다.</p>
        )}
        {foundItems.map((item) => {
          const def = CONTRACT_RISK_ITEMS.find((d) => d.id === item.id);
          const Icon = RISK_ICON[item.risk_level];
          const decision = getDecision(item.id, suggestions);
          const isSelected = selectedKeys.has(item.id);
          const isActive = activeKey === item.id;

          const rowBg =
            decision === 'accepted'
              ? 'bg-green-50 border-green-200'
              : decision === 'skipped'
              ? 'bg-[#F7F8FA] border-[#E2E5EA]'
              : isActive
              ? 'bg-[#F0F5FF] border-[#C7D9FB]'
              : 'bg-white border-[#E2E5EA]';

          const textCls =
            decision === 'skipped' ? 'text-[#888]' : 'text-[#1B1F2B]';

          return (
            <div
              key={item.id}
              onClick={() => onActivate(item.id)}
              className={cn(
                'flex items-start gap-2.5 mx-2 my-[10px] p-3 rounded-2xl border cursor-pointer transition-all',
                rowBg,
              )}
            >
              {/* 체크박스 */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSelect(item.id);
                }}
                className="mt-0.5 w-3.5 h-3.5 accent-[#2E6FF2] flex-shrink-0 cursor-pointer"
              />

              {/* 리스크 아이콘 */}
              <Icon className={cn('w-3.5 h-3.5 mt-0.5 flex-shrink-0', RISK_COLOR[item.risk_level])} />

              {/* 항목 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono text-[#888] bg-[#F7F8FA] border border-[#E2E5EA] px-1 rounded">{item.id}</span>
                  <span className={cn('text-[12px] font-medium leading-snug truncate', textCls)}>
                    {def?.name ?? item.id}
                  </span>
                </div>
                {/* 결정 상태 */}
                {decision === 'accepted' && (
                  <div className="flex items-center gap-0.5 mt-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-[11px] text-green-600">적용됨</span>
                  </div>
                )}
                {decision === 'skipped' && (
                  <div className="flex items-center gap-0.5 mt-1">
                    <SkipForward className="w-3 h-3 text-[#888]" />
                    <span className="text-[11px] text-[#888]">건너뜀</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 하단 버튼 */}
      <div className="border-t border-[#E2E5EA] px-4 py-4">
        <button
          onClick={onSuggestStart}
          disabled={selectedKeys.size === 0 || isSuggesting}
          className={cn(
            'w-full py-2.5 rounded-xl text-[13px] font-medium transition-all',
            selectedKeys.size > 0 && !isSuggesting
              ? 'bg-[#2E6FF2] text-white hover:bg-[#245ED0]'
              : 'bg-[#F7F8FA] text-[#888] cursor-not-allowed border border-[#E2E5EA]',
          )}
        >
          {isSuggesting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              수정 제안 생성 중…
            </span>
          ) : selectedKeys.size > 0 ? (
            `수정 제안 받기 (${selectedKeys.size}개)`
          ) : (
            '항목을 선택하세요'
          )}
        </button>
      </div>
    </div>
  );
}
