// 관리비 - 숫자 입력·표시 (순수 함수, 화면용)

import type { FeeItem } from './types';

/**
 * 입력 중 숫자 문자열: 천 단위 쉼표, 소수 자릿수 제한, 음수 허용 여부, 정수부 자릿수 제한(기본 13).
 * 입력 도중 '12.'·'-' 는 그대로 둔다. 소수 0자리 칸은 점 뒤를 버린다('12.5' → '12', 10배 오입력 방지).
 */
export function formatNumberInput(raw: string, opts: { decimals: number; allowNegative?: boolean; maxInt?: number }): string {
  const negative = opts.allowNegative === true && raw.trim().startsWith('-');
  let cleaned = raw.replace(/[^\d.]/g, '');
  if (opts.decimals === 0 && cleaned.includes('.')) cleaned = cleaned.slice(0, cleaned.indexOf('.'));
  const dot = cleaned.indexOf('.');
  const intPart = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, '').slice(0, opts.maxInt ?? 13);
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

/**
 * 입력창에서 항목을 바꿀 때 단가칸: 비었거나 이전 항목의 기본 단가 그대로(사용자가 손대지 않음)면
 * 새 항목의 기본 단가(없으면 빈칸)로 바꾸고, 사용자가 직접 친 값은 유지한다.
 */
export function unitPriceOnItemChange(
  current: string,
  prev: Pick<FeeItem, 'default_unit_price'> | null,
  next: Pick<FeeItem, 'default_unit_price'> | null,
): string {
  const untouched = current === '' || (prev?.default_unit_price != null && parseNumberInput(current) === prev.default_unit_price);
  if (!untouched) return current;
  return next?.default_unit_price != null ? toInput(next.default_unit_price) : '';
}
