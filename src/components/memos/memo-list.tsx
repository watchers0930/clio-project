'use client';

import { useState } from 'react';
import { Search, Plus, Network, List } from 'lucide-react';
import MemoCard from './memo-card';
import type { MemoItem } from '@/lib/supabase/types';
import { useMemoGraph } from '@/hooks/useMemoGraph';
import { Spinner } from '@/components/ui';
import dynamic from 'next/dynamic';

const MemoGraphView = dynamic(() => import('./MemoGraphView'), { ssr: false });

interface MemoListProps {
  memos: MemoItem[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onPin: (id: string) => void;
  onView: (memo: MemoItem) => void;
  onEdit: (memo: MemoItem) => void;
  onDelete: (id: string) => void;
  onMemoSaved?: () => void;
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
  onMemoSaved,
}: MemoListProps) {
  const [tab, setTab] = useState<'list' | 'graph'>('list');
  const graph = useMemoGraph({ enabled: tab === 'graph' });

  const handleEditById = (id: string) => {
    const memo = memos.find((m) => m.id === id);
    if (memo) onEdit(memo);
  };

  return (
    <div>
      {/* 검색 + 새 메모 + 탭 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B5]" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="메모 검색..."
            className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
          />
        </div>

        {/* 탭 토글 */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] flex-shrink-0">
          <button
            onClick={() => setTab('list')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all"
            style={{
              background: tab === 'list' ? 'white' : 'transparent',
              color: tab === 'list' ? '#1E293B' : '#94A3B8',
              boxShadow: tab === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <List size={13} />
            목록
          </button>
          <button
            onClick={() => setTab('graph')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all"
            style={{
              background: tab === 'graph' ? 'white' : 'transparent',
              color: tab === 'graph' ? '#6366F1' : '#94A3B8',
              boxShadow: tab === 'graph' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
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

      {tab === 'list' ? (
        <>
          <p className="text-[12px] text-[#A0A7B5]" style={{ marginTop: 20, marginBottom: 5 }}>
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
      ) : (
        <div className="mt-4">
          {graph.loading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : graph.error ? (
            <div className="text-center py-16 text-[#EF4444] text-[13px]">
              {graph.error}
              <button
                onClick={graph.refresh}
                className="ml-3 text-[#6366F1] underline"
              >
                다시 시도
              </button>
            </div>
          ) : graph.data ? (
            <MemoGraphView data={graph.data} onEdit={handleEditById} onMemoSaved={onMemoSaved} />
          ) : null}
        </div>
      )}
    </div>
  );
}
