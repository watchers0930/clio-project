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
      <div className="flex items-center justify-between" style={{ marginBottom: 30 }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-[#f5f5f7] rounded-lg p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                className="px-3.5 py-1.5 text-[12px] font-medium rounded-md transition-all"
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
          <span className="text-[12px] text-[#7C8494]">{sorted.length}건</span>
        </div>

        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1A5AD9] transition-colors"
        >
          <Plus size={15} />
          할일 추가
        </button>
      </div>

      {/* 목록 */}
      {sorted.length === 0 ? (
        <div className="text-center py-20 text-[#7C8494]">
          <div className="text-[40px] mb-3 opacity-20">&#x2713;</div>
          <p className="text-[14px]">할일이 없습니다</p>
          <button onClick={onAdd} className="text-[13px] text-[#2E6FF2] hover:underline mt-2">
            새 할일 추가하기
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E5EA] overflow-hidden">
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
