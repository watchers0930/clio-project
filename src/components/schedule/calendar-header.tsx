'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

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
  const date = new Date(year, month);

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onPrev}
          className="p-1.5 rounded-lg hover:bg-clio-border/50 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-navy min-w-[140px] text-center">
          {format(date, 'yyyy년 M월', { locale: ko })}
        </h2>
        <button
          onClick={onNext}
          className="p-1.5 rounded-lg hover:bg-clio-border/50 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
        <button
          onClick={onToday}
          className="ml-2 px-3 py-1 text-xs font-medium rounded-md border border-clio-border hover:bg-clio-border/30 transition-colors"
        >
          오늘
        </button>
      </div>

      <select
        value={selectedDept ?? ''}
        onChange={(e) => onDeptChange(e.target.value || null)}
        className="text-sm px-3 py-1.5 border border-clio-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">전체 부서</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}
