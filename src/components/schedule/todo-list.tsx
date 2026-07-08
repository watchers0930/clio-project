'use client';

import { Plus } from 'lucide-react';
import TodoItemRow from './todo-item';
import type { TodoItem, TodoStatus } from '@/lib/supabase/types';

const FILTERS: { label: string; value: TodoStatus | 'all' }[] = [
  { label: '전체', value: 'all' },
  { label: '진행중', value: 'active' },
  { label: '완료', value: 'completed' },
];

interface TodoListProps {
  todos: TodoItem[];
  filter: TodoStatus | 'all';
  onFilterChange: (f: TodoStatus | 'all') => void;
  onAdd: () => void;
  onToggle: (id: string) => void;
  onEdit: (todo: TodoItem) => void;
  onDelete: (id: string) => void;
}

export default function TodoList({
  todos,
  filter,
  onFilterChange,
  onAdd,
  onToggle,
  onEdit,
  onDelete,
}: TodoListProps) {
  const filtered = filter === 'all' ? todos : todos.filter((t) => t.status === filter);

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...filtered].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    const pa = priorityOrder[a.priority] ?? 1;
    const pb = priorityOrder[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ marginBottom: 14 }}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-1 gap-1.5 rounded-lg bg-surface-secondary p-1.5 sm:flex-none">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                className="min-w-0 flex-1 rounded-md px-3 py-2 text-[12px] font-medium transition-all sm:flex-none sm:px-4"
                style={{
                  backgroundColor: filter === f.value ? '#fff' : 'transparent',
                  color: filter === f.value ? '#1B1F2B' : '#7C8494',
                  boxShadow: filter === f.value ? '0 1px 2px rgba(0,0,0,0.06)' : undefined,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-foreground-secondary">{sorted.length}건</span>
        </div>

        <button
          onClick={onAdd}
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-medium text-white transition-colors hover:bg-primary-dark"
        >
          <Plus size={15} />
          할일 추가
        </button>
      </div>

      {/* 목록 */}
      {sorted.length === 0 ? (
        <div className="text-center py-20 text-foreground-secondary">
          <div className="text-[40px] mb-3 opacity-20">&#x2713;</div>
          <p className="text-[14px]">할일이 없습니다</p>
          <button onClick={onAdd} className="text-[13px] text-primary hover:underline mt-2">
            새 할일 추가하기
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {sorted.map((todo) => (
            <TodoItemRow
              key={todo.id}
              todo={todo}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
