// 주간업무 조회 화면 표시용 순수 헬퍼 (상태 라벨·배지색·날짜 포맷)

import type { BadgeVariant } from '@/components/ui/badge';
import { documentStatusLabel, type DocumentStatusValue } from '@/lib/documents/document-status';

// 키 누락 시 타입 에러 — 상태값 단일 출처(DOCUMENT_STATUSES)와 동기화 강제
const STATUS_VARIANTS: Record<DocumentStatusValue, BadgeVariant> = {
  completed: 'success',
  approved: 'success',
  in_approval: 'info',
  submitted: 'info',
  draft: 'default',
  rejected: 'danger',
};

export function statusLabel(status: string): string {
  return documentStatusLabel(status);
}

export function statusBadgeVariant(status: string): BadgeVariant {
  return (STATUS_VARIANTS as Record<string, BadgeVariant>)[status] ?? 'default';
}

/** ISO 문자열 → 'YYYY.MM.DD' */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO 문자열 → 'YYYY.MM.DD HH:mm' */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;

export interface WeekInfo {
  /** 그룹 키 'YYYY-MM-N' */
  key: string;
  /** 'N월 N주차' */
  label: string;
  /** 'YYYY.MM.DD ~ MM.DD' (월~일) */
  range: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * ISO 문자열 → KST 기준 'N월 N주차'.
 * 주는 월~일, 월 귀속은 그 주 목요일이 속한 달(ISO 방식 — 월말/월초 자투리 주 방지).
 * 서버(UTC)·브라우저 타임존과 무관하게 KST로 고정 계산한다.
 */
export function getWeekInfo(iso: string): WeekInfo | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const k = new Date(t + KST_OFFSET_MS);
  const day = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
  const dow = (new Date(day).getUTCDay() + 6) % 7; // 월=0 … 일=6
  const monday = day - dow * DAY_MS;
  const thu = new Date(monday + 3 * DAY_MS);
  const sun = new Date(monday + 6 * DAY_MS);
  const mon = new Date(monday);

  const y = thu.getUTCFullYear();
  const m = thu.getUTCMonth();
  const firstDow = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const firstThursday = 1 + ((3 - firstDow + 7) % 7);
  const week = Math.floor((thu.getUTCDate() - firstThursday) / 7) + 1;

  return {
    key: `${y}-${pad2(m + 1)}-${week}`,
    label: `${m + 1}월 ${week}주차`,
    range: `${mon.getUTCFullYear()}.${pad2(mon.getUTCMonth() + 1)}.${pad2(mon.getUTCDate())} ~ ${pad2(sun.getUTCMonth() + 1)}.${pad2(sun.getUTCDate())}`,
  };
}

/** 정렬 순서를 유지한 채 주차별로 묶는다(입력이 작성일 내림차순이면 그룹도 최신 주차부터). */
export function groupByWeek<T extends { createdAt: string }>(items: T[]): Array<{ week: WeekInfo; items: T[] }> {
  const groups = new Map<string, { week: WeekInfo; items: T[] }>();
  const unknown: WeekInfo = { key: 'unknown', label: '작성일 미상', range: '' };
  for (const item of items) {
    const week = getWeekInfo(item.createdAt) ?? unknown;
    const g = groups.get(week.key);
    if (g) g.items.push(item);
    else groups.set(week.key, { week, items: [item] });
  }
  return [...groups.values()];
}
