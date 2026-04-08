'use client';

import CalendarHeader from './calendar-header';
import CalendarGrid from './calendar-grid';
import type { CalendarEvent } from '@/lib/supabase/types';

interface CalendarViewProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  selectedDate: Date | null;
  departments: { id: string; name: string }[];
  selectedDept: string | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onDeptChange: (id: string | null) => void;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export default function CalendarView({
  year,
  month,
  events,
  selectedDate,
  departments,
  selectedDept,
  onPrevMonth,
  onNextMonth,
  onToday,
  onDeptChange,
  onDateClick,
  onEventClick,
}: CalendarViewProps) {
  return (
    <div>
      <CalendarHeader
        year={year}
        month={month}
        onPrev={onPrevMonth}
        onNext={onNextMonth}
        onToday={onToday}
        departments={departments}
        selectedDept={selectedDept}
        onDeptChange={onDeptChange}
      />
      <CalendarGrid
        year={year}
        month={month}
        events={events}
        selectedDate={selectedDate}
        onDateClick={onDateClick}
        onEventClick={onEventClick}
      />
    </div>
  );
}
