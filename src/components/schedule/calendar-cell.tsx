'use client';

import { isSameMonth, isSameDay, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
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
      className={cn(
        'min-h-[100px] p-1.5 border-b border-r border-clio-border/50 cursor-pointer transition-colors hover:bg-accent/5',
        !inMonth && 'bg-gray-50/60',
        isSelected && 'bg-accent/10 ring-1 ring-accent/30',
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
            !inMonth && 'text-gray-300',
            inMonth && isSun && 'text-red-500',
            inMonth && isSat && 'text-blue-500',
            inMonth && !isSun && !isSat && 'text-navy',
            today && 'bg-accent text-white',
          )}
        >
          {dayNum}
        </span>
      </div>

      <div className="space-y-0.5">
        {events.slice(0, 3).map((evt) => (
          <button
            key={evt.id}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick(evt);
            }}
            className="w-full text-left px-1.5 py-0.5 rounded text-[10px] leading-tight truncate hover:opacity-80 transition-opacity"
            style={{
              backgroundColor: getEventTypeColor(evt.event_type as EventType) + '18',
              color: getEventTypeColor(evt.event_type as EventType),
              borderLeft: `2px solid ${getEventTypeColor(evt.event_type as EventType)}`,
            }}
          >
            {evt.title}
          </button>
        ))}
        {events.length > 3 && (
          <span className="text-[10px] text-clio-text-secondary pl-1">
            +{events.length - 3}개 더
          </span>
        )}
      </div>
    </div>
  );
}
