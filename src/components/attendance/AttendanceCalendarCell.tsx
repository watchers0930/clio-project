'use client';

// 근태 달력 한 칸 — 날짜·유효 출퇴근·기록 방식·승인 휴가. 클릭 시 보정(상위 위임).

import { fmtTime } from './format';
import type { LeaveMark } from './calendar-utils';
import type { AttendanceDayView } from './types';

export const SOURCE_STYLE: Record<
  Exclude<AttendanceDayView['source'], 'none'>,
  { label: string; color: string }
> = {
  auto: { label: '자동', color: '#2E6FF2' },
  manual: { label: '보정', color: '#ff9f0a' },
  mixed: { label: '혼합', color: '#8b5cf6' },
};
export const LEAVE_COLOR = '#16a34a';

interface Props {
  workDate: string;
  inMonth: boolean;
  weekday: number;
  isToday: boolean;
  isFuture: boolean;
  disabled: boolean;
  day: AttendanceDayView | undefined;
  leaves: LeaveMark[] | undefined;
  holiday: string | undefined;
  onSelect: (workDate: string) => void;
}

function dateColor(inMonth: boolean, isToday: boolean, weekday: number, isHoliday: boolean): string {
  if (!inMonth) return '#d1d5db';
  if (isToday) return '#fff';
  if (weekday === 0 || isHoliday) return '#ff3b30';
  if (weekday === 6) return '#2E6FF2';
  return '#1B1F2B';
}

export function AttendanceCalendarCell({
  workDate,
  inMonth,
  weekday,
  isToday,
  isFuture,
  disabled,
  day,
  leaves,
  holiday,
  onSelect,
}: Props) {
  const dayNum = Number(workDate.slice(8));
  const hasRecord = !!day && day.source !== 'none';
  const src = hasRecord ? SOURCE_STYLE[day.source as keyof typeof SOURCE_STYLE] : null;
  // 달 밖·미래·로딩 중에는 보정 진입을 막는다(로딩 전 클릭 시 version 불일치 방지)
  const clickable = inMonth && !isFuture && !disabled;

  return (
    <button
      type="button"
      onClick={() => clickable && onSelect(workDate)}
      disabled={!clickable}
      title={clickable ? '눌러서 출퇴근 보정' : undefined}
      className="flex min-h-[96px] min-w-0 flex-col gap-1.5 border-b border-r border-border/60 p-1.5 text-left transition-colors enabled:cursor-pointer enabled:hover:bg-surface-tertiary/60 sm:min-h-[108px] sm:p-2"
      style={{ backgroundColor: !inMonth ? '#fafafa' : undefined }}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-num ${isToday ? 'font-bold' : 'font-normal'}`}
          style={{ color: dateColor(inMonth, isToday, weekday, !!holiday), backgroundColor: isToday ? '#2E6FF2' : undefined }}
        >
          {dayNum}
        </span>
        {inMonth && src && (
          <span
            className="h-[6px] w-[6px] flex-shrink-0 rounded-full"
            style={{ backgroundColor: src.color }}
            title={src.label}
          />
        )}
      </div>

      {inMonth && hasRecord && (
        <div className="flex flex-col gap-0.5 text-[10px] tabular-nums leading-tight sm:text-[11px]">
          <span className="truncate text-foreground-secondary">
            <span className="hidden sm:inline">출근 </span>
            <span className="text-foreground">{fmtTime(day.effectiveCheckIn)}</span>
          </span>
          <span className="truncate text-foreground-secondary">
            <span className="hidden sm:inline">퇴근 </span>
            <span className="text-foreground">{fmtTime(day.effectiveCheckOut)}</span>
          </span>
          {isToday && <span className="truncate text-[10px] text-primary">갱신 중</span>}
          {day.isSingleSignal && <span className="truncate text-[10px] text-foreground-tertiary">단일 신호</span>}
        </div>
      )}

      {inMonth && holiday && (
        <span className="truncate text-[10px] text-danger" title={holiday}>
          {holiday}
        </span>
      )}

      {inMonth &&
        leaves?.map((m, i) => (
          <span
            key={`${m.full}-${i}`}
            title={m.full}
            className="truncate rounded px-1 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `${LEAVE_COLOR}1a`, color: LEAVE_COLOR }}
          >
            <span className="sm:hidden">{m.short}</span>
            <span className="hidden sm:inline">{m.full}</span>
          </span>
        ))}
    </button>
  );
}
