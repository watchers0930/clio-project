import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import type { EventType, TodoPriority } from './supabase/types';

/** 월간 캘린더 42셀(6주) 날짜 배열 생성 */
export function getCalendarDays(year: number, month: number): Date[] {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  return eachDayOfInterval({ start: calStart, end: calEnd });
}

export { isSameMonth, isSameDay, isToday, format };
export const koLocale = ko;

/** 일정 유형 색상 */
const EVENT_TYPE_COLORS: Record<EventType, string> = {
  meeting: '#2E6FF2',
  deadline: '#ff3b30',
  personal: '#30d158',
  company: '#ff9f0a',
  other: '#6e6e73',
};

/** 일정 유형 한글 라벨 */
const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: '회의',
  deadline: '마감',
  personal: '개인',
  company: '전사',
  other: '기타',
};

export function getEventTypeColor(type: EventType): string {
  return EVENT_TYPE_COLORS[type] ?? '#6e6e73';
}

export function getEventTypeLabel(type: EventType): string {
  return EVENT_TYPE_LABELS[type] ?? '기타';
}

/** 할일 우선순위 색상 */
const PRIORITY_COLORS: Record<TodoPriority, string> = {
  high: '#ff3b30',
  medium: '#ff9f0a',
  low: '#2E6FF2',
};

const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

export function getPriorityColor(priority: TodoPriority): string {
  return PRIORITY_COLORS[priority] ?? '#6e6e73';
}

export function getPriorityLabel(priority: TodoPriority): string {
  return PRIORITY_LABELS[priority] ?? '보통';
}

/** 요일 헤더 */
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
