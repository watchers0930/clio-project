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
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f5f5f7] transition-colors"
        >
          <ChevronLeft size={18} className="text-[#7C8494]" />
        </button>
        <h2 className="text-[16px] font-semibold text-[#1B1F2B] min-w-[130px] text-center font-num">
          {year}년 {month + 1}월
        </h2>
        <button
          onClick={onNext}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f5f5f7] transition-colors"
        >
          <ChevronRight size={18} className="text-[#7C8494]" />
        </button>
        <button
          onClick={onToday}
          className="ml-1 px-3 py-1.5 text-[12px] font-medium text-[#7C8494] rounded-md border border-[#E2E5EA] hover:bg-[#f5f5f7] transition-colors"
        >
          오늘
        </button>
      </div>

      <select
        value={selectedDept ?? ''}
        onChange={(e) => onDeptChange(e.target.value || null)}
        className="text-[13px] px-3 py-1.5 border border-[#E2E5EA] rounded-lg bg-white text-[#1B1F2B] focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/20 focus:border-[#2E6FF2]"
      >
        <option value="">전체 부서</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    </div>
  );
}
