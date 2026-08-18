'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PaymentStageEditor } from './payment-stage-editor';
import { expectedProfit, formatKRW, formatNumber, toKoreanMoney } from '@/lib/work-ledger/calc';
import {
  STATUS_LABELS,
  type DepartmentOption,
  type ManagerOption,
  type WorkPayment,
  type WorkProject,
  type WorkProjectInput,
  type WorkProjectStatus,
} from '@/lib/work-ledger/types';

interface Props {
  open: boolean;
  editing: WorkProject | null;
  departments: DepartmentOption[];
  managers: ManagerOption[];
  onClose: () => void;
  onSubmit: (input: WorkProjectInput) => Promise<void>;
}

const INPUT = 'w-full rounded-xl border border-border bg-surface-secondary px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary';
const LABEL = 'mb-1.5 block text-[12px] font-medium text-foreground-secondary';

const EMPTY: WorkProjectInput = {
  name: '',
  status: 'in_progress',
  client_name: null,
  supplier_name: null,
  manager_id: null,
  contract_date: null,
  due_date: null,
  contract_amount: 0,
  margin_rate: 0,
  visible_department_ids: [],
  note: null,
  payments: [],
};

function toInput(p: WorkProject): WorkProjectInput {
  return {
    name: p.name,
    status: p.status,
    client_name: p.client_name,
    supplier_name: p.supplier_name,
    manager_id: p.manager_id,
    contract_date: p.contract_date,
    due_date: p.due_date,
    contract_amount: p.contract_amount,
    margin_rate: p.margin_rate,
    visible_department_ids: p.visible_department_ids,
    note: p.note,
    payments: p.payments.map((pay) => ({ ...pay })),
  };
}

export function WorkProjectFormModal({ open, editing, departments, managers, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<WorkProjectInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(editing ? toInput(editing) : EMPTY);
      setError('');
    }
  }, [open, editing]);

  if (!open) return null;

  const set = <K extends keyof WorkProjectInput>(key: K, value: WorkProjectInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleDept = (id: string) => {
    setForm((f) => ({
      ...f,
      visible_department_ids: f.visible_department_ids.includes(id)
        ? f.visible_department_ids.filter((d) => d !== id)
        : [...f.visible_department_ids, id],
    }));
  };

  const profit = expectedProfit(form.contract_amount, form.margin_rate);

  const submit = async () => {
    if (!form.name.trim()) {
      setError('프로젝트명은 필수입니다.');
      return;
    }
    if (form.margin_rate < 0 || form.margin_rate > 100) {
      setError('수익률은 0~100 사이여야 합니다.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit(form);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-[15px] font-semibold text-foreground">{editing ? '작업 수정' : '작업 추가'}</h3>
          <button onClick={onClose} className="text-foreground-secondary hover:text-foreground">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            <div className="col-span-2">
              <label className={LABEL}>프로젝트명 *</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="예) OO청사 신축공사" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>상태</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value as WorkProjectStatus)} className={INPUT}>
                {(Object.keys(STATUS_LABELS) as WorkProjectStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>발주처</label>
              <input type="text" value={form.client_name ?? ''} onChange={(e) => set('client_name', e.target.value || null)} placeholder="발주처/클라이언트" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>매입처</label>
              <input type="text" value={form.supplier_name ?? ''} onChange={(e) => set('supplier_name', e.target.value || null)} placeholder="공급처/외주처" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>담당자</label>
              <select value={form.manager_id ?? ''} onChange={(e) => set('manager_id', e.target.value || null)} className={INPUT}>
                <option value="">미지정</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>계약일</label>
              <input type="date" value={form.contract_date ?? ''} onChange={(e) => set('contract_date', e.target.value || null)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>완료예정일</label>
              <input type="date" value={form.due_date ?? ''} onChange={(e) => set('due_date', e.target.value || null)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>계약총액</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.contract_amount ? formatNumber(form.contract_amount) : ''}
                onChange={(e) => set('contract_amount', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                placeholder="0"
                className={`${INPUT} text-right`}
              />
              {form.contract_amount > 0 && (
                <p className="mt-1 text-right text-[11px] text-foreground-tertiary">{toKoreanMoney(form.contract_amount)}</p>
              )}
            </div>
            <div>
              <label className={LABEL}>수익률(%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={form.margin_rate || ''}
                onChange={(e) => set('margin_rate', Number(e.target.value) || 0)}
                placeholder="0"
                className={`${INPUT} text-right`}
              />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-xl bg-surface-secondary px-4 py-3">
              <span className="text-[12px] text-foreground-secondary">회사 예상수익 (자동계산)</span>
              <div className="text-right">
                <span className="text-[15px] font-semibold text-primary">{formatKRW(profit)}</span>
                <p className="text-[11px] text-foreground-tertiary">{toKoreanMoney(profit)}</p>
              </div>
            </div>
          </div>

          {/* 대금 단계 */}
          <PaymentStageEditor payments={form.payments} onChange={(payments: WorkPayment[]) => set('payments', payments)} />

          {/* 열람 팀 */}
          <div>
            <label className={LABEL}>확인 가능한 팀 <span className="font-normal text-foreground-quaternary">(미선택 시 전체 공개)</span></label>
            {departments.length === 0 ? (
              <p className="text-[12px] text-foreground-quaternary">등록된 부서가 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {departments.map((d) => {
                  const on = form.visible_department_ids.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDept(d.id)}
                      className={`rounded-lg border px-3 py-1.5 text-[12px] transition-colors ${on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground-secondary hover:bg-surface-secondary'}`}
                    >
                      {d.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 비고 */}
          <div>
            <label className={LABEL}>비고</label>
            <textarea value={form.note ?? ''} onChange={(e) => set('note', e.target.value || null)} rows={2} placeholder="특이사항" className={`${INPUT} resize-none`} />
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button onClick={onClose} className="h-9 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground-secondary hover:bg-surface-secondary">
            취소
          </button>
          <button onClick={() => void submit()} disabled={saving} className="h-9 rounded-xl bg-primary px-5 text-[13px] font-medium text-white hover:bg-primary-dark disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
