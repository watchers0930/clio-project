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
  onSearch: (memo: MemoItem) => void;
  onCreateDocument: (memo: MemoItem) => void;
}

export default function MemoViewModal({ memo, open, onClose, onEdit, onSearch, onCreateDocument }: MemoViewModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(open);
    }, open ? 10 : 0);
    return () => window.clearTimeout(timer);
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
        <div className="flex items-start justify-between gap-4 flex-shrink-0 px-[38px] pt-[34px] pb-[24px]">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {memo.is_pinned && (
              <Pin size={14} className="text-indigo-500 flex-shrink-0" style={{ transform: 'rotate(45deg)' }} />
            )}
            <h3 className="text-[17px] font-bold text-foreground leading-snug break-words">
              {memo.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { onClose(); onEdit(memo); }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium text-foreground-secondary border border-border rounded-lg hover:bg-surface-tertiary hover:text-foreground transition-colors"
            >
              <Pencil size={12} />
              수정
            </button>
            <button
              onClick={onClose}
              className="ml-1 p-2 rounded-xl text-foreground-quaternary hover:bg-surface-tertiary hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 내용 */}
        <div className="overflow-y-auto px-[38px] pb-[38px] flex-1 flex flex-col gap-4">
          <div className="h-[3px] rounded-full" style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)` }} />
          <div className="rounded-2xl border border-border bg-surface-tertiary px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-secondary">Document Connection</p>
            <p className="mt-1 text-[12px] leading-5 text-foreground-secondary">
              메모는 독립 기록이 아니라 문서 작성과 검색으로 이어지는 초안 자산입니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button
                onClick={() => onSearch(memo)}
                className="rounded-lg border border-border-tint bg-white px-3.5 py-2.5 text-[12px] font-medium text-primary hover:bg-primary-tint transition-colors"
              >
                관련 문서 검색
              </button>
              <button
                onClick={() => onCreateDocument(memo)}
                className="rounded-lg border border-success/30 bg-white px-3 py-2 text-[12px] font-medium text-success hover:bg-success/5 transition-colors"
              >
                메모로 문서 작성
              </button>
            </div>
          </div>
          {memo.content ? (
            <p className="text-[14px] text-foreground-secondary leading-[1.85] whitespace-pre-wrap">
              {memo.content}
            </p>
          ) : (
            <p className="text-[13px] text-foreground-quaternary italic">내용 없음</p>
          )}
          <p className="text-[11px] text-foreground-quaternary mt-auto pt-4">
            {format(new Date(memo.updated_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })} 수정
          </p>
        </div>
      </div>
    </div>
  );
}
