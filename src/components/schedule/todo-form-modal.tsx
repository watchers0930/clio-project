'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Spinner } from '@/components/ui';
import type { TodoItem, TodoPriority } from '@/lib/supabase/types';
import { getPriorityLabel } from '@/lib/schedule-utils';

const PRIORITIES: TodoPriority[] = ['high', 'medium', 'low'];

interface TodoFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; due_date: string; priority: TodoPriority }) => Promise<void>;
  todo?: TodoItem | null;
}

export default function TodoFormModal({ open, onClose, onSubmit, todo }: TodoFormModalProps) {
  const isEdit = !!todo;
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');

  useEffect(() => {
    if (!open) return;
    if (todo) {
      setTitle(todo.title);
      setDescription(todo.description ?? '');
      setDueDate(todo.due_date ?? '');
      setPriority(todo.priority);
    } else {
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
    }
  }, [todo, open]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ title: title.trim(), description, due_date: dueDate, priority });
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
            {isEdit ? '할일 수정' : '할일 추가'}
          </h3>
          <button onClick={onClose} className="text-[#7C8494] hover:text-[#1B1F2B] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#7C8494] mb-1.5">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="할일을 입력하세요"
              className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/20 focus:border-[#2E6FF2]"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#7C8494] mb-1.5">마감일</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/20 focus:border-[#2E6FF2]"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#7C8494] mb-1.5">우선순위</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className="px-4 py-1.5 text-[12px] rounded-full border transition-all"
                  style={{
                    borderColor: priority === p ? '#2E6FF2' : '#E2E5EA',
                    backgroundColor: priority === p ? 'rgba(46,111,242,0.08)' : 'transparent',
                    color: priority === p ? '#2E6FF2' : '#7C8494',
                    fontWeight: priority === p ? 600 : 400,
                  }}
                >
                  {getPriorityLabel(p)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#7C8494] mb-1.5">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="설명 (선택)"
              rows={2}
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
            {loading ? <Spinner size="sm" variant="white" /> : isEdit ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
