// 작업내역 서버 입력 검증 (순수 함수)
import type { PaymentType, WorkPayment, WorkProjectInput, WorkProjectStatus } from './types';

const STATUSES: WorkProjectStatus[] = ['planned', 'in_progress', 'completed', 'on_hold', 'cancelled'];
const PAYMENT_TYPES: PaymentType[] = ['down', 'interim', 'balance'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ValidationResult =
  | { ok: true; value: WorkProjectInput }
  | { ok: false; error: string };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function normDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string' && DATE_RE.test(v)) return v;
  return undefined as unknown as null; // 형식 오류 표식
}

function isValidUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function validateWorkProjectInput(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '요청 본문이 올바르지 않습니다.' };
  const b = raw as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return { ok: false, error: '프로젝트명은 필수입니다.' };
  if (name.length > 200) return { ok: false, error: '프로젝트명이 너무 깁니다.' };

  const status = (b.status as WorkProjectStatus) ?? 'in_progress';
  if (!STATUSES.includes(status)) return { ok: false, error: '상태 값이 올바르지 않습니다.' };

  if (!isFiniteNumber(b.contract_amount) || b.contract_amount < 0) {
    return { ok: false, error: '계약총액은 0 이상의 숫자여야 합니다.' };
  }
  if (!isFiniteNumber(b.margin_rate) || b.margin_rate < 0 || b.margin_rate > 100) {
    return { ok: false, error: '수익률은 0~100 사이여야 합니다.' };
  }

  const contract_date = normDate(b.contract_date);
  if (contract_date === undefined) return { ok: false, error: '계약일 형식이 올바르지 않습니다.' };
  const due_date = normDate(b.due_date);
  if (due_date === undefined) return { ok: false, error: '완료예정일 형식이 올바르지 않습니다.' };

  const manager_id = b.manager_id == null || b.manager_id === '' ? null : b.manager_id;
  if (manager_id !== null && !isValidUuid(manager_id)) {
    return { ok: false, error: '담당자 값이 올바르지 않습니다.' };
  }

  const rawDepts = Array.isArray(b.visible_department_ids) ? b.visible_department_ids : [];
  const visible_department_ids: string[] = [];
  for (const d of rawDepts) {
    if (!isValidUuid(d)) return { ok: false, error: '열람 팀 값이 올바르지 않습니다.' };
    visible_department_ids.push(d);
  }

  const rawPayments = Array.isArray(b.payments) ? b.payments : [];
  if (rawPayments.length > 50) return { ok: false, error: '대금 단계가 너무 많습니다.' };
  const payments: WorkPayment[] = [];
  for (let i = 0; i < rawPayments.length; i++) {
    const p = rawPayments[i] as Record<string, unknown>;
    const type = p?.type as PaymentType;
    if (!PAYMENT_TYPES.includes(type)) return { ok: false, error: '대금 종류가 올바르지 않습니다.' };
    if (!isFiniteNumber(p?.amount) || (p.amount as number) < 0) {
      return { ok: false, error: '대금 금액은 0 이상의 숫자여야 합니다.' };
    }
    const pDue = normDate(p?.due_date);
    if (pDue === undefined) return { ok: false, error: '대금 예정일 형식이 올바르지 않습니다.' };
    const pPaidDate = normDate(p?.paid_date);
    if (pPaidDate === undefined) return { ok: false, error: '수금일 형식이 올바르지 않습니다.' };
    payments.push({
      type,
      seq: isFiniteNumber(p?.seq) ? (p.seq as number) : 1,
      amount: p.amount as number,
      due_date: pDue,
      paid: Boolean(p?.paid),
      paid_date: pPaidDate,
      sort_order: isFiniteNumber(p?.sort_order) ? (p.sort_order as number) : i,
    });
  }

  return {
    ok: true,
    value: {
      name,
      status,
      client_name: typeof b.client_name === 'string' && b.client_name.trim() ? b.client_name.trim() : null,
      supplier_name: typeof b.supplier_name === 'string' && b.supplier_name.trim() ? b.supplier_name.trim() : null,
      manager_id,
      contract_date,
      due_date,
      contract_amount: b.contract_amount,
      margin_rate: b.margin_rate,
      visible_department_ids,
      note: typeof b.note === 'string' && b.note.trim() ? b.note.trim() : null,
      payments,
    },
  };
}
