'use client';

// 조회 기간 선택(F04) + 무신호 날짜 수동 기록 추가 진입(F03).
// 계산·요청은 상위(useAttendance)에 위임하고, 이 컴포넌트는 입력·검증 UI만 담당한다.

import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { todayKst } from './format';
import { ATTENDANCE_RANGE_MAX_DAYS, type AttendanceRange } from '@/hooks/use-attendance';

interface Props {
  range: AttendanceRange;
  onRangeChange: (range: AttendanceRange) => void;
  onAddRecord: (workDate: string) => void;
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000) + 1; // 양 끝 포함 일수
}

function validateRange(from: string, to: string): string | null {
  if (!from || !to) return '기간을 모두 입력해주세요.';
  if (from > to) return '시작일이 종료일보다 늦습니다.';
  if (daysBetween(from, to) > ATTENDANCE_RANGE_MAX_DAYS) {
    return `조회 기간은 최대 ${ATTENDANCE_RANGE_MAX_DAYS}일까지입니다.`;
  }
  return null;
}

const inputCls =
  'h-10 rounded-md border border-border bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

export function AttendanceControls({ range, onRangeChange, onAddRecord }: Props) {
  const today = todayKst();
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [addDate, setAddDate] = useState(today);
  const [addError, setAddError] = useState<string | null>(null);

  const applyRange = (next: AttendanceRange) => {
    const err = validateRange(next.from, next.to);
    setRangeError(err);
    if (!err) onRangeChange(next);
  };

  const submitAdd = () => {
    if (!addDate) {
      setAddError('날짜를 선택해주세요.');
      return;
    }
    if (addDate > today) {
      setAddError('미래 날짜는 기록할 수 없습니다.');
      return;
    }
    setAddError(null);
    onAddRecord(addDate);
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-secondary/40 px-4 py-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex flex-col gap-2.5 text-xs">
          <span className="font-medium text-foreground-secondary">시작일</span>
          <input
            type="date"
            value={range.from}
            max={range.to || today}
            onChange={(e) => applyRange({ from: e.target.value, to: range.to })}
            className={inputCls}
            aria-label="조회 시작일"
          />
        </div>
        <div className="flex flex-col gap-2.5 text-xs">
          <span className="font-medium text-foreground-secondary">종료일</span>
          <input
            type="date"
            value={range.to}
            min={range.from}
            max={today}
            onChange={(e) => applyRange({ from: range.from, to: e.target.value })}
            className={inputCls}
            aria-label="조회 종료일"
          />
        </div>

        <div className="ml-auto flex items-end gap-2">
          <div className="flex flex-col gap-2.5 text-xs">
            <span className="font-medium text-foreground-secondary">기록 추가</span>
            <input
              type="date"
              value={addDate}
              max={today}
              onChange={(e) => setAddDate(e.target.value)}
              className={inputCls}
              aria-label="기록을 추가할 날짜"
            />
          </div>
          <Button variant="secondary" size="sm" leftIcon={<CalendarPlus size={14} />} onClick={submitAdd}>
            이 날짜 보정
          </Button>
        </div>
      </div>

      {(rangeError || addError) && (
        <p className="text-xs text-danger">{rangeError ?? addError}</p>
      )}
      <p className="text-[11px] text-foreground-tertiary">
        자동 신호가 없는 날도 ‘기록 추가’로 출퇴근을 수동 입력할 수 있습니다. (조회 최대 {ATTENDANCE_RANGE_MAX_DAYS}일)
      </p>
    </div>
  );
}
