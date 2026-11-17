// 관리비 - DB 행 → 화면 모델 (numeric 은 문자열로 올 수 있어 Number 변환)
import { TAX_TYPES } from './types';
import type { FeeEntry, FeeItem, TaxType } from './types';

export const ITEM_SELECT = 'id, name, unit, default_unit_price, tax_type, sort_order, is_active';
export const ENTRY_SELECT = 'id, item_id, month, usage, unit_price, amount, amount_overridden, memo, updated_at';

type Row = Record<string, unknown>;

function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

export function mapItem(r: Row): FeeItem {
  return {
    id: String(r.id),
    name: String(r.name),
    unit: (r.unit as string | null) ?? null,
    default_unit_price: numOrNull(r.default_unit_price),
    tax_type: TAX_TYPES.includes(r.tax_type as TaxType) ? (r.tax_type as TaxType) : 'taxable',
    sort_order: Number(r.sort_order ?? 0),
    is_active: r.is_active !== false,
  };
}

export function mapEntry(r: Row): FeeEntry {
  return {
    id: String(r.id),
    item_id: String(r.item_id),
    month: String(r.month),
    usage: numOrNull(r.usage),
    unit_price: numOrNull(r.unit_price),
    amount: Number(r.amount),
    amount_overridden: r.amount_overridden === true,
    memo: (r.memo as string | null) ?? null,
    updated_at: String(r.updated_at),
  };
}
