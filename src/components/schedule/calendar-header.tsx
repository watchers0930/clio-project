'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarHeaderProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  departments: { id: string; name: string }[];
  selectedDept: string | null;
  onDeptChange: (id: string | null) => void;
}

export default function CalendarHeader({
  year,
  month,
  onPrev,
  onNext,
  onToday,
  departments,
  selectedDept,
  onDeptChange,
}: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
      <div className="flex items-center gap-3">
        <button
          onClick={onPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-secondary transition-colors"
        >
          <ChevronLeft size={18} className="text-foreground-secondary" />
        </button>
        <h2 className="text-[16px] font-semibold text-foreground min-w-[130px] text-center font-num">
          {year}년 {month + 1}월
        </h2>
        <button
          onClick={onNext}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-secondary transition-colors"
        >
          <ChevronRight size={18} className="text-foreground-secondary" />
        </button>
        <button
          onClick={onToday}
          className="ml-1 px-3 py-1.5 text-[12px] font-medium text-foreground-secondary rounded-md border border-border hover:bg-surface-secondary transition-colors"
        >
          오늘
        </button>
      </div>

      <select
        value={selectedDept ?? ''}
        onChange={(e) => onDeptChange(e.target.value || null)}
        className="text-[13px] px-3 py-1.5 border border-border rounded-lg bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      >
        <option value="">전체 부서</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    </div>
  );
}
