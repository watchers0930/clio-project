// 월 고정지출/월지출 - 'YYYY-MM' 월 유틸 (순수 함수)

/** 현재 연-월 'YYYY-MM' */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM'의 직전 달 'YYYY-MM' */
export function prevMonth(m: string): string {
  const [y, mm] = m.split('-').map(Number);
  if (!y || !mm) return m;
  return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' → 'YYYY년 M월' 한글 표기 */
export function monthLabel(m: string): string {
  const [y, mm] = m.split('-');
  if (!y || !mm) return m;
  return `${y}년 ${Number(mm)}월`;
}

/** 'YYYY-MM' 형식 유효성 */
export function isValidMonth(m: unknown): m is string {
  return typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}
