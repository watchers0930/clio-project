// 숫자 입력칸 공용 처리 (순수 함수) — 천 단위 쉼표, 소수·음수·자릿수 제한, 붙여넣기 정리, 커서 위치 복원.
// components/ui/number-input.tsx 가 쓴다. 금액·사용량·단가 등 모든 쉼표 숫자 입력의 단일 출처.

export interface NumberInputOptions {
  decimals: number; // 소수 자릿수 (0 = 정수, 점 뒤는 버린다: '12.5' → '12')
  allowNegative?: boolean;
  maxInt?: number; // 정수부 최대 자릿수 (기본 13)
}

const NUMBERISH = /^\d*(\.\d*)?$/;

/**
 * 입력 문자열 → 표시 문자열. 숫자로 읽을 수 없으면 null(호출부는 이전 값을 유지).
 * 붙여넣기의 통화 기호·'원'·공백·쉼표는 지우고, '(1,000)'·'-1,000' 은 음수로 읽는다.
 * 입력 도중의 '12.'·'-' 는 그대로 둔다.
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
  if (opts.decimals === 0 && s.includes('.')) s = s.slice(0, s.indexOf('.'));
  const sign = negative && opts.allowNegative === true ? '-' : '';
  const dot = s.indexOf('.');
  const intDigits = (dot === -1 ? s : s.slice(0, dot)).replace(/^0+(?=\d)/, '').slice(0, opts.maxInt ?? 13);
  if (!intDigits && dot === -1) return sign;
  const intText = intDigits ? Number(intDigits).toLocaleString('ko-KR') : '0';
  if (dot === -1) return `${sign}${intText}`;
  return `${sign}${intText}.${s.slice(dot + 1, dot + 1 + opts.decimals)}`;
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
