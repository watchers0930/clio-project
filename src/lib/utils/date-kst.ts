/**
 * 서버(Vercel)는 UTC로 동작하므로 `new Date().getFullYear()` 등은 UTC 기준이 된다.
 * 한국 새벽(00:00~08:59 KST)에는 UTC가 전날이라 생성일이 하루 밀리는 문제가 생긴다.
 * 한국(KST, UTC+9, 서머타임 없음) 기준 날짜/시각을 반환하는 공용 유틸.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstShifted(): Date {
  // UTC 시각에 +9h를 더한 Date의 getUTC* 값 = KST 벽시계 값
  return new Date(Date.now() + KST_OFFSET_MS);
}

/** KST 기준 'YYYY-MM-DD' */
export function kstDateStr(): string {
  const d = kstShifted();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** KST 기준 'HH:mm' */
export function kstTimeStr(): string {
  const d = kstShifted();
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * DB의 UTC 타임스탬프(created_at 등)를 KST 기준 'YYYY-MM-DD'로 변환.
 * `created_at.split('T')[0]`은 UTC 날짜라 한국 새벽 생성분이 하루 밀리므로 이걸 쓴다.
 */
export function kstDateFromISO(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.split('T')[0] ?? '';
  const d = new Date(t + KST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
