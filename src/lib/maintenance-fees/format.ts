// 관리비 - 숫자 표시 (순수 함수, 화면용). 입력칸 처리는 공용 lib/format/number-input.ts

import type { FeeItem } from './types';
import { parseNumberInput } from '@/lib/format/number-input';

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
