'use client';

import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import MemoCard from './memo-card';
import MemoGroupHeader from './MemoGroupHeader';
import type { MemoGroup } from '@/hooks/useMemoGroups';
import type { MemoItem } from '@/lib/supabase/types';
import { Spinner } from '@/components/ui';

interface MemoGroupViewProps {
  groups: MemoGroup[];
  ungrouped: MemoItem[];
  loading: boolean;
  onPin: (id: string) => void;
  onView: (memo: MemoItem) => void;
  onEdit: (memo: MemoItem) => void;
  onDelete: (id: string) => void;
  onSuggest: (group: MemoGroup) => void;
}

export default function MemoGroupView({
  groups,
  ungrouped,
  loading,
  onPin,
  onView,
  onEdit,
  onDelete,
  onSuggest,
}: MemoGroupViewProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  const totalCount = groups.reduce((sum, g) => sum + g.memos.length, 0) + ungrouped.length;

  if (totalCount === 0) {
    return (
      <div className="text-center py-16 text-[#A0A7B5] text-[13px]">
        메모를 작성하면 자동으로 그룹화됩니다
      </div>
    );
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  const isSelected = selectedGroupId !== null;

  const handleGroupClick = (groupId: string) => {
    setSelectedGroupId((prev) => (prev === groupId ? null : groupId));
  };

  const handleIdeaCreate = () => {
    if (!selectedGroup) return;
    onSuggest(selectedGroup);
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      {groups.map((group) => {
        const active = group.id === selectedGroupId;
        return (
          <section
            key={group.id}
            onClick={() => handleGroupClick(group.id)}
            className={`rounded-xl p-4 cursor-pointer transition-all border-2 ${
              active
                ? 'border-[#2E6FF2] bg-[#F0F5FF]'
                : 'border-transparent hover:border-[#E2E5EA] bg-transparent'
            }`}
          >
            <MemoGroupHeader
              name={group.name}
              count={group.memos.length}
              selected={active}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.memos.map((memo) => (
                <div key={memo.id} onClick={(e) => e.stopPropagation()}>
                  <MemoCard
                    memo={memo}
                    onPin={onPin}
                    onView={onView}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {ungrouped.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px w-6 bg-[#E2E5EA] flex-shrink-0" />
            <span className="text-[13px] font-semibold text-[#A0A7B5] whitespace-nowrap">기타</span>
            <span className="text-[12px] text-[#A0A7B5] whitespace-nowrap">({ungrouped.length}개)</span>
            <div className="h-px flex-1 bg-[#E2E5EA]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ungrouped.map((memo) => (
              <MemoCard
                key={memo.id}
                memo={memo}
                onPin={onPin}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* 하단 고정 액션 바 */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-3 bg-white rounded-2xl shadow-xl border border-[#E2E5EA]">
        <span className="text-[12px] text-[#A0A7B5]">
          {isSelected ? `"${selectedGroup?.name}" 선택됨` : '그룹을 선택하세요'}
        </span>
        <button
          onClick={handleIdeaCreate}
          disabled={!isSelected}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            isSelected
              ? 'bg-[#2E6FF2] text-white hover:bg-[#1A5AD9] cursor-pointer'
              : 'bg-[#E2E5EA] text-[#A0A7B5] cursor-not-allowed opacity-60'
          }`}
        >
          <Lightbulb size={14} />
          아이디어 만들기
        </button>
      </div>
    </div>
  );
}
