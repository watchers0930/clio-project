'use client';

import { CheckSquare } from 'lucide-react';
import { isSameMonth, isToday } from 'date-fns';
import type { CalendarEvent, EventType, TodoItem, TodoPriority } from '@/lib/supabase/types';
import { getEventTypeColor, getPriorityColor } from '@/lib/schedule-utils';
import { format } from 'date-fns';

interface CalendarCellProps {
  date: Date;
  currentMonth: Date;
  events: CalendarEvent[];
  todos?: TodoItem[];
  isSelected: boolean;
  onClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onTodoClick?: (todo: TodoItem) => void;
}

export default function CalendarCell({
  date,
  currentMonth,
  events,
  todos = [],
  isSelected,
  onClick,
  onEventClick,
  onTodoClick,
}: CalendarCellProps) {
  const inMonth = isSameMonth(date, currentMonth);
  const today = isToday(date);
  const dayNum = date.getDate();
  const isSun = date.getDay() === 0;
  const isSat = date.getDay() === 6;
  const visibleEvents = events.slice(0, 2);
  const visibleTodos = todos.slice(0, Math.max(0, 3 - visibleEvents.length));
  const hiddenCount = Math.max(0, events.length + todos.length - visibleEvents.length - visibleTodos.length);

  return (
    <div
      onClick={() => onClick(date)}
      className="min-h-[124px] p-2.5 border-b border-r border-border/60 cursor-pointer transition-colors hover:bg-surface-tertiary"
      style={{
        backgroundColor: isSelected ? 'rgba(46,111,242,0.06)' : !inMonth ? '#fafafa' : undefined,
        boxShadow: isSelected ? 'inset 0 0 0 1.5px rgba(46,111,242,0.35)' : undefined,
      }}
    >
      {/* 날짜 */}
      <div className="mb-2">
        <span
          className={`text-[12px] w-6 h-6 flex items-center justify-center rounded-full font-num ${today ? 'font-bold' : 'font-normal'}`}
          style={{
            color: !inMonth
              ? '#d1d5db'
              : today
                ? '#fff'
                : isSun
                  ? '#ff3b30'
                  : isSat
                    ? '#2E6FF2'
                    : '#1B1F2B',
            backgroundColor: today ? '#2E6FF2' : undefined,
          }}
        >
          {dayNum}
        </span>
      </div>

      {/* 일정 목록 */}
      <div className="space-y-1.5">
        {visibleEvents.map((evt) => {
          const color = getEventTypeColor(evt.event_type as EventType);
          const timeStr = evt.all_day ? '종일' : format(new Date(evt.start_at), 'HH:mm');
          return (
            <button
              key={evt.id}
              onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
              className="w-full rounded-md text-left hover:brightness-95 transition-all"
              style={{
                backgroundColor: color + '28',
                borderLeft: `3px solid ${color}`,
                padding: '5px 7px',
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-num flex-shrink-0" style={{ color: color + 'cc' }}>
                  {timeStr}
                </span>
                <span
                  className="text-[11px] font-medium truncate"
                  style={{ color: '#1B1F2B' }}
                >
                  {evt.title}
                </span>
              </div>
            </button>
          );
        })}
        {visibleTodos.map((todo) => {
          const color = getPriorityColor(todo.priority as TodoPriority);
          const isCompleted = todo.status === 'completed';
          return (
            <button
              key={todo.id}
              onClick={(e) => {
                e.stopPropagation();
                onTodoClick?.(todo);
              }}
              className="w-full rounded-md border text-left transition-all hover:brightness-95"
              style={{
                backgroundColor: isCompleted ? '#f6f7f9' : color + '16',
                borderColor: isCompleted ? '#E2E5EA' : color + '44',
                padding: '5px 7px',
                opacity: isCompleted ? 0.65 : 1,
              }}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <CheckSquare size={11} className="flex-shrink-0" style={{ color }} />
                <span
                  className="truncate text-[11px] font-medium"
                  style={{
                    color: isCompleted ? '#7C8494' : '#1B1F2B',
                    textDecoration: isCompleted ? 'line-through' : undefined,
                  }}
                >
                  {todo.title}
                </span>
              </div>
            </button>
          );
        })}
        {hiddenCount > 0 && (
            <span className="pl-1.5 text-[10px] font-medium text-primary cursor-pointer hover:underline">
              +{hiddenCount}개 더
            </span>
        )}
      </div>
    </div>
  );
}
