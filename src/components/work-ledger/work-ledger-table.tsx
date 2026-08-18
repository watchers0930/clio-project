'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import {
  PAYMENT_TYPE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type WorkPayment,
  type WorkProject,
} from '@/lib/work-ledger/types';
import { expectedProfit, formatKRW, formatNumber, isPaymentOverdue, marginRate, paymentsTotal, toKoreanMoney } from '@/lib/work-ledger/calc';

interface Props {
  projects: WorkProject[];
  currentUserId: string | null;
  onView: (project: WorkProject) => void;
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
    <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] ${cls}`} title={payment.paid ? '수금완료' : overdue ? '연체' : '수금예정'}>
      <span className="font-medium">{label}</span>
      <span>{formatNumber(payment.amount)}</span>
      {payment.due_date && <span className="opacity-70">({payment.due_date.slice(5)})</span>}
      {payment.paid && <span>✓</span>}
    </span>
  );
}

export function WorkLedgerTable({ projects, currentUserId, onView, onEdit, onDelete }: Props) {
  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white py-16 text-center text-[13px] text-foreground-tertiary">
        등록된 작업이 없습니다. &lsquo;작업 추가&rsquo; 버튼으로 등록해주세요.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[1080px] text-[13px]">
        <thead>
          <tr className="bg-surface-secondary text-foreground-secondary">
            <th className="px-5 py-4 text-center font-semibold">상태</th>
            <th className="px-5 py-4 text-center font-semibold">프로젝트</th>
            <th className="px-5 py-4 text-center font-semibold">계약총액</th>
            <th className="px-5 py-4 text-center font-semibold">예상수익</th>
            <th className="px-5 py-4 text-center font-semibold">대금 단계</th>
            <th className="px-5 py-4 text-center font-semibold">비고</th>
            <th className="px-5 py-4 text-center font-semibold">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {projects.map((p) => {
            const isOwner = !!currentUserId && p.created_by === currentUserId;
            const downs = p.payments.filter((x) => x.type === 'down');
            const interims = p.payments.filter((x) => x.type === 'interim');
            const balances = p.payments.filter((x) => x.type === 'balance');
            return (
              <tr key={p.id} className="align-top hover:bg-surface-secondary/40 transition-colors">
                <td className="px-5 py-6"><StatusBadge project={p} /></td>
                <td className="px-5 py-6">
                  <div className="font-medium text-foreground">{p.name}</div>
                  <div className="mt-2 space-y-1 text-[12px] text-foreground-tertiary">
                    {p.client_name && <div>발주 {p.client_name}</div>}
                    {p.supplier_name && <div>매입 {p.supplier_name}</div>}
                    {p.manager_name && <div>담당 {p.manager_name}</div>}
                    {p.due_date && <div className="text-foreground-quaternary">완료예정 {p.due_date}</div>}
                  </div>
                </td>
                <td className="px-5 py-6 text-right">
                  <div className="font-medium text-foreground">{formatKRW(p.contract_amount)}</div>
                  <div className="mt-1 text-[11px] text-foreground-quaternary">{toKoreanMoney(p.contract_amount)}</div>
                </td>
                <td className="px-5 py-6 text-right">
                  <div className="font-medium text-primary">{formatKRW(expectedProfit(p.contract_amount, p.purchase_amount))}</div>
                  <div className="mt-1 text-[11px] text-foreground-quaternary">{marginRate(p.contract_amount, p.purchase_amount)}%</div>
                </td>
                <td className="px-5 py-6">
                  {p.payments.length === 0 ? (
                    <span className="text-[12px] text-foreground-quaternary">—</span>
                  ) : (
                    <div className="flex flex-col items-start gap-1">
                      {downs.map((pay, i) => <PaymentChip key={pay.id ?? `d${i}`} payment={pay} />)}
                      {interims.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {interims.map((pay, i) => <PaymentChip key={pay.id ?? `i${i}`} payment={pay} />)}
                        </div>
                      )}
                      {balances.map((pay, i) => <PaymentChip key={pay.id ?? `b${i}`} payment={pay} />)}
                    </div>
                  )}
                  {p.payments.length > 0 && (
                    <div className="mt-3 text-[11px] text-foreground-secondary">
                      합계 <span className="font-medium text-foreground">{formatKRW(paymentsTotal(p.payments))}</span>
                    </div>
                  )}
                </td>
                <td className="px-5 py-6 align-top">
                  {p.note
                    ? <p className="max-w-[220px] whitespace-pre-wrap break-words text-[12px] text-foreground-secondary line-clamp-3">{p.note}</p>
                    : <span className="text-[12px] text-foreground-quaternary">—</span>}
                </td>
                <td className="px-5 py-6">
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => onView(p)} className="text-foreground-secondary hover:text-primary transition-colors" title="보기">
                      <Eye size={15} strokeWidth={1.5} />
                    </button>
                    {isOwner && (
                      <>
                        <button onClick={() => onEdit(p)} className="text-foreground-secondary hover:text-primary transition-colors" title="수정">
                          <Pencil size={14} strokeWidth={1.5} />
                        </button>
                        <button onClick={() => onDelete(p)} className="text-foreground-secondary hover:text-red-500 transition-colors" title="삭제">
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
