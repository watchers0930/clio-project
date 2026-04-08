'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
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

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? '할일 수정' : '할일 추가'}>
      <div className="space-y-4 px-2">
        <div>
          <label className="block text-sm font-medium text-navy mb-1">제목 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="할일을 입력하세요"
            className="w-full px-3 py-2 border border-clio-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-navy mb-1">마감일</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 border border-clio-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-navy mb-1">우선순위</label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-4 py-1.5 text-xs rounded-full border transition-colors ${
                  priority === p
                    ? 'border-accent bg-accent/10 text-accent font-medium'
                    : 'border-clio-border text-clio-text-secondary hover:bg-gray-50'
                }`}
              >
                {getPriorityLabel(p)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-navy mb-1">설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            rows={2}
            className="w-full px-3 py-2 border border-clio-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-clio-border rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="px-5 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? '저장 중...' : isEdit ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
