'use client';

import { Check, Pencil, Trash2 } from 'lucide-react';
import type { TodoItem as TodoItemType, TodoPriority } from '@/lib/supabase/types';
import { getPriorityColor, getPriorityLabel } from '@/lib/schedule-utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TodoItemProps {
  todo: TodoItemType;
  onToggle: (id: string) => void;
  onEdit: (todo: TodoItemType) => void;
  onDelete: (id: string) => void;
}

export default function TodoItemRow({ todo, onToggle, onEdit, onDelete }: TodoItemProps) {
  const isCompleted = todo.status === 'completed';
  const isOverdue = todo.due_date && !isCompleted && new Date(todo.due_date) < new Date(new Date().toDateString());

  return (
    <div
      className="flex items-center gap-3 px-5 py-3.5 border-b border-[#E2E5EA] last:border-0 hover:bg-[#f9fafb] transition-colors group"
      style={{ opacity: isCompleted ? 0.55 : 1 }}
    >
      {/* 체크박스 */}
      <button
        onClick={() => onToggle(todo.id)}
        className="w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors"
        style={{
          borderColor: isCompleted ? '#2E6FF2' : '#E2E5EA',
          backgroundColor: isCompleted ? '#2E6FF2' : 'transparent',
        }}
      >
        {isCompleted && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-medium truncate"
          style={{
            color: isCompleted ? '#7C8494' : '#1B1F2B',
            textDecoration: isCompleted ? 'line-through' : undefined,
          }}
        >
          {todo.title}
        </p>
        {todo.description && (
          <p className="text-[11px] text-[#7C8494] truncate mt-0.5">{todo.description}</p>
        )}
      </div>

      {/* 마감일 */}
      {todo.due_date && (
        <span
          className="text-[12px] flex-shrink-0 font-num"
          style={{ color: isOverdue ? '#ff3b30' : '#7C8494', fontWeight: isOverdue ? 600 : 400 }}
        >
          {format(new Date(todo.due_date + 'T00:00:00'), 'M/d (EEE)', { locale: ko })}
        </span>
      )}

      {/* 우선순위 뱃지 */}
      <span
        className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: getPriorityColor(todo.priority as TodoPriority) + '14',
          color: getPriorityColor(todo.priority as TodoPriority),
        }}
      >
        {getPriorityLabel(todo.priority as TodoPriority)}
      </span>

      {/* 액션 */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => onEdit(todo)} className="p-1 rounded hover:bg-[#f5f5f7]">
          <Pencil size={13} className="text-[#7C8494]" />
        </button>
        <button onClick={() => onDelete(todo.id)} className="p-1 rounded hover:bg-[#ff3b30]/5">
          <Trash2 size={13} className="text-[#ff3b30]/60" />
        </button>
      </div>
    </div>
  );
}
