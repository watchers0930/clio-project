'use client';

// 기간별 근태 기록 — 월 달력 (목록 대체). 날짜 칸 클릭 = 보정/수동기록(F03).

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { AttendanceMonthNav } from './AttendanceMonthNav';
import { AttendanceCalendarCell, LEAVE_COLOR, SOURCE_STYLE } from './AttendanceCalendarCell';
import { approvedLeaveByDate, buildMonthGrid, totalLeaveAmount, weekdayOf, type YearMonth } from './calendar-utils';
import { fmtDays } from './format';
import type { AttendanceDayView, HolidayView, LeaveRequestView } from './types';

interface Props {
  month: YearMonth;
  isCurrentMonth: boolean;
  today: string;
  days: AttendanceDayView[];
  holidays: HolidayView[];
  holidaysError: boolean;
  leaves: LeaveRequestView[];
  leaveError: string | null;
  loading: boolean;
  ready: boolean;
  error: string | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onThisMonth: () => void;
  onSelectDate: (workDate: string) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_COLORS = ['#ff3b30', '#1B1F2B', '#1B1F2B', '#1B1F2B', '#1B1F2B', '#1B1F2B', '#2E6FF2'];

export function AttendanceCalendar({
  month,
  isCurrentMonth,
  today,
  days,
  holidays,
  holidaysError,
  leaves,
  leaveError,
  loading,
  ready,
  error,
  onPrevMonth,
  onNextMonth,
  onThisMonth,
  onSelectDate,
}: Props) {
  const slots = useMemo(() => buildMonthGrid(month), [month]);
  const dayMap = useMemo(() => new Map(days.map((d) => [d.workDate, d])), [days]);
  const holidayMap = useMemo(() => new Map(holidays.map((h) => [h.day, h.label])), [holidays]);
  const leaveMap = useMemo(
    () => approvedLeaveByDate(leaves, month, new Set(holidayMap.keys())),
    [leaves, month, holidayMap],
  );
  const recordCount = days.filter((d) => d.source !== 'none').length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">기간별 기록</h3>
          <span className="text-[11px] text-foreground-tertiary tabular-nums">
            기록 {recordCount}일 · 휴가 {leaveError ? '—' : fmtDays(totalLeaveAmount(leaveMap))}
          </span>
        </div>
        <AttendanceMonthNav
          month={month}
          isCurrentMonth={isCurrentMonth}
          onPrev={onPrevMonth}
          onNext={onNextMonth}
          onToday={onThisMonth}
        />
      </div>

      {(leaveError || holidaysError) && !error && (
        <p className="border-b border-border bg-warning/10 px-5 py-2 text-xs text-warning">
          {leaveError
            ? '휴가 정보를 불러오지 못해 달력에 휴가가 표시되지 않을 수 있습니다.'
            : '공휴일 정보를 불러오지 못해 휴가 표시가 정확하지 않을 수 있습니다.'}
        </p>
      )}

      {error ? (
        <p className="px-5 py-10 text-center text-sm text-danger">{error}</p>
      ) : (
        <div className="relative select-none">
          <div className="grid grid-cols-7 border-b border-border bg-surface-tertiary">
            {WEEKDAYS.map((label, i) => (
              <div key={label} className="py-2.5 text-center text-[11px] font-semibold" style={{ color: WEEKDAY_COLORS[i] }}>
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {slots.map((s) => (
              <AttendanceCalendarCell
                key={s.workDate}
                workDate={s.workDate}
                inMonth={s.inMonth}
                weekday={weekdayOf(s.workDate)}
                isToday={s.workDate === today}
                isFuture={s.workDate > today}
                disabled={loading || !ready}
                day={dayMap.get(s.workDate)}
                leaves={leaveMap.get(s.workDate)}
                holiday={holidayMap.get(s.workDate)}
                onSelect={onSelectDate}
              />
            ))}
          </div>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <Spinner />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-[11px] text-foreground-secondary">
        {Object.values(SOURCE_STYLE).map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: LEAVE_COLOR }} />
          승인 휴가
        </span>
        <span className="text-foreground-tertiary">날짜를 누르면 출퇴근을 보정하거나 수동으로 기록할 수 있습니다.</span>
      </div>
    </Card>
  );
}
