'use client';

import { isSameDay } from 'date-fns';
import { WEEKDAY_LABELS, getCalendarDays } from '@/lib/schedule-utils';
import CalendarCell from './calendar-cell';
import type { CalendarEvent, TodoItem } from '@/lib/supabase/types';

interface CalendarGridProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  todos?: TodoItem[];
  selectedDate: Date | null;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onTodoClick?: (todo: TodoItem) => void;
}

const WEEKDAY_COLORS = ['#ff3b30', '#1B1F2B', '#1B1F2B', '#1B1F2B', '#1B1F2B', '#1B1F2B', '#2E6FF2'];

export default function CalendarGrid({
  year,
  month,
  events,
  todos = [],
  selectedDate,
  onDateClick,
  onEventClick,
  onTodoClick,
}: CalendarGridProps) {
  const days = getCalendarDays(year, month);
  const currentMonth = new Date(year, month);

  const getEventsForDate = (date: Date) =>
    events.filter((e) => {
      const start = new Date(e.start_at);
      const end = new Date(e.end_at);
      return date >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
             date <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
    });

  const getTodosForDate = (date: Date) =>
    todos.filter((todo) => {
      if (!todo.due_date) return false;
      return isSameDay(new Date(`${todo.due_date}T00:00:00`), date);
    });

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-border bg-surface-tertiary">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className="text-center text-[11px] font-semibold py-2.5"
            style={{ color: WEEKDAY_COLORS[i] }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7">
        {days.map((day) => (
          <CalendarCell
            key={day.toISOString()}
            date={day}
            currentMonth={currentMonth}
            events={getEventsForDate(day)}
            todos={getTodosForDate(day)}
            isSelected={selectedDate ? isSameDay(day, selectedDate) : false}
            onClick={onDateClick}
            onEventClick={onEventClick}
            onTodoClick={onTodoClick}
          />
        ))}
      </div>
    </div>
  );
}
