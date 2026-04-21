'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { MemoItem, MemoColor } from '@/lib/supabase/types';

const COLORS: { value: MemoColor; hex: string; label: string }[] = [
  { value: 'default', hex: '#94A3B8', label: '기본' },
  { value: 'blue',    hex: '#6366F1', label: '인디고' },
  { value: 'green',   hex: '#22C55E', label: '초록' },
  { value: 'yellow',  hex: '#F59E0B', label: '노랑' },
  { value: 'red',     hex: '#EF4444', label: '빨강' },
  { value: 'purple',  hex: '#A855F7', label: '보라' },
];

export interface MemoFormData {
  title: string;
  content: string;
  color: MemoColor;
}

interface MemoFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: MemoFormData) => Promise<void>;
  memo?: MemoItem | null;
}

export default function MemoFormModal({ open, onClose, onSubmit, memo }: MemoFormModalProps) {
  const isEdit = !!memo;
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<MemoColor>('default');
  const [visible, setVisible] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setVisible(false); return; }
    if (memo) {
      setTitle(memo.title);
      setContent(memo.content ?? '');
      setColor(memo.color);
    } else {
      setTitle('');
      setContent('');
      setColor('default');
    }
    setTimeout(() => {
      setVisible(true);
      setTimeout(() => titleRef.current?.focus(), 80);
    }, 10);
  }, [memo, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const handleSubmit = async () => {
    if (!title.trim() || loading) return;
    setLoading(true);
    try {
      await onSubmit({ title: title.trim(), content, color });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const accentHex = COLORS.find((c) => c.value === color)?.hex ?? '#94A3B8';

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
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s',
          opacity: visible ? 1 : 0,
        }}
      >
        {/* 상단 컬러 스트라이프 */}
        <div
          style={{
            height: 5,
            background: `linear-gradient(90deg, ${accentHex}, ${accentHex}99)`,
            transition: 'background 0.3s',
          }}
        />

        {/* 헤더 */}
        <div className="flex items-center justify-between px-[38px] pt-[34px] pb-[30px]">
          <div>
            <h2 className="text-[17px] font-bold text-[#0F172A]">
              {isEdit ? '메모 수정' : '새 메모'}
            </h2>
            <p className="text-[12px] text-[#94A3B8] mt-0.5">
              {isEdit ? '내용을 수정하세요' : '생각을 기록하세요'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#F1F5F9] transition-colors"
          >
            <X size={16} className="text-[#94A3B8]" />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-[38px] pb-[38px] flex flex-col">
          {/* 색상 선택 */}
          <div className="flex items-center gap-2.5 mb-[10px]">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                title={c.label}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  backgroundColor: c.hex,
                  border: color === c.value ? `3px solid ${c.hex}` : '3px solid transparent',
                  outline: color === c.value ? `2px solid ${c.hex}40` : 'none',
                  outlineOffset: 2,
                  transform: color === c.value ? 'scale(1.2)' : 'scale(1)',
                  transition: 'transform 0.15s, outline 0.15s',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              />
            ))}
            <span className="ml-1 text-[11px] text-[#94A3B8] font-medium">
              {COLORS.find((c) => c.value === color)?.label}
            </span>
          </div>

          {/* 제목 입력 */}
          <div style={{ marginTop: 25, marginBottom: 10 }}>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 50))}
              placeholder="메모 제목을 입력하세요"
              className="w-full px-4 py-3 text-[14px] font-medium text-[#1E293B] rounded-xl outline-none transition-all"
              style={{
                border: `1.5px solid ${title ? accentHex + '60' : '#E2E8F0'}`,
                background: '#FAFBFF',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = accentHex + '90'; e.currentTarget.style.boxShadow = `0 0 0 3px ${accentHex}15`; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = title ? accentHex + '60' : '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            />
          </div>

          {/* 내용 입력 */}
          <div style={{ marginTop: 10, marginBottom: 20 }}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요 (선택사항)"
              rows={5}
              className="w-full px-4 py-3 text-[13px] text-[#334155] rounded-xl outline-none resize-none transition-all leading-[1.8]"
              style={{
                border: '1.5px solid #E2E8F0',
                background: '#FAFBFF',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = accentHex + '90'; e.currentTarget.style.boxShadow = `0 0 0 3px ${accentHex}15`; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* 하단 버튼 */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-medium text-[#64748B] rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !title.trim()}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white rounded-xl flex items-center justify-center gap-2 transition-all"
              style={{
                background: title.trim()
                  ? `linear-gradient(135deg, ${accentHex}, ${accentHex}cc)`
                  : '#E2E8F0',
                color: title.trim() ? 'white' : '#94A3B8',
                boxShadow: title.trim() ? `0 4px 14px ${accentHex}40` : 'none',
              }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? '수정 완료' : '저장하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
