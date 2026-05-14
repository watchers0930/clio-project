'use client';

import { isSameMonth, isToday } from 'date-fns';
import type { CalendarEvent, EventType } from '@/lib/supabase/types';
import { getEventTypeColor } from '@/lib/schedule-utils';
import { format } from 'date-fns';

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
      className="min-h-[124px] p-2.5 border-b border-r border-[#E2E5EA]/60 cursor-pointer transition-colors hover:bg-[#f9fafb]"
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
        {events.slice(0, 3).map((evt) => {
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
        {events.length > 3 && (
            <span className="pl-1.5 text-[10px] font-medium text-[#2E6FF2] cursor-pointer hover:underline">
              +{events.length - 3}개 더
            </span>
        )}
      </div>
    </div>
  );
}
