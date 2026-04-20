'use client';

import { Pencil, Pin, X } from 'lucide-react';
import type { MemoItem } from '@/lib/supabase/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import RelatedMemos from './RelatedMemos';

const COLOR_MAP: Record<string, string> = {
  default: '#94A3B8',
  blue:    '#3B82F6',
  green:   '#22C55E',
  yellow:  '#EAB308',
  red:     '#EF4444',
  purple:  '#A855F7',
};

interface MemoViewModalProps {
  memo: MemoItem | null;
  open: boolean;
  onClose: () => void;
  onEdit: (memo: MemoItem) => void;
  onNavigateToRelated?: (id: string, title: string) => void;
}

export default function MemoViewModal({ memo, open, onClose, onEdit, onNavigateToRelated }: MemoViewModalProps) {
  if (!open || !memo) return null;

  const borderColor = COLOR_MAP[memo.color] ?? COLOR_MAP.default;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-clio-border w-full max-w-lg mx-4 flex flex-col overflow-hidden"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 컬러 바 */}
        <div className="h-1 flex-shrink-0" style={{ backgroundColor: borderColor }} />

        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 px-8 pt-7 pb-5 border-b border-clio-border">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {memo.is_pinned && (
              <Pin size={14} className="text-accent flex-shrink-0" style={{ transform: 'rotate(45deg)' }} />
            )}
            <h3 className="text-[16px] font-semibold text-clio-text leading-snug break-words">
              {memo.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => { onClose(); onEdit(memo); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-clio-text-secondary border border-clio-border rounded-lg hover:bg-clio-bg hover:text-clio-text transition-colors"
            >
              <Pencil size={12} />
              수정
            </button>
            <button
              onClick={onClose}
              className="ml-1 p-1.5 rounded-lg text-clio-text-secondary hover:bg-clio-bg hover:text-clio-text transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 내용 — 전체 표시, 스크롤 */}
        <div className="overflow-y-auto px-8 py-6 flex-1">
          {memo.content ? (
            <p className="text-[14px] text-[#3A3F4B] leading-[1.85] whitespace-pre-wrap">
              {memo.content}
            </p>
          ) : (
            <p className="text-[13px] text-clio-text-secondary italic">내용 없음</p>
          )}
        </div>

        {/* 관련 메모 */}
        <RelatedMemos
          memoId={memo.id}
          onNavigate={(id, title) => {
            onClose();
            onNavigateToRelated?.(id, title);
          }}
        />

        {/* 날짜 */}
        <div className="px-8 py-5 border-t border-clio-border flex-shrink-0">
          <p className="text-[11px] text-clio-text-secondary">
            {format(new Date(memo.updated_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })} 수정
          </p>
        </div>
      </div>
    </div>
  );
}
