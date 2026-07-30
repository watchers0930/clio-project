'use client';

import { X, Plus, Pencil, CheckSquare } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { CalendarEvent, EventType, TodoItem, TodoPriority } from '@/lib/supabase/types';
import { getEventTypeColor, getEventTypeLabel, getPriorityColor, getPriorityLabel } from '@/lib/schedule-utils';

interface DayDetailPanelProps {
  open: boolean;
  date: Date | null;
  events: CalendarEvent[];
  todos: TodoItem[];
  onClose: () => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditTodo: (todo: TodoItem) => void;
  onCreateEvent: () => void;
}

export default function DayDetailPanel({
  open,
  date,
  events,
  todos,
  onClose,
  onEditEvent,
  onEditTodo,
  onCreateEvent,
}: DayDetailPanelProps) {
  if (!open || !date) return null;

  const dayEvents = events.filter((e) => {
    const s = new Date(e.start_at);
    const en = new Date(e.end_at);
    const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const endDay = new Date(en.getFullYear(), en.getMonth(), en.getDate());
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return d >= startDay && d <= endDay;
  });

  const dayTodos = todos.filter((t) => {
    if (!t.due_date) return false;
    return isSameDay(new Date(`${t.due_date}T00:00:00`), date);
  });

  const dateTitle = format(date, 'M월 d일 (EEEEE)', { locale: ko });
  const isEmpty = dayEvents.length === 0 && dayTodos.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4"
        style={{ padding: '24px 28px', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <h3 className="text-[17px] font-bold text-foreground">{dateTitle}</h3>
          <button
            onClick={onClose}
            className="text-foreground-tertiary hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 일정 목록 */}
        {isEmpty ? (
          <p className="text-[13px] text-foreground-tertiary text-center py-6">
            등록된 일정이 없습니다
          </p>
        ) : (
          <div className="flex flex-col gap-2" style={{ marginBottom: 16 }}>
            {dayEvents.map((evt) => {
              const color = getEventTypeColor(evt.event_type as EventType);
              return (
                <div
                  key={evt.id}
                  className="flex items-start gap-3 rounded-xl p-3"
                  style={{
                    backgroundColor: color + '12',
                    borderLeft: `3px solid ${color}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: color + '22', color }}
                      >
                        {getEventTypeLabel(evt.event_type as EventType)}
                      </span>
                      {evt.all_day ? (
                        <span className="text-[11px] text-foreground-tertiary">종일</span>
                      ) : (
                        <span className="text-[11px] font-num text-foreground-tertiary">
                          {format(new Date(evt.start_at), 'HH:mm')} ~{' '}
                          {format(new Date(evt.end_at), 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] font-semibold text-foreground truncate">
                      {evt.title}
                    </p>
                    {evt.location && (
                      <p className="text-[11px] text-foreground-tertiary mt-0.5 truncate">
                        📍 {evt.location}
                      </p>
                    )}
                    {evt.description && (
                      <p className="text-[11px] text-foreground-secondary mt-1 line-clamp-2">
                        {evt.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { onClose(); onEditEvent(evt); }}
                    className="flex-shrink-0 p-1.5 rounded-lg text-foreground-tertiary hover:text-primary hover:bg-primary/5 transition-colors"
                    title="수정"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              );
            })}

            {dayTodos.map((todo) => {
              const color = getPriorityColor(todo.priority as TodoPriority);
              const isCompleted = todo.status === 'completed';
              return (
                <div
                  key={todo.id}
                  className="flex items-start gap-3 rounded-xl p-3 border"
                  style={{
                    borderColor: isCompleted ? '#E2E5EA' : color + '44',
                    backgroundColor: isCompleted ? '#fafafa' : color + '0c',
                    opacity: isCompleted ? 0.7 : 1,
                  }}
                >
                  <CheckSquare
                    size={14}
                    className="flex-shrink-0 mt-0.5"
                    style={{ color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-semibold" style={{ color }}>
                        {getPriorityLabel(todo.priority as TodoPriority)}
                      </span>
                      {isCompleted && (
                        <span className="text-[10px] text-foreground-tertiary">완료</span>
                      )}
                    </div>
                    <p
                      className="text-[13px] font-medium text-foreground truncate"
                      style={{ textDecoration: isCompleted ? 'line-through' : undefined }}
                    >
                      {todo.title}
                    </p>
                  </div>
                  <button
                    onClick={() => { onClose(); onEditTodo(todo); }}
                    className="flex-shrink-0 p-1.5 rounded-lg text-foreground-tertiary hover:text-primary hover:bg-primary/5 transition-colors"
                    title="수정"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 새 일정 추가 */}
        <button
          onClick={() => { onClose(); onCreateEvent(); }}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-border text-[13px] font-medium text-foreground-secondary hover:text-primary hover:border-primary hover:bg-primary/5 transition-all"
        >
          <Plus size={15} />
          새 일정 추가
        </button>
      </div>
    </div>
  );
}
