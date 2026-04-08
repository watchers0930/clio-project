'use client';

import { Check, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border border-clio-border/60 bg-white hover:shadow-sm transition-all group',
        isCompleted && 'opacity-60',
      )}
    >
      {/* 체크박스 */}
      <button
        onClick={() => onToggle(todo.id)}
        className={cn(
          'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
          isCompleted
            ? 'bg-accent border-accent'
            : 'border-clio-border hover:border-accent',
        )}
      >
        {isCompleted && <Check size={12} className="text-white" />}
      </button>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', isCompleted && 'line-through text-clio-text-secondary')}>
          {todo.title}
        </p>
        {todo.description && (
          <p className="text-xs text-clio-text-secondary truncate mt-0.5">{todo.description}</p>
        )}
      </div>

      {/* 마감일 */}
      {todo.due_date && (
        <span className={cn('text-xs flex-shrink-0', isOverdue ? 'text-red-500 font-medium' : 'text-clio-text-secondary')}>
          {format(new Date(todo.due_date + 'T00:00:00'), 'M/d (EEE)', { locale: ko })}
        </span>
      )}

      {/* 우선순위 뱃지 */}
      <span
        className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: getPriorityColor(todo.priority as TodoPriority) + '18',
          color: getPriorityColor(todo.priority as TodoPriority),
        }}
      >
        {getPriorityLabel(todo.priority as TodoPriority)}
      </span>

      {/* 액션 */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => onEdit(todo)} className="p-1 rounded hover:bg-gray-100">
          <Pencil size={14} className="text-clio-text-secondary" />
        </button>
        <button onClick={() => onDelete(todo.id)} className="p-1 rounded hover:bg-red-50">
          <Trash2 size={14} className="text-red-400" />
        </button>
      </div>
    </div>
  );
}
