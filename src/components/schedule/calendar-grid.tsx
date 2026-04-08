'use client';

import { isSameDay } from 'date-fns';
import { WEEKDAY_LABELS, getCalendarDays } from '@/lib/schedule-utils';
import CalendarCell from './calendar-cell';
import type { CalendarEvent } from '@/lib/supabase/types';

interface CalendarGridProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  selectedDate: Date | null;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export default function CalendarGrid({
  year,
  month,
  events,
  selectedDate,
  onDateClick,
  onEventClick,
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

  return (
    <div className="border border-clio-border rounded-xl overflow-hidden bg-white">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-clio-border">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`text-center text-xs font-semibold py-2.5 ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-clio-text-secondary'
            }`}
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
            isSelected={selectedDate ? isSameDay(day, selectedDate) : false}
            onClick={onDateClick}
            onEventClick={onEventClick}
          />
        ))}
      </div>
    </div>
  );
}
