// 관리비 - 서버 입력 검증 (순수 함수)
import type { FeeEntryCreateInput, FeeEntryUpdateInput, FeeItemInput } from './types';

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_RE = /^(20[0-9]{2})-(0[1-9]|1[0-2])$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function optStr(v: unknown, max: number, label: string): Result<string | null> {
  const s = str(v);
  if (!s) return { ok: true, value: null };
  if (s.length > max) return { ok: false, error: `${label}이(가) 너무 깁니다. (최대 ${max}자)` };
  return { ok: true, value: s };
}

/** 숫자 필드: number 또는 숫자 문자열(쉼표 허용). 빈값→null, 범위·정수 조건 검사. */
function optNum(
  v: unknown,
  label: string,
  opts: { min: number; max: number; integer?: boolean },
): Result<number | null> {
  if (v === null || v === undefined) return { ok: true, value: null };
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string') {
    const s = v.replace(/,/g, '').trim();
    if (!s) return { ok: true, value: null };
    n = Number(s);
  } else return { ok: false, error: `${label}이(가) 올바르지 않습니다.` };
  if (!Number.isFinite(n)) return { ok: false, error: `${label}이(가) 올바르지 않습니다.` };
  if (opts.integer && !Number.isInteger(n)) return { ok: false, error: `${label}은(는) 원 단위 정수여야 합니다.` };
  if (n < opts.min || n > opts.max) return { ok: false, error: `${label}이(가) 허용 범위를 벗어났습니다.` };
  return { ok: true, value: n };
}

export function validateItemInput(body: unknown, mode: 'create' | 'update'): Result<FeeItemInput> {
  if (!isObject(body)) return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  const name = str(body.name);
  if (!name) return { ok: false, error: '항목명을 입력해 주세요.' };
  if (name.length > 50) return { ok: false, error: '항목명이 너무 깁니다. (최대 50자)' };
  const unit = optStr(body.unit, 20, '단위');
  if (!unit.ok) return unit;
  const price = optNum(body.default_unit_price, '기본 단가', { min: 0, max: 1e10 });
  if (!price.ok) return price;
  const order = optNum(body.sort_order, '순서', { min: 0, max: 9999, integer: true });
  if (!order.ok) return order;
  let isActive = true;
  if (mode === 'update' && body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') return { ok: false, error: '숨김 여부가 올바르지 않습니다.' };
    isActive = body.is_active;
  }
  return {
    ok: true,
    value: { name, unit: unit.value, default_unit_price: price.value, sort_order: order.value ?? 0, is_active: isActive },
  };
}

export function validateEntryUpdate(body: unknown): Result<FeeEntryUpdateInput> {
  if (!isObject(body)) return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  const usage = optNum(body.usage, '사용량', { min: 0, max: 1e12 });
  if (!usage.ok) return usage;
  const unitPrice = optNum(body.unit_price, '단가', { min: 0, max: 1e10 });
  if (!unitPrice.ok) return unitPrice;
  const amount = optNum(body.amount, '금액', { min: -1e13, max: 1e13, integer: true });
  if (!amount.ok) return amount;
  if (body.amount_overridden !== undefined && typeof body.amount_overridden !== 'boolean') {
    return { ok: false, error: '직접 입력 여부가 올바르지 않습니다.' };
  }
  const memo = optStr(body.memo, 200, '메모');
  if (!memo.ok) return memo;
  return {
    ok: true,
    value: {
      usage: usage.value,
      unit_price: unitPrice.value,
      amount: amount.value,
      amount_overridden: body.amount_overridden === true,
      memo: memo.value,
    },
  };
}

export function validateEntryCreate(body: unknown): Result<FeeEntryCreateInput> {
  if (!isObject(body)) return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  if (typeof body.item_id !== 'string' || !UUID_RE.test(body.item_id)) return { ok: false, error: '항목을 선택해 주세요.' };
  if (typeof body.month !== 'string' || !MONTH_RE.test(body.month)) return { ok: false, error: '월 형식이 올바르지 않습니다. (YYYY-MM)' };
  const rest = validateEntryUpdate(body);
  if (!rest.ok) return rest;
  return { ok: true, value: { item_id: body.item_id, month: body.month, ...rest.value } };
}

/** 'YYYY' 쿼리 → 2000~2100 정수, 아니면 null. */
export function parseYear(v: string | null): number | null {
  if (!v || !/^\d{4}$/.test(v)) return null;
  const y = Number(v);
  return y >= 2000 && y <= 2100 ? y : null;
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}
