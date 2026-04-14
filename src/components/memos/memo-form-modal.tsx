'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Spinner } from '@/components/ui';
import type { MemoItem, MemoColor } from '@/lib/supabase/types';

const COLORS: { value: MemoColor; hex: string; label: string }[] = [
  { value: 'default', hex: '#94A3B8', label: '기본' },
  { value: 'blue', hex: '#3B82F6', label: '파랑' },
  { value: 'green', hex: '#22C55E', label: '초록' },
  { value: 'yellow', hex: '#EAB308', label: '노랑' },
  { value: 'red', hex: '#EF4444', label: '빨강' },
  { value: 'purple', hex: '#A855F7', label: '보라' },
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4"
        style={{ padding: '28px 32px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[16px] font-semibold text-[#1B1F2B]">
            {isEdit ? '메모 수정' : '새 메모'}
          </h3>
          <button onClick={onClose} className="text-[#7C8494] hover:text-[#1B1F2B] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* 제목 */}
          <div>
            <label className="block text-[12px] font-medium text-[#7C8494] mb-1.5">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="메모 제목"
              className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/20 focus:border-[#2E6FF2]"
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            />
          </div>

          {/* 색상 선택 */}
          <div>
            <label className="block text-[12px] font-medium text-[#7C8494] mb-1.5">색상</label>
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
            <label className="block text-[12px] font-medium text-[#7C8494] mb-1.5">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="메모 내용 (선택)"
              rows={5}
              className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/20 focus:border-[#2E6FF2] resize-none"
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-[#7C8494] hover:text-[#1B1F2B] transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="px-5 py-2 text-[13px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1A5AD9] transition-colors disabled:opacity-40"
          >
            {loading ? <Spinner size="sm" variant="white" /> : isEdit ? '수정' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
