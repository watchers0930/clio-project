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
      className="group flex items-start gap-3 border-b border-border px-4 py-3.5 transition-colors last:border-0 hover:bg-surface-tertiary"
      style={{ opacity: isCompleted ? 0.55 : 1 }}
    >
      {/* 체크박스 */}
      <button
        onClick={() => onToggle(todo.id)}
        className="mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded border-2 transition-colors"
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
          <p className="text-[11px] text-foreground-secondary truncate mt-0.5">{todo.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* 마감일 */}
          {todo.due_date && (
            <span
              className="text-[12px] font-num"
              style={{ color: isOverdue ? '#ff3b30' : '#7C8494', fontWeight: isOverdue ? 600 : 400 }}
            >
              {format(new Date(todo.due_date + 'T00:00:00'), 'M/d (EEE)', { locale: ko })}
            </span>
          )}

          {/* 우선순위 뱃지 */}
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-medium"
            style={{
              backgroundColor: getPriorityColor(todo.priority as TodoPriority) + '14',
              color: getPriorityColor(todo.priority as TodoPriority),
            }}
          >
            {getPriorityLabel(todo.priority as TodoPriority)}
          </span>
        </div>
      </div>

      {/* 액션 */}
      <div className="flex flex-shrink-0 gap-1.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
        <button onClick={() => onEdit(todo)} className="p-1.5 rounded hover:bg-surface-secondary">
          <Pencil size={13} className="text-foreground-secondary" />
        </button>
        <button onClick={() => onDelete(todo.id)} className="p-1.5 rounded hover:bg-foreground/5">
          <Trash2 size={13} className="text-danger/60" />
        </button>
      </div>
    </div>
  );
}
