// 관리비 - 서버 입력 검증 (순수 함수)
import { TAX_TYPES } from './types';
import type { FeeEntryCreateInput, FeeEntryFields, FeeEntryUpdateInput, FeeItemInput, TaxType } from './types';

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_RE = /^(20[0-9]{2})-(0[1-9]|1[0-2])$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/; // '0x10'·'1e5'·'1.2.3' 거부

// DB 컬럼 자릿수와 맞춘 상한: usage numeric(15,3), 단가 numeric(15,2), 금액 numeric(15,0)
const USAGE_MAX = 999_999_999_999.999;
const PRICE_MAX = 1e10;
const ENTRY_KEYS = ['usage', 'unit_price', 'amount', 'amount_overridden', 'memo'] as const;
const ITEM_UPDATE_KEYS = ['unit', 'default_unit_price', 'tax_type', 'is_active'] as const;
export const MAX_REORDER_IDS = 200; // = route-guard MAX_ITEMS

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** 항목명 정리 — 저장 전 단일 기준: NFC, 보이지 않는 문자 제거, 연속 공백 하나로 (DB 유일 인덱스 btrim 과 어긋나지 않게) */
export function normalizeItemName(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.normalize('NFC').replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

function optStr(v: unknown, max: number, label: string): Result<string | null> {
  const s = str(v);
  if (!s) return { ok: true, value: null };
  if (s.length > max) return { ok: false, error: `${label}이(가) 너무 깁니다. (최대 ${max}자)` };
  return { ok: true, value: s };
}

/** 숫자 필드: number 또는 숫자 문자열(쉼표 허용). 빈값→null, 범위·소수 자릿수 검사. */
function optNum(
  v: unknown,
  label: string,
  opts: { min: number; max: number; decimals: number },
): Result<number | null> {
  if (v === null || v === undefined) return { ok: true, value: null };
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string') {
    const s = v.replace(/,/g, '').trim();
    if (!s) return { ok: true, value: null };
    if (!NUMBER_RE.test(s)) return { ok: false, error: `${label}이(가) 올바르지 않습니다.` };
    n = Number(s);
  } else return { ok: false, error: `${label}이(가) 올바르지 않습니다.` };
  if (!Number.isFinite(n)) return { ok: false, error: `${label}이(가) 올바르지 않습니다.` };
  // DB 가 조용히 반올림하지 않도록 자릿수 초과는 거부
  if (Number(n.toFixed(opts.decimals)) !== n) {
    return {
      ok: false,
      error: opts.decimals === 0 ? `${label}은(는) 원 단위 정수여야 합니다.` : `${label}은(는) 소수 ${opts.decimals}자리까지 입력할 수 있습니다.`,
    };
  }
  if (n < opts.min || n > opts.max) return { ok: false, error: `${label}이(가) 허용 범위를 벗어났습니다.` };
  return { ok: true, value: n };
}

export function validateItemInput(body: unknown, mode: 'create' | 'update'): Result<FeeItemInput> {
  if (!isObject(body)) return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  const name = normalizeItemName(body.name);
  if (!name) return { ok: false, error: '항목명을 입력해 주세요.' };
  if (name.length > 50) return { ok: false, error: '항목명이 너무 깁니다. (최대 50자)' };
  const unit = optStr(body.unit, 20, '단위');
  if (!unit.ok) return unit;
  // 수정은 전체 교체 — 빠진 칸을 기본값으로 덮어쓰지 않도록 모든 칸을 요구한다
  if (mode === 'update' && ITEM_UPDATE_KEYS.some((k) => !(k in body))) return { ok: false, error: '수정할 항목 정보가 부족합니다.' };
  const price = optNum(body.default_unit_price, '기본 단가', { min: 0, max: PRICE_MAX, decimals: 2 });
  if (!price.ok) return price;
  // 생성 때 빠지면 과세(고지서 대부분), 수정은 위에서 필수로 요구
  const taxType = body.tax_type === undefined && mode === 'create' ? 'taxable' : body.tax_type;
  if (!TAX_TYPES.includes(taxType as TaxType)) return { ok: false, error: '과세 구분이 올바르지 않습니다.' };
  let isActive = true;
  if (mode === 'update') {
    if (typeof body.is_active !== 'boolean') return { ok: false, error: '숨김 여부가 올바르지 않습니다.' };
    isActive = body.is_active;
  }
  return {
    ok: true,
    value: { name, unit: unit.value, default_unit_price: price.value, tax_type: taxType as TaxType, is_active: isActive },
  };
}

function parseEntryFields(body: Record<string, unknown>): Result<FeeEntryFields> {
  const usage = optNum(body.usage, '사용량', { min: 0, max: USAGE_MAX, decimals: 3 });
  if (!usage.ok) return usage;
  const unitPrice = optNum(body.unit_price, '단가', { min: 0, max: PRICE_MAX, decimals: 2 });
  if (!unitPrice.ok) return unitPrice;
  const amount = optNum(body.amount, '금액', { min: -1e13, max: 1e13, decimals: 0 });
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

/** 수정: 전체 교체 + updated_at(동시 수정 충돌 확인용) 필수 */
export function validateEntryUpdate(body: unknown): Result<FeeEntryUpdateInput> {
  if (!isObject(body)) return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  if (ENTRY_KEYS.some((k) => !(k in body))) return { ok: false, error: '수정할 기록 정보가 부족합니다.' };
  if (typeof body.updated_at !== 'string' || !body.updated_at || body.updated_at.length > 40) {
    return { ok: false, error: '기록 버전 정보가 없습니다. 새로고침 후 다시 시도해 주세요.' };
  }
  const fields = parseEntryFields(body);
  if (!fields.ok) return fields;
  return { ok: true, value: { ...fields.value, updated_at: body.updated_at } };
}

export function validateEntryCreate(body: unknown): Result<FeeEntryCreateInput> {
  if (!isObject(body)) return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  if (typeof body.item_id !== 'string' || !UUID_RE.test(body.item_id)) return { ok: false, error: '항목을 선택해 주세요.' };
  if (typeof body.month !== 'string' || !MONTH_RE.test(body.month)) return { ok: false, error: '월 형식이 올바르지 않습니다. (YYYY-MM)' };
  const rest = parseEntryFields(body);
  if (!rest.ok) return rest;
  return { ok: true, value: { item_id: body.item_id, month: body.month, ...rest.value } };
}

/** 순서 저장: 중복 없는 UUID 배열(1~200개) — 전체 항목과 같은지는 라우트가 DB 와 대조한다 */
export function validateReorder(body: unknown): Result<string[]> {
  if (!isObject(body) || !Array.isArray(body.ids)) return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  const ids = body.ids;
  if (ids.length === 0 || ids.length > MAX_REORDER_IDS) return { ok: false, error: '순서 목록이 올바르지 않습니다.' };
  if (!ids.every(isUuid)) return { ok: false, error: '순서 목록이 올바르지 않습니다.' };
  if (new Set(ids.map((id) => id.toLowerCase())).size !== ids.length) return { ok: false, error: '순서 목록에 같은 항목이 두 번 있습니다.' };
  return { ok: true, value: ids };
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
