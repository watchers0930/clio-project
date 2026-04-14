'use client';

import { Search, Plus } from 'lucide-react';
import MemoCard from './memo-card';
import type { MemoItem } from '@/lib/supabase/types';

interface MemoListProps {
  memos: MemoItem[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onPin: (id: string) => void;
  onEdit: (memo: MemoItem) => void;
  onDelete: (id: string) => void;
}

export default function MemoList({ memos, search, onSearchChange, onAdd, onPin, onEdit, onDelete }: MemoListProps) {
  return (
    <div>
      {/* 검색바 + 추가 버튼 */}
      <div className="flex items-center gap-3 mb-4">
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
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1A5AD9] transition-colors"
        >
          <Plus size={15} />
          새 메모
        </button>
      </div>

      {/* 건수 */}
      <p className="text-[12px] text-[#A0A7B5] mb-3">
        총 {memos.length}건{search && ` (검색: "${search}")`}
      </p>

      {/* 카드 그리드 */}
      {memos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {memos.map((memo) => (
            <MemoCard
              key={memo.id}
              memo={memo}
              onPin={onPin}
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
    </div>
  );
}
