'use client';

import { useRef, useState, useEffect } from 'react';
import { isSameDay, isSameMonth, isToday, format } from 'date-fns';
import { WEEKDAY_LABELS, getCalendarDays, getEventTypeColor, getPriorityColor } from '@/lib/schedule-utils';
import type { CalendarEvent, EventType, TodoItem, TodoPriority } from '@/lib/supabase/types';

interface CalendarGridProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  todos?: TodoItem[];
  selectedDate: Date | null;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onTodoClick?: (todo: TodoItem) => void;
  onRangeSelect?: (start: Date, end: Date) => void;
}

const DATE_ROW_HEIGHT = 36;
const LANE_HEIGHT = 24;
const WEEKDAY_COLORS = ['#ff3b30', '#1B1F2B', '#1B1F2B', '#1B1F2B', '#1B1F2B', '#1B1F2B', '#2E6FF2'];

const toDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

interface EventBar {
  event: CalendarEvent;
  startCol: number;
  spanCols: number;
  lane: number;
  isStart: boolean;
}

function computeWeekBars(weekDays: Date[], events: CalendarEvent[]): EventBar[] {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  const overlapping = events.filter((e) => {
    const startDay = toDay(new Date(e.start_at));
    const endDay = toDay(new Date(e.end_at));
    return startDay <= weekEnd && endDay >= weekStart;
  });

  const sorted = [...overlapping].sort((a, b) => {
    const sA = toDay(new Date(a.start_at)).getTime();
    const sB = toDay(new Date(b.start_at)).getTime();
    if (sA !== sB) return sA - sB;
    const dA = toDay(new Date(a.end_at)).getTime() - sA;
    const dB = toDay(new Date(b.end_at)).getTime() - sB;
    return dB - dA;
  });

  // Lane assignment: laneOccupied[i] = last column used in that lane
  const laneOccupied: number[] = [];
  const eventLanes = new Map<string, number>();

  for (const event of sorted) {
    const startDay = toDay(new Date(event.start_at));
    const endDay = toDay(new Date(event.end_at));

    const startIdx = startDay < weekStart
      ? 0
      : weekDays.findIndex((d) => isSameDay(d, startDay));
    const endIdx = endDay > weekEnd
      ? 6
      : weekDays.findIndex((d) => isSameDay(d, endDay));

    const sc = startIdx === -1 ? 0 : startIdx;
    const ec = endIdx === -1 ? 6 : endIdx;

    let lane = laneOccupied.findIndex((last) => last < sc);
    if (lane === -1) {
      lane = laneOccupied.length;
      laneOccupied.push(ec);
    } else {
      laneOccupied[lane] = ec;
    }
    eventLanes.set(event.id, lane);
  }

  return sorted.map((event) => {
    const startDay = toDay(new Date(event.start_at));
    const endDay = toDay(new Date(event.end_at));
    const isStart = startDay >= weekStart;

    const startIdx = isStart
      ? weekDays.findIndex((d) => isSameDay(d, startDay))
      : -1;
    const endIdx = endDay > weekEnd
      ? -1
      : weekDays.findIndex((d) => isSameDay(d, endDay));

    const sc = isStart ? (startIdx === -1 ? 0 : startIdx) : 0;
    const ec = endDay > weekEnd ? 6 : (endIdx === -1 ? 6 : endIdx);

    return {
      event,
      startCol: sc,
      spanCols: Math.max(1, ec - sc + 1),
      lane: eventLanes.get(event.id) ?? 0,
      isStart,
    };
  });
}

export default function CalendarGrid({
  year,
  month,
  events,
  todos = [],
  selectedDate,
  onDateClick,
  onEventClick,
  onRangeSelect,
}: CalendarGridProps) {
  const days = getCalendarDays(year, month);
  const currentMonth = new Date(year, month);

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Date | null>(null);
  const isDragging = useRef(false);

  const getDragRange = (s: Date | null, c: Date | null) => {
    if (!s || !c) return null;
    return s <= c ? { start: s, end: c } : { start: c, end: s };
  };

  const isInDragRange = (date: Date) => {
    const range = getDragRange(dragStart, dragCurrent);
    if (!range) return false;
    return date >= range.start && date <= range.end;
  };

  const handleMouseDown = (e: React.MouseEvent, date: Date) => {
    e.preventDefault();
    isDragging.current = false;
    setDragStart(date);
    setDragCurrent(date);
  };

  const handleMouseEnter = (date: Date) => {
    if (!dragStart) return;
    isDragging.current = true;
    setDragCurrent(date);
  };

  const handleMouseUp = (date: Date) => {
    const dragged = isDragging.current;
    const range = getDragRange(dragStart, dragCurrent);
    setDragStart(null);
    setDragCurrent(null);
    isDragging.current = false;

    if (dragged && range && !isSameDay(range.start, range.end)) {
      onRangeSelect?.(range.start, range.end);
    } else {
      onDateClick(date);
    }
  };

  useEffect(() => {
    const handleUp = () => {
      setDragStart(null);
      setDragCurrent(null);
      isDragging.current = false;
    };
    document.addEventListener('mouseup', handleUp);
    return () => document.removeEventListener('mouseup', handleUp);
  }, []);

  const getEventsForDate = (date: Date) =>
    events.filter((e) => {
      const s = toDay(new Date(e.start_at));
      const en = toDay(new Date(e.end_at));
      return date >= s && date <= en;
    });

  const getTodosForDate = (date: Date) =>
    todos.filter((t) => {
      if (!t.due_date) return false;
      return isSameDay(new Date(`${t.due_date}T00:00:00`), date);
    });

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden select-none">
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

      {/* 주별 렌더링 */}
      {weeks.map((weekDays, weekIdx) => {
        const bars = computeWeekBars(weekDays, events);
        const maxLane = bars.length > 0 ? Math.max(...bars.map((b) => b.lane)) : -1;
        const eventLayerHeight = (maxLane + 1) * LANE_HEIGHT + 8;
        const cellHeight = Math.max(100, DATE_ROW_HEIGHT + eventLayerHeight + 26);

        return (
          <div key={weekIdx} className="relative" style={{ minHeight: cellHeight }}>
            {/* 날짜 셀 배경 + 클릭 영역 */}
            <div className="absolute inset-0 grid grid-cols-7">
              {weekDays.map((day) => {
                const inMonth = isSameMonth(day, currentMonth);
                const today = isToday(day);
                const inDrag = isInDragRange(day);
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                const isSun = day.getDay() === 0;
                const isSat = day.getDay() === 6;
                const dayEvents = getEventsForDate(day);
                const dayTodos = getTodosForDate(day);
                const totalCount = dayEvents.length + dayTodos.length;

                return (
                  <div
                    key={day.toISOString()}
                    className="relative border-b border-r border-border/60 cursor-pointer transition-colors hover:bg-surface-tertiary/60"
                    style={{
                      backgroundColor: inDrag
                        ? 'rgba(46,111,242,0.10)'
                        : isSelected
                          ? 'rgba(46,111,242,0.06)'
                          : !inMonth
                            ? '#fafafa'
                            : undefined,
                      boxShadow: isSelected ? 'inset 0 0 0 1.5px rgba(46,111,242,0.35)' : undefined,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, day)}
                    onMouseEnter={() => handleMouseEnter(day)}
                    onMouseUp={() => handleMouseUp(day)}
                  >
                    {/* 날짜 숫자 */}
                    <div className="p-2">
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
                        {day.getDate()}
                      </span>
                    </div>

                    {/* 하단 점 — 일정 수 */}
                    {totalCount > 0 && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-[3px]">
                        {dayEvents.slice(0, 5).map((evt) => (
                          <span
                            key={evt.id}
                            className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                            style={{ backgroundColor: getEventTypeColor(evt.event_type as EventType) }}
                          />
                        ))}
                        {dayTodos.slice(0, Math.max(0, 5 - dayEvents.length)).map((todo) => (
                          <span
                            key={todo.id}
                            className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                            style={{ backgroundColor: getPriorityColor(todo.priority as TodoPriority) }}
                          />
                        ))}
                        {totalCount > 5 && (
                          <span className="text-[9px] font-num text-foreground-tertiary leading-none">
                            +{totalCount - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 이벤트 바 레이어 */}
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{ top: DATE_ROW_HEIGHT }}
            >
              {bars.map((bar, i) => {
                const color = getEventTypeColor(bar.event.event_type as EventType);
                const isCancelled = bar.event.event_type === 'cancelled';
                const barColor = isCancelled ? '#8E8E93' : color;
                const leftPct = (bar.startCol / 7) * 100;
                const widthPct = (bar.spanCols / 7) * 100;

                return (
                  <div
                    key={`${bar.event.id}-w${weekIdx}-${i}`}
                    className="absolute pointer-events-auto cursor-pointer flex items-center overflow-hidden"
                    style={{
                      top: bar.lane * LANE_HEIGHT + 2,
                      left: `calc(${leftPct}% + 3px)`,
                      width: `calc(${widthPct}% - 6px)`,
                      height: LANE_HEIGHT - 4,
                      backgroundColor: barColor + (isCancelled ? '20' : '1e'),
                      borderLeft: bar.isStart ? `3px solid ${barColor}` : `1px solid ${barColor}44`,
                      borderRadius: bar.isStart ? '0 4px 4px 0' : '0 4px 4px 0',
                    }}
                    onClick={(e) => { e.stopPropagation(); onEventClick(bar.event); }}
                    title={bar.event.title}
                  >
                    {bar.isStart && (
                      <span
                        className="truncate text-[10px] font-medium leading-none px-1.5"
                        style={{ color: barColor }}
                      >
                        {!bar.event.all_day && (
                          <span className="font-num mr-1 opacity-75">
                            {format(new Date(bar.event.start_at), 'HH:mm')}
                          </span>
                        )}
                        {bar.event.title}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
