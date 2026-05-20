'use client';

import { Pin, PinOff, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { MemoItem } from '@/lib/supabase/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const COLOR_MAP: Record<string, { hex: string; label: string }> = {
  default: { hex: '#94A3B8', label: '기본' },
  blue:    { hex: '#6366F1', label: '파랑' },
  green:   { hex: '#22C55E', label: '초록' },
  yellow:  { hex: '#EAB308', label: '노랑' },
  red:     { hex: '#EF4444', label: '빨강' },
  purple:  { hex: '#A855F7', label: '보라' },
};

interface MemoCardProps {
  memo: MemoItem;
  onPin: (id: string) => void;
  onView: (memo: MemoItem) => void;
  onEdit: (memo: MemoItem) => void;
  onDelete: (id: string) => void;
}

export default function MemoCard({ memo, onPin, onView, onEdit, onDelete }: MemoCardProps) {
  const [hovered, setHovered] = useState(false);
  const colorInfo = COLOR_MAP[memo.color] ?? COLOR_MAP.default;

  return (
    <div
      className="relative bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer p-4"
      style={{ borderLeftWidth: 4, borderLeftColor: colorInfo.hex }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onView(memo)}
    >
      {/* 핀 표시 — 노란 배경 원형 아이콘 */}
      {memo.is_pinned && (
        <div
          className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: '#FEF9C3' }}
        >
          <Pin size={10} style={{ color: '#CA8A04', transform: 'rotate(45deg)' }} />
        </div>
      )}

      {/* 제목 */}
      <h4
        className="text-[14px] font-semibold text-foreground truncate pr-7 leading-snug font-sans"
      >
        {memo.title}
      </h4>

      {/* 내용 미리보기 */}
      {memo.content && (
        <p className="text-[12px] text-foreground-secondary mt-2 line-clamp-2 leading-[1.6]">
          {memo.content}
        </p>
      )}

      {/* 하단: 컬러 뱃지 (좌) + 생성일 (우) */}
      <div className="flex items-center justify-between mt-4 pt-0">
        {/* 컬러 뱃지 */}
        <span className="flex items-center gap-1.5 text-[11px] text-foreground-quaternary">
          <span
            className="w-2 h-2 rounded-full inline-block flex-shrink-0"
            style={{ backgroundColor: colorInfo.hex }}
          />
          {colorInfo.label}
        </span>
        {/* 날짜 — hover 시 액션 버튼과 겹치지 않도록 숨김 */}
        <p className={`text-[11px] text-foreground-quaternary transition-opacity duration-150 ${hovered ? 'opacity-0' : 'opacity-100'}`}>
          {format(new Date(memo.updated_at), 'M월 d일 HH:mm', { locale: ko })}
        </p>
      </div>

      {/* Hover 액션 */}
      {hovered && (
        <div
          className="absolute bottom-3 right-3 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onPin(memo.id)}
            className="p-1.5 rounded-md hover:bg-surface-secondary transition-colors"
            title={memo.is_pinned ? '고정 해제' : '고정'}
          >
            {memo.is_pinned
              ? <PinOff size={13} className="text-foreground-secondary" />
              : <Pin size={13} className="text-foreground-secondary" />}
          </button>
          <button
            onClick={() => onEdit(memo)}
            className="p-1.5 rounded-md hover:bg-surface-secondary transition-colors"
            title="수정"
          >
            <Pencil size={13} className="text-foreground-secondary" />
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
