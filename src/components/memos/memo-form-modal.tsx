'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui';
import type { MemoItem, MemoColor } from '@/lib/supabase/types';

const COLORS: { value: MemoColor; hex: string; label: string }[] = [
  { value: 'default', hex: '#94A3B8', label: '기본' },
  { value: 'blue',    hex: '#3B82F6', label: '파랑' },
  { value: 'green',   hex: '#22C55E', label: '초록' },
  { value: 'yellow',  hex: '#EAB308', label: '노랑' },
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

  useEffect(() => {
    if (!open) return;
    if (memo) {
      setTitle(memo.title);
      setContent(memo.content ?? '');
      setColor(memo.color);
    } else {
      setTitle('');
      setContent('');
      setColor('default');
    }
  }, [memo, open]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ title: title.trim(), content, color });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '메모 수정' : '새 메모'}
      size="sm"
    >
      <div className="space-y-4">
        {/* 제목 */}
        <div>
          <label className="block text-xs font-medium text-clio-text-secondary mb-1.5">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="메모 제목"
            className="w-full px-3 py-2.5 text-[13px] border border-clio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          />
        </div>

        {/* 색상 선택 */}
        <div>
          <label className="block text-xs font-medium text-clio-text-secondary mb-1.5">색상</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className="w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center"
                style={{
                  backgroundColor: c.hex,
                  borderColor: color === c.value ? '#1B1F2B' : 'transparent',
                  transform: color === c.value ? 'scale(1.15)' : 'scale(1)',
                }}
                title={c.label}
              >
                {color === c.value && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-xs font-medium text-clio-text-secondary mb-1.5">내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="메모 내용 (선택)"
            rows={5}
            className="w-full px-3 py-2.5 text-[13px] border border-clio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
          />
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-clio-text-secondary hover:text-clio-text transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="px-5 py-2 text-[13px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            {loading ? <Spinner size="sm" variant="white" /> : isEdit ? '수정' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
