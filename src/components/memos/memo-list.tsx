'use client';

import { useState } from 'react';
import { Search, Plus, LayoutList, Layers, GitFork } from 'lucide-react';
import MemoCard from './memo-card';
import MemoGroupView from './MemoGroupView';
import MemoGraphView from './MemoGraphView';
import { useMemoGroups } from '@/hooks/useMemoGroups';
import type { MemoItem } from '@/lib/supabase/types';
import type { MemoGroup } from '@/hooks/useMemoGroups';

type ViewMode = 'list' | 'group' | 'graph';

interface MemoListProps {
  memos: MemoItem[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onPin: (id: string) => void;
  onView: (memo: MemoItem) => void;
  onEdit: (memo: MemoItem) => void;
  onDelete: (id: string) => void;
  onSuggest?: (group: MemoGroup) => void;
}

export default function MemoList({
  memos,
  search,
  onSearchChange,
  onAdd,
  onPin,
  onView,
  onEdit,
  onDelete,
  onSuggest,
}: MemoListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // 그룹 뷰 진입 시점에만 API 호출 (lazy)
  const { groups, ungrouped, loading: groupLoading, error: groupError } = useMemoGroups(viewMode === 'group');

  const handleSuggest = (group: MemoGroup) => {
    onSuggest?.(group);
  };

  const tabClass = (mode: ViewMode) =>
    `flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors ${
      viewMode === mode
        ? 'bg-[#2E6FF2] text-white'
        : 'bg-white text-[#7C8494] hover:bg-[#F7F8FA]'
    }`;

  return (
    <div>
      {/* 검색바 + 뷰 토글 + 추가 버튼 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B5]" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="메모 검색..."
            className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/20 focus:border-[#2E6FF2]"
          />
        </div>

        {/* 뷰 토글 탭 — 목록 / 그룹 / 그래프 */}
        <div className="flex items-center border border-[#E2E5EA] rounded-lg overflow-hidden flex-shrink-0">
          <button onClick={() => setViewMode('list')} className={tabClass('list')} title="목록 보기">
            <LayoutList size={13} />
            <span className="hidden sm:inline">목록</span>
          </button>
          <button onClick={() => setViewMode('group')} className={tabClass('group')} title="그룹 보기">
            <Layers size={13} />
            <span className="hidden sm:inline">그룹</span>
          </button>
          <button onClick={() => setViewMode('graph')} className={tabClass('graph')} title="그래프 보기">
            <GitFork size={13} />
            <span className="hidden sm:inline">그래프</span>
          </button>
        </div>

        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1A5AD9] transition-colors flex-shrink-0"
        >
          <Plus size={15} />
          새 메모
        </button>
      </div>

      {/* 그룹 뷰 */}
      {viewMode === 'group' && (
        <>
          {groupError && (
            <p className="text-[12px] text-red-500 mb-3">{groupError}</p>
          )}
          <MemoGroupView
            groups={groups}
            ungrouped={ungrouped}
            loading={groupLoading}
            onPin={onPin}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onSuggest={handleSuggest}
          />
        </>
      )}

      {/* 그래프 뷰 */}
      {viewMode === 'graph' && (
        <MemoGraphView memos={memos} onView={onView} />
      )}

      {/* 목록 뷰 */}
      {viewMode === 'list' && (
        <>
          <p className="text-[12px] text-[#A0A7B5] mb-4">
            총 {memos.length}건{search && ` (검색: "${search}")`}
          </p>
          {memos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-[10px]">
              {memos.map((memo) => (
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
          ) : (
            <div className="text-center py-16 text-[#A0A7B5] text-[13px]">
              {search ? '검색 결과가 없습니다' : '아직 메모가 없습니다'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
