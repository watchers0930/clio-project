// 주간업무 조회 화면 표시용 순수 헬퍼 (상태 라벨·배지색·날짜 포맷)

import type { BadgeVariant } from '@/components/ui/badge';

const STATUS_LABELS: Record<string, string> = {
  completed: '완료',
  draft: '초안',
  in_approval: '결재중', // 현재 결재 상정 상태값
  submitted: '결재중', // 레거시 상태값(과거 데이터 호환)
  approved: '승인됨',
  rejected: '반려됨',
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  completed: 'success',
  approved: 'success',
  in_approval: 'info',
  submitted: 'info',
  draft: 'default',
  rejected: 'danger',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function statusBadgeVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[status] ?? 'default';
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
