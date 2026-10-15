// 근태 화면 공용 포맷 유틸 (KST 기준 표시)
// 서버는 수신시각을 UTC(ISO)로 내려주므로, 화면 표시는 항상 Asia/Seoul로 변환한다.

const KST = 'Asia/Seoul';

const timeFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateTimeFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST,
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** ISO UTC → KST 'HH:mm' (null이면 '—') */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return timeFmt.format(d);
}

/** ISO UTC → KST 'M월 D일 HH:mm' */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return dateTimeFmt.format(d);
}

/** 'YYYY-MM-DD' → 'M월 D일 (요일)' */
export function fmtWorkDate(workDate: string): string {
  const [y, m, d] = workDate.split('-').map(Number);
  if (!y || !m || !d) return workDate;
  // 정오 기준으로 요일만 계산(타임존 경계 영향 최소화)
  const date = new Date(Date.UTC(y, m - 1, d, 3));
  const weekday = new Intl.DateTimeFormat('ko-KR', { timeZone: KST, weekday: 'short' }).format(date);
  return `${m}월 ${d}일 (${weekday})`;
}

/** 오늘(KST) 'YYYY-MM-DD' */
export function todayKst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KST }).format(new Date());
}

/** KST 기준 n일 전 'YYYY-MM-DD' */
export function kstDateBefore(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: KST }).format(d);
}

/** 0.5 단위 일수를 '1.5일'처럼 표기 */
export function fmtDays(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)}일`;
}
