'use client';

import { Pin, PinOff, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { MemoItem } from '@/lib/supabase/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const COLOR_MAP: Record<string, string> = {
  default: '#94A3B8',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#EAB308',
  red: '#EF4444',
  purple: '#A855F7',
};

interface MemoCardProps {
  memo: MemoItem;
  onPin: (id: string) => void;
  onEdit: (memo: MemoItem) => void;
  onDelete: (id: string) => void;
}

export default function MemoCard({ memo, onPin, onEdit, onDelete }: MemoCardProps) {
  const [hovered, setHovered] = useState(false);
  const borderColor = COLOR_MAP[memo.color] ?? COLOR_MAP.default;

  return (
    <div
      className="relative bg-white rounded-xl border border-[#E2E5EA] shadow-sm hover:shadow-md transition-all cursor-pointer"
      style={{ borderLeftWidth: 4, borderLeftColor: borderColor, padding: '16px 18px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onEdit(memo)}
    >
      {/* 핀 표시 */}
      {memo.is_pinned && (
        <Pin size={12} className="absolute top-3 right-3 text-[#2E6FF2]" style={{ transform: 'rotate(45deg)' }} />
      )}

      {/* 제목 */}
      <h4 className="text-[14px] font-semibold text-[#1B1F2B] truncate pr-6">{memo.title}</h4>

      {/* 내용 미리보기 */}
      {memo.content && (
        <p className="text-[12px] text-[#7C8494] mt-1.5 line-clamp-2 leading-[1.5]">{memo.content}</p>
      )}

      {/* 날짜 */}
      <p className="text-[11px] text-[#A0A7B5] mt-3">
        {format(new Date(memo.updated_at), 'M월 d일 HH:mm', { locale: ko })}
      </p>

      {/* Hover 액션 */}
      {hovered && (
        <div
          className="absolute bottom-3 right-3 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onPin(memo.id)}
            className="p-1.5 rounded-md hover:bg-[#F1F3F5] transition-colors"
            title={memo.is_pinned ? '고정 해제' : '고정'}
          >
            {memo.is_pinned ? <PinOff size={13} className="text-[#7C8494]" /> : <Pin size={13} className="text-[#7C8494]" />}
          </button>
          <button
            onClick={() => onEdit(memo)}
            className="p-1.5 rounded-md hover:bg-[#F1F3F5] transition-colors"
            title="수정"
          >
            <Pencil size={13} className="text-[#7C8494]" />
          </button>
          <button
            onClick={() => onDelete(memo.id)}
            className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
            title="삭제"
          >
            <Trash2 size={13} className="text-red-400" />
          </button>
        </div>
      )}
    </div>
  );
}
