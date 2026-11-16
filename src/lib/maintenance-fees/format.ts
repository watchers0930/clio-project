// 관리비 - 숫자 입력·표시 (순수 함수, 화면용)

/** 입력 중 숫자 문자열: 천 단위 쉼표, 소수 자릿수 제한, 음수 허용 여부. 입력 도중 '12.'·'-' 는 그대로 둔다. */
export function formatNumberInput(raw: string, opts: { decimals: number; allowNegative?: boolean }): string {
  const negative = opts.allowNegative === true && raw.trim().startsWith('-');
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  const intPart = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, '');
  const fracPart = dot === -1 ? '' : cleaned.slice(dot + 1).replace(/\./g, '').slice(0, opts.decimals);
  const sign = negative ? '-' : '';
  if (!intPart && dot === -1) return sign;
  const intText = intPart ? Number(intPart).toLocaleString('ko-KR') : '0';
  return opts.decimals > 0 && dot !== -1 ? `${sign}${intText}.${fracPart}` : `${sign}${intText}`;
}

/** 입력 문자열 → 숫자. 비었거나 '-' 만 있으면 null. */
export function parseNumberInput(s: string): number | null {
  const t = s.replace(/,/g, '').trim();
  if (!t || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** 원 단위 표시 */
export function won(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 숫자 → 입력창 초기값 */
export function toInput(n: number | null): string {
  return n === null ? '' : n.toLocaleString('ko-KR', { maximumFractionDigits: 3 });
}
