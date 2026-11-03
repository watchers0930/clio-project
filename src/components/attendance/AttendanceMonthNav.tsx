'use client';

// 근태 달력 월 이동 (일정 달력 헤더와 동일한 형태). 미래 달은 이동 불가.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { YearMonth } from './calendar-utils';

interface Props {
  month: YearMonth;
  isCurrentMonth: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const navBtn =
  'w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer';

export function AttendanceMonthNav({ month, isCurrentMonth, onPrev, onNext, onToday }: Props) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onPrev} className={navBtn} aria-label="이전 달">
        <ChevronLeft size={18} className="text-foreground-secondary" />
      </button>
      <h2 className="min-w-[110px] text-center text-[16px] font-semibold text-foreground font-num">
        {month.year}년 {month.month}월
      </h2>
      <button onClick={onNext} disabled={isCurrentMonth} className={navBtn} aria-label="다음 달">
        <ChevronRight size={18} className="text-foreground-secondary" />
      </button>
      <button
        onClick={onToday}
        disabled={isCurrentMonth}
        className="px-3 py-1.5 text-[12px] font-medium text-foreground-secondary rounded-md border border-border transition-colors hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        이번 달
      </button>
    </div>
  );
}
