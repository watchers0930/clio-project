'use client';

import { Pencil, Trash2 } from 'lucide-react';
import {
  PAYMENT_TYPE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type WorkPayment,
  type WorkProject,
} from '@/lib/work-ledger/types';
import { expectedProfit, formatKRW, formatNumber, isPaymentOverdue } from '@/lib/work-ledger/calc';

interface Props {
  projects: WorkProject[];
  onEdit: (project: WorkProject) => void;
  onDelete: (project: WorkProject) => void;
}

function StatusBadge({ project }: { project: WorkProject }) {
  const color = STATUS_COLORS[project.status];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}18`, color }}>
      {STATUS_LABELS[project.status]}
    </span>
  );
}

function PaymentChip({ payment }: { payment: WorkPayment }) {
  const overdue = isPaymentOverdue(payment);
  const label = payment.type === 'interim' ? `중도금${payment.seq}` : PAYMENT_TYPE_LABELS[payment.type];
  const cls = payment.paid
    ? 'bg-emerald-50 text-emerald-700'
    : overdue
      ? 'bg-red-50 text-red-600'
      : 'bg-surface-secondary text-foreground-secondary';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ${cls}`} title={payment.paid ? '수금완료' : overdue ? '연체' : '수금예정'}>
      <span className="font-medium">{label}</span>
      <span>{formatNumber(payment.amount)}</span>
      {payment.due_date && <span className="opacity-70">({payment.due_date.slice(5)})</span>}
      {payment.paid && <span>✓</span>}
    </span>
  );
}

export function WorkLedgerTable({ projects, onEdit, onDelete }: Props) {
  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white py-16 text-center text-[13px] text-foreground-tertiary">
        등록된 작업이 없습니다. &lsquo;작업 추가&rsquo; 버튼으로 등록해주세요.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[900px] text-[13px]">
        <thead>
          <tr className="bg-surface-secondary text-left text-foreground-secondary">
            <th className="px-4 py-3 font-semibold">상태</th>
            <th className="px-4 py-3 font-semibold">프로젝트</th>
            <th className="px-4 py-3 text-right font-semibold">계약총액</th>
            <th className="px-4 py-3 text-right font-semibold">예상수익</th>
            <th className="px-4 py-3 font-semibold">대금 단계</th>
            <th className="px-4 py-3 text-center font-semibold">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {projects.map((p) => (
            <tr key={p.id} className="align-top hover:bg-surface-secondary/40 transition-colors">
              <td className="px-4 py-3"><StatusBadge project={p} /></td>
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{p.name}</div>
                <div className="mt-0.5 text-[12px] text-foreground-tertiary">
                  {[p.client_name, p.manager_name].filter(Boolean).join(' · ') || '—'}
                  {p.due_date && <span className="ml-1 text-foreground-quaternary">· 완료예정 {p.due_date}</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-right font-medium text-foreground">{formatKRW(p.contract_amount)}</td>
              <td className="px-4 py-3 text-right">
                <div className="font-medium text-primary">{formatKRW(expectedProfit(p.contract_amount, p.margin_rate))}</div>
                <div className="text-[11px] text-foreground-quaternary">{p.margin_rate}%</div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {p.payments.length === 0
                    ? <span className="text-[12px] text-foreground-quaternary">—</span>
                    : p.payments.map((pay, i) => <PaymentChip key={pay.id ?? i} payment={pay} />)}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => onEdit(p)} className="text-foreground-secondary hover:text-primary transition-colors" title="수정">
                    <Pencil size={14} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => onDelete(p)} className="text-foreground-secondary hover:text-red-500 transition-colors" title="삭제">
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
