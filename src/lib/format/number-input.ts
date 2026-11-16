// 숫자 입력칸 공용 처리 (순수 함수) — 천 단위 쉼표, 소수·음수·자릿수 제한, 붙여넣기 정리, 커서 위치 복원.
// components/ui/number-input.tsx 가 쓴다. 금액·사용량·단가 등 모든 쉼표 숫자 입력의 단일 출처.

export interface NumberInputOptions {
  decimals: number; // 소수 자릿수 (0 = 정수, 점 뒤는 버린다: '12.5' → '12')
  allowNegative?: boolean;
  maxInt?: number; // 정수부 최대 자릿수 (기본 13)
}

const NUMBERISH = /^\d*(\.\d*)?$/;

/**
 * 입력 문자열 → 표시 문자열. 값을 몰래 바꿔야 하는 입력은 null(호출부는 이전 값을 유지):
 * 숫자 아닌 글자, 음수 불가 칸의 '-'·괄호, 정수 칸의 '.'(예전엔 뒤를 버려 1,000,000 → 1), 정수부 자릿수 초과.
 * 통화 기호·'원'·공백·쉼표는 지우고, 입력 도중의 '12.'·'-' 는 그대로 둔다.
 */
export function formatNumberInput(raw: string, opts: NumberInputOptions): string | null {
  let s = raw.replace(/[\s,원₩]/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }
  if (!NUMBERISH.test(s)) return null;
  if (negative && opts.allowNegative !== true) return null;
  if (opts.decimals === 0 && s.includes('.')) return null;
  const sign = negative ? '-' : '';
  const dot = s.indexOf('.');
  const intDigits = (dot === -1 ? s : s.slice(0, dot)).replace(/^0+(?=\d)/, '');
  if (intDigits.length > (opts.maxInt ?? 13)) return null;
  if (!intDigits && dot === -1) return sign;
  const intText = intDigits ? Number(intDigits).toLocaleString('ko-KR') : '0';
  if (dot === -1) return `${sign}${intText}`;
  return `${sign}${intText}.${s.slice(dot + 1, dot + 1 + opts.decimals)}`;
}

/**
 * 붙여넣은 문구에서 숫자만 너그럽게 뽑는다('KRW 1,234'·'금1,000원정'·'1.234.567'·'(1,000)').
 * 점이 둘 이상이면 천 단위 구분으로 보고, 정수 칸이면 소수부를 버린다. 쉼표 없는 숫자 문자열 또는 null.
 */
export function extractPastedNumber(text: string, opts: NumberInputOptions): string | null {
  const firstDigit = text.search(/\d/);
  if (firstDigit === -1) return null;
  const negative = /\(.*\d.*\)/.test(text) || text.slice(0, firstDigit).includes('-');
  if (negative && opts.allowNegative !== true) return null;
  let body = text.replace(/[^\d.]/g, '');
  if ((body.match(/\./g) ?? []).length > 1) body = body.replace(/\./g, '');
  if (opts.decimals === 0 && body.includes('.')) body = body.slice(0, body.indexOf('.'));
  if (!/\d/.test(body)) return null;
  return `${negative ? '-' : ''}${body}`;
}

/** 표시 문자열 → 숫자. 비었거나 '-' 만 있으면 null. */
export function parseNumberInput(s: string): number | null {
  const t = s.replace(/,/g, '').trim();
  if (!t || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const SIGNIFICANT = /[\d.-]/;

/** 커서 앞의 의미 있는 글자(숫자·점·부호) 수 — 쉼표가 바뀌어도 변하지 않는 기준 */
export function countSignificant(text: string, caret: number): number {
  let n = 0;
  for (const ch of text.slice(0, caret)) if (SIGNIFICANT.test(ch)) n++;
  return n;
}

/** 다시 쉼표를 넣은 문자열에서, 의미 있는 글자 n개 바로 뒤의 커서 위치 */
export function caretAfterFormat(formatted: string, n: number): number {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (SIGNIFICANT.test(formatted[i]) && ++seen === n) return i + 1;
  }
  return formatted.length;
}
