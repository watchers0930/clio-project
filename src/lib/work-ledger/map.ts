// DB row → WorkProject 매핑
import type { WorkPayment, WorkProject } from './types';

interface RawPayment {
  id: string;
  type: string;
  seq: number;
  amount: string | number;
  due_date: string | null;
  paid: boolean;
  paid_date: string | null;
  sort_order: number;
}

export interface RawWorkProject {
  id: string;
  name: string;
  status: string;
  client_name: string | null;
  supplier_name: string | null;
  manager_id: string | null;
  contract_date: string | null;
  due_date: string | null;
  contract_amount: string | number;
  margin_rate: string | number;
  visible_department_ids: string[] | null;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  payments?: RawPayment[] | null;
  manager?: { name: string } | { name: string }[] | null;
}

function num(v: string | number): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

function mapPayment(p: RawPayment): WorkPayment {
  return {
    id: p.id,
    type: p.type as WorkPayment['type'],
    seq: p.seq,
    amount: num(p.amount),
    due_date: p.due_date,
    paid: p.paid,
    paid_date: p.paid_date,
    sort_order: p.sort_order,
  };
}

export function mapWorkProject(row: RawWorkProject): WorkProject {
  const manager = Array.isArray(row.manager) ? row.manager[0] : row.manager;
  const payments = (row.payments ?? []).map(mapPayment).sort((a, b) => a.sort_order - b.sort_order);
  return {
    id: row.id,
    name: row.name,
    status: row.status as WorkProject['status'],
    client_name: row.client_name,
    supplier_name: row.supplier_name,
    manager_id: row.manager_id,
    manager_name: manager?.name ?? null,
    contract_date: row.contract_date,
    due_date: row.due_date,
    contract_amount: num(row.contract_amount),
    margin_rate: num(row.margin_rate),
    visible_department_ids: row.visible_department_ids ?? [],
    note: row.note,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    payments,
  };
}
