'use client';

import { isSameMonth, isSameDay, isToday } from 'date-fns';
import type { CalendarEvent, EventType } from '@/lib/supabase/types';
import { getEventTypeColor } from '@/lib/schedule-utils';

interface CalendarCellProps {
  date: Date;
  currentMonth: Date;
  events: CalendarEvent[];
  isSelected: boolean;
  onClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export default function CalendarCell({
  date,
  currentMonth,
  events,
  isSelected,
  onClick,
  onEventClick,
}: CalendarCellProps) {
  const inMonth = isSameMonth(date, currentMonth);
  const today = isToday(date);
  const dayNum = date.getDate();
  const isSun = date.getDay() === 0;
  const isSat = date.getDay() === 6;

  return (
    <div
      onClick={() => onClick(date)}
      className="min-h-[96px] p-2 border-b border-r border-[#E2E5EA]/60 cursor-pointer transition-colors hover:bg-[#f9fafb]"
      style={{
        backgroundColor: isSelected ? 'rgba(46,111,242,0.06)' : !inMonth ? '#fafafa' : undefined,
        boxShadow: isSelected ? 'inset 0 0 0 1px rgba(46,111,242,0.25)' : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[12px] font-medium w-6 h-6 flex items-center justify-center rounded-full font-num"
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

      <div className="space-y-0.5">
        {events.slice(0, 3).map((evt) => {
          const color = getEventTypeColor(evt.event_type as EventType);
          return (
            <button
              key={evt.id}
              onClick={(e) => { e.stopPropagation(); onEventClick(evt); }}
              className="w-full text-left px-1.5 py-[3px] rounded text-[10px] leading-tight truncate hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: color + '14',
                color,
                borderLeft: `2px solid ${color}`,
              }}
            >
              {evt.title}
            </button>
          );
        })}
        {events.length > 3 && (
          <span className="text-[10px] text-[#7C8494] pl-1">+{events.length - 3}개 더</span>
        )}
      </div>
    </div>
  );
}
