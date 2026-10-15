'use client';

// 기간별 근태 기록 목록 — 날짜·유효 출퇴근·원본·보정표시·보정버튼 (설계서 §5.5)

import { Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { fmtTime, fmtWorkDate } from './format';
import type { AttendanceDayView } from './types';
import type { AttendanceRange } from '@/hooks/use-attendance';

interface Props {
  days: AttendanceDayView[];
  loading: boolean;
  error: string | null;
  range?: AttendanceRange;
  onCorrect: (day: AttendanceDayView) => void;
}

const SOURCE_BADGE: Record<AttendanceDayView['source'], { label: string; variant: 'default' | 'success' | 'warning' | 'info' }> = {
  auto: { label: '자동', variant: 'info' },
  manual: { label: '보정', variant: 'warning' },
  mixed: { label: '혼합', variant: 'warning' },
  none: { label: '기록 없음', variant: 'default' },
};

export function AttendanceMonthlyList({ days, loading, error, range, onCorrect }: Props) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-foreground">기간별 기록</h3>
          {range && (
            <span className="text-[11px] text-foreground-tertiary tabular-nums">
              {range.from} ~ {range.to}
            </span>
          )}
        </div>
        <span className="text-xs text-foreground-secondary">{days.length}일</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <p className="px-5 py-10 text-center text-sm text-danger">{error}</p>
      ) : days.length === 0 ? (
        <EmptyState iconType="calendar" title="기록이 없습니다" description="선택한 기간에 근태 기록이 없습니다." />
      ) : (
        <ul className="divide-y divide-border">
          {days.map((d) => {
            const src = SOURCE_BADGE[d.source];
            return (
              <li key={d.workDate} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-secondary/50">
                <div className="w-32 flex-shrink-0 text-sm font-medium text-foreground">
                  {fmtWorkDate(d.workDate)}
                </div>
                <div className="flex flex-1 items-center gap-6 text-sm tabular-nums">
                  <span className="text-foreground-secondary">
                    출근 <span className="text-foreground">{fmtTime(d.effectiveCheckIn)}</span>
                  </span>
                  <span className="text-foreground-secondary">
                    퇴근{' '}
                    <span className="text-foreground">{fmtTime(d.effectiveCheckOut)}</span>
                    {d.isToday && <span className="ml-1 text-[11px] text-primary">갱신 중</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={src.variant}>{src.label}</Badge>
                  {d.isSingleSignal && <Badge variant="default">단일</Badge>}
                  <button
                    onClick={() => onCorrect(d)}
                    className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-foreground-secondary transition-colors hover:bg-surface-secondary hover:text-foreground cursor-pointer"
                    title="출퇴근 보정"
                  >
                    <Pencil size={13} />
                    보정
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
