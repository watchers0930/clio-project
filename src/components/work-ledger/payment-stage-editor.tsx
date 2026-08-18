'use client';

import { Plus, Trash2 } from 'lucide-react';
import { PAYMENT_TYPE_LABELS, type PaymentType, type WorkPayment } from '@/lib/work-ledger/types';
import { formatKRW, formatNumber, paymentsTotal, toKoreanMoney } from '@/lib/work-ledger/calc';

interface Props {
  payments: WorkPayment[];
  onChange: (payments: WorkPayment[]) => void;
}

const INPUT = 'rounded-lg border border-border bg-surface-secondary px-3 py-2 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary';

function reindex(list: WorkPayment[]): WorkPayment[] {
  let interim = 0;
  return list.map((p, i) => ({
    ...p,
    seq: p.type === 'interim' ? (interim += 1) : 1,
    sort_order: i,
  }));
}

/** 정렬 순서: 계약금 → 중도금 → 잔금 */
const ORDER: Record<PaymentType, number> = { down: 0, interim: 1, balance: 2 };

export function PaymentStageEditor({ payments, onChange }: Props) {
  const update = (idx: number, patch: Partial<WorkPayment>) => {
    onChange(reindex(payments.map((p, i) => (i === idx ? { ...p, ...patch } : p))));
  };

  const remove = (idx: number) => {
    onChange(reindex(payments.filter((_, i) => i !== idx)));
  };

  const add = (type: PaymentType) => {
    const next: WorkPayment = { type, seq: 1, amount: 0, due_date: null, paid: false, paid_date: null, sort_order: 0 };
    const merged = [...payments, next].sort((a, b) => ORDER[a.type] - ORDER[b.type]);
    onChange(reindex(merged));
  };

  const hasDown = payments.some((p) => p.type === 'down');
  const hasBalance = payments.some((p) => p.type === 'balance');

  const label = (p: WorkPayment) => (p.type === 'interim' ? `중도금${p.seq}` : PAYMENT_TYPE_LABELS[p.type]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-medium text-foreground-secondary">대금 단계</label>
        <div className="flex items-center gap-1.5">
          {!hasDown && (
            <button type="button" onClick={() => add('down')} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[12px] text-foreground-secondary hover:bg-surface-secondary">
              <Plus size={12} /> 계약금
            </button>
          )}
          <button type="button" onClick={() => add('interim')} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[12px] text-foreground-secondary hover:bg-surface-secondary">
            <Plus size={12} /> 중도금
          </button>
          {!hasBalance && (
            <button type="button" onClick={() => add('balance')} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[12px] text-foreground-secondary hover:bg-surface-secondary">
              <Plus size={12} /> 잔금
            </button>
          )}
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-4 text-center text-[12px] text-foreground-quaternary">
          위 버튼으로 대금 단계를 추가하세요.
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-lg border border-border bg-white px-2.5 py-2">
              <span className="w-16 flex-shrink-0 text-[12px] font-medium text-foreground">{label(p)}</span>
              <input
                type="text"
                inputMode="numeric"
                value={p.amount ? formatNumber(p.amount) : ''}
                onChange={(e) => update(idx, { amount: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })}
                placeholder="금액"
                className={`${INPUT} w-32 text-right`}
              />
              <input
                type="date"
                value={p.due_date ?? ''}
                onChange={(e) => update(idx, { due_date: e.target.value || null })}
                className={`${INPUT} flex-1`}
              />
              <label className="flex flex-shrink-0 items-center gap-1 text-[12px] text-foreground-secondary">
                <input
                  type="checkbox"
                  checked={p.paid}
                  onChange={(e) => update(idx, { paid: e.target.checked, paid_date: e.target.checked ? (p.paid_date ?? new Date().toISOString().slice(0, 10)) : null })}
                  className="h-3.5 w-3.5 accent-primary"
                />
                수금
              </label>
              <button type="button" onClick={() => remove(idx)} className="flex-shrink-0 text-foreground-quaternary hover:text-red-500">
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}

          {/* 대금 합계 */}
          <div className="flex items-center justify-between rounded-lg bg-surface-secondary px-3 py-2.5">
            <span className="text-[12px] font-medium text-foreground-secondary">대금 합계</span>
            <div className="text-right">
              <div className="text-[13px] font-semibold text-foreground">{formatKRW(paymentsTotal(payments))}</div>
              <div className="text-[11px] text-foreground-tertiary">{toKoreanMoney(paymentsTotal(payments))}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
