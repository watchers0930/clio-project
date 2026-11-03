// 근태 달력용 날짜 계산 (KST 'YYYY-MM-DD' 문자열 기준)
// 브라우저 로컬 타임존에 흔들리지 않도록 Date.UTC 산술만 사용한다.

import type { LeaveRequestView } from './types';
import { LEAVE_TYPE_LABEL } from './types';

export interface YearMonth {
  year: number;
  month: number; // 1~12
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toYmd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 'YYYY-MM-DD' → YearMonth */
export function ymOf(workDate: string): YearMonth {
  const [y, m] = workDate.split('-').map(Number);
  return { year: y, month: m };
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const idx = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function compareYm(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function daysInMonth(ym: YearMonth): number {
  return new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();
}

/** 요일(0=일) */
export function weekdayOf(workDate: string): number {
  const [y, m, d] = workDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 해당 월 조회 구간(1일~말일). 미래 날짜는 근태 기록이 없고, 공휴일은 월 전체가 필요하다. */
export function monthRange(ym: YearMonth): { from: string; to: string } {
  return { from: toYmd(ym.year, ym.month, 1), to: toYmd(ym.year, ym.month, daysInMonth(ym)) };
}

export interface CalendarSlot {
  workDate: string;
  inMonth: boolean;
}

/** 일요일 시작 주 단위 달력 칸(앞뒤 달 날짜로 채움, 4~6주) */
export function buildMonthGrid(ym: YearMonth): CalendarSlot[] {
  const first = Date.UTC(ym.year, ym.month - 1, 1);
  const lead = new Date(first).getUTCDay();
  const total = Math.ceil((lead + daysInMonth(ym)) / 7) * 7;
  const slots: CalendarSlot[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(first + (i - lead) * 86_400_000);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    slots.push({ workDate: toYmd(y, m, d.getUTCDate()), inMonth: y === ym.year && m === ym.month });
  }
  return slots;
}

export interface LeaveMark {
  full: string; // '오전반차'
  short: string; // 모바일 좁은 칸용 '오전'
  amount: number; // 1 또는 0.5(반차)
}

/**
 * 승인 휴가를 날짜별로 펼친다(해당 월만).
 * 근무일 판정은 서버 leave_workdays와 같다: 주말과 공휴일·회사휴무(holidays)는 제외.
 */
export function approvedLeaveByDate(
  leaves: LeaveRequestView[],
  ym: YearMonth,
  holidays: ReadonlySet<string>,
): Map<string, LeaveMark[]> {
  const from = toYmd(ym.year, ym.month, 1);
  const to = toYmd(ym.year, ym.month, daysInMonth(ym));
  const map = new Map<string, LeaveMark[]>();
  for (const l of leaves) {
    if (l.status !== 'approved' || l.endDate < from || l.startDate > to) continue;
    const half = l.leaveType === 'half_day';
    const slot = l.halfDaySlot === 'am' ? '오전' : l.halfDaySlot === 'pm' ? '오후' : '';
    const mark: LeaveMark = half
      ? { full: `${slot}반차`, short: slot || '반차', amount: 0.5 }
      : { full: LEAVE_TYPE_LABEL[l.leaveType], short: LEAVE_TYPE_LABEL[l.leaveType].slice(0, 2), amount: 1 };
    const start = l.startDate < from ? from : l.startDate;
    const end = l.endDate > to ? to : l.endDate;
    const [sy, sm, sd] = start.split('-').map(Number);
    for (let t = Date.UTC(sy, sm - 1, sd); ; t += 86_400_000) {
      const d = new Date(t);
      const key = toYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (key > end) break;
      const wd = d.getUTCDay();
      if (wd === 0 || wd === 6 || holidays.has(key)) continue;
      map.set(key, [...(map.get(key) ?? []), mark]);
    }
  }
  return map;
}

/** 달 전체 휴가량(반차 0.5) */
export function totalLeaveAmount(map: Map<string, LeaveMark[]>): number {
  let sum = 0;
  for (const marks of map.values()) for (const m of marks) sum += m.amount;
  return sum;
}
