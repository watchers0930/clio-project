'use client';

import { Plus, ListFilter } from 'lucide-react';
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

  // 정렬: active 먼저, 그 안에서 priority(high>medium>low), 그 다음 due_date
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListFilter size={16} className="text-clio-text-secondary" />
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  filter === f.value
                    ? 'bg-white text-navy font-medium shadow-sm'
                    : 'text-clio-text-secondary hover:text-navy'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-clio-text-secondary ml-2">
            {sorted.length}건
          </span>
        </div>

        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          <Plus size={16} />
          할일 추가
        </button>
      </div>

      {/* 목록 */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-clio-text-secondary">
          <p className="text-sm">할일이 없습니다</p>
          <button onClick={onAdd} className="text-sm text-accent hover:underline mt-2">
            새 할일 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-2">
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
