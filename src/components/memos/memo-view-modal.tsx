'use client';

import { useState, useEffect } from 'react';
import { Pencil, Pin, X } from 'lucide-react';
import type { MemoItem } from '@/lib/supabase/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const COLOR_MAP: Record<string, string> = {
  default: '#94A3B8',
  blue:    '#6366F1',
  green:   '#22C55E',
  yellow:  '#F59E0B',
  red:     '#EF4444',
  purple:  '#A855F7',
};

interface MemoViewModalProps {
  memo: MemoItem | null;
  open: boolean;
  onClose: () => void;
  onEdit: (memo: MemoItem) => void;
}

export default function MemoViewModal({ memo, open, onClose, onEdit }: MemoViewModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) { setVisible(false); return; }
    setTimeout(() => setVisible(true), 10);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open || !memo) return null;

  const accentColor = COLOR_MAP[memo.color] ?? COLOR_MAP.default;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(6px)',
        transition: 'opacity 0.2s',
        opacity: visible ? 1 : 0,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 16px',
          background: 'white',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s',
          opacity: visible ? 1 : 0,
        }}
      >
        {/* 상단 컬러 스트라이프 */}
        <div style={{ height: 5, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)`, flexShrink: 0 }} />

        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] flex-shrink-0" style={{ padding: '34px 38px 30px' }}>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {memo.is_pinned && (
              <Pin size={14} className="text-[#6366F1] flex-shrink-0" style={{ transform: 'rotate(45deg)' }} />
            )}
            <h3 className="text-[17px] font-bold text-[#0F172A] leading-snug break-words">
              {memo.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => { onClose(); onEdit(memo); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] hover:text-[#1E293B] transition-colors"
            >
              <Pencil size={12} />
              수정
            </button>
            <button
              onClick={onClose}
              className="ml-1 p-2 rounded-xl text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#1E293B] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 내용 */}
        <div className="overflow-y-auto px-8 py-6 flex-1">
          {memo.content ? (
            <p className="text-[14px] text-[#334155] leading-[1.85] whitespace-pre-wrap">
              {memo.content}
            </p>
          ) : (
            <p className="text-[13px] text-[#94A3B8] italic">내용 없음</p>
          )}
        </div>

        {/* 날짜 */}
        <div className="px-8 py-5 border-t border-[#E2E8F0] flex-shrink-0">
          <p className="text-[11px] text-[#94A3B8]">
            {format(new Date(memo.updated_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })} 수정
          </p>
        </div>
      </div>
    </div>
  );
}
