'use client';

import { Search, Plus, Network, List } from 'lucide-react';
import MemoCard from './memo-card';
import type { MemoItem } from '@/lib/supabase/types';
import { useMemoGraph } from '@/hooks/useMemoGraph';
import { Spinner } from '@/components/ui';
import dynamic from 'next/dynamic';
import type { ExtractedTodo } from './memo-todo-confirm-modal';

const MemoGraphView = dynamic(() => import('./MemoGraphView'), { ssr: false });

interface MemoListProps {
  memos: MemoItem[];
  search: string;
  viewMode: 'list' | 'graph';
  selectedMemoIds: Set<string>;
  ideaPanelOpen: boolean;
  onSearchChange: (value: string) => void;
  onViewModeChange: (value: 'list' | 'graph') => void;
  onSelectedMemoIdsChange: (value: Set<string>) => void;
  onIdeaPanelOpenChange: (open: boolean) => void;
  onAdd: () => void;
  onPin: (id: string) => void;
  onView: (memo: MemoItem) => void;
  onEdit: (memo: MemoItem) => void;
  onDelete: (id: string) => void;
  onMemoSaved?: () => void;
  onSaveIdeaMemo: (text: string) => Promise<void>;
  onExtractIdeaTodos: (text: string) => Promise<ExtractedTodo[]>;
}

export default function MemoList({
  memos,
  search,
  viewMode,
  selectedMemoIds,
  ideaPanelOpen,
  onSearchChange,
  onViewModeChange,
  onSelectedMemoIdsChange,
  onIdeaPanelOpenChange,
  onAdd,
  onPin,
  onView,
  onEdit,
  onDelete,
  onMemoSaved,
  onSaveIdeaMemo,
  onExtractIdeaTodos,
}: MemoListProps) {
  const graph = useMemoGraph({ enabled: viewMode === 'graph' });

  const handleEditById = (id: string) => {
    const memo = memos.find((m) => m.id === id);
    if (memo) onEdit(memo);
  };

  return (
    <div>
      {/* 검색 + 새 메모 + 탭 */}
      <div className="flex items-center gap-3 mb-[40px]" style={{ paddingBottom: 10 }}>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-quaternary pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="메모 검색..."
            style={{ paddingLeft: '2.5rem' }}
            className="w-full pr-3 py-2 text-[13px] border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* 탭 토글 */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-secondary border border-border flex-shrink-0">
          <button
            onClick={() => onViewModeChange('list')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all"
            style={{
              background: viewMode === 'list' ? 'white' : 'transparent',
              color: viewMode === 'list' ? '#1E293B' : '#94A3B8',
              boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <List size={13} />
            목록
          </button>
          <button
            onClick={() => onViewModeChange('graph')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all"
            style={{
              background: viewMode === 'graph' ? 'white' : 'transparent',
              color: viewMode === 'graph' ? '#6366F1' : '#94A3B8',
              boxShadow: viewMode === 'graph' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Network size={13} />
            그래프
          </button>
        </div>

        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' }}
        >
          <Plus size={15} />
          새 메모
        </button>
      </div>

      {viewMode === 'list' ? (
        <>
          <p className="text-[12px] text-foreground-quaternary" style={{ marginTop: 20, marginBottom: 5 }}>
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
            <div className="text-center py-16 text-foreground-quaternary text-[13px]">
              {search ? '검색 결과가 없습니다' : '아직 메모가 없습니다'}
            </div>
          )}
        </>
      ) : (
        <div className="mt-4">
          {graph.loading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : graph.error ? (
            <div className="text-center py-16 text-danger text-[13px]">
              {graph.error}
              <button
                onClick={graph.refresh}
                className="ml-3 text-indigo-500 underline"
              >
                다시 시도
              </button>
            </div>
          ) : graph.data ? (
            <MemoGraphView
              data={graph.data}
              selectedIds={selectedMemoIds}
              ideaPanelOpen={ideaPanelOpen}
              onSelectedIdsChange={onSelectedMemoIdsChange}
              onIdeaPanelOpenChange={onIdeaPanelOpenChange}
              onEdit={handleEditById}
              onMemoSaved={onMemoSaved}
              onSaveIdeaMemo={onSaveIdeaMemo}
              onExtractIdeaTodos={onExtractIdeaTodos}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
