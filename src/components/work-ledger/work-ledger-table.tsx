'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import {
  PAYMENT_TYPE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type WorkPayment,
  type WorkProject,
} from '@/lib/work-ledger/types';
import { expectedProfit, formatKRW, formatNumber, marginRate, receivable } from '@/lib/work-ledger/calc';

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

function PaymentLine({ payment }: { payment: WorkPayment }) {
  const label = payment.type === 'interim' ? `중도금${payment.seq}` : PAYMENT_TYPE_LABELS[payment.type];
  return (
    <div>
      <div className="font-medium text-emerald-600">{formatNumber(payment.amount)}</div>
      <div className="text-[11px] text-foreground-quaternary">{label}</div>
    </div>
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
      <table className="w-full min-w-[1120px] table-fixed text-[13px]">
        <colgroup>
          <col style={{ width: '5.5%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '5.5%' }} />
        </colgroup>
        <thead>
          <tr className="bg-surface-secondary text-foreground-secondary">
            <th className="px-2 py-4 text-center font-semibold">상태</th>
            <th className="px-5 py-4 text-center font-semibold">프로젝트</th>
            <th className="w-[104px] px-3 py-4 text-center font-semibold">계약총액</th>
            <th className="w-[104px] px-3 py-4 text-center font-semibold">매입금액</th>
            <th className="w-[104px] px-3 py-4 text-center font-semibold">예상수익</th>
            <th className="w-[104px] px-3 py-4 text-center font-semibold">수금내역</th>
            <th className="w-[104px] px-3 py-4 text-center font-semibold">미수금</th>
            <th className="px-5 py-4 text-center font-semibold">비고</th>
            <th className="w-16 px-2 py-4 text-center font-semibold">관리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {projects.map((p) => {
            const isOwner = !!currentUserId && p.created_by === currentUserId;
            return (
              <tr key={p.id} className="align-top hover:bg-surface-secondary/40 transition-colors">
                <td className="px-2 py-6"><StatusBadge project={p} /></td>
                <td className="px-5 py-6">
                  <div className="font-medium text-foreground">{p.name}</div>
                  <div className="mt-2 space-y-1 text-[12px] text-foreground-tertiary">
                    {p.client_name && <div>발주 {p.client_name}</div>}
                    {p.supplier_name && <div>매입 {p.supplier_name}</div>}
                    {p.manager_name && <div>담당 {p.manager_name}</div>}
                    {p.due_date && <div className="text-foreground-quaternary">완료예정 {p.due_date}</div>}
                  </div>
                </td>
                <td className="w-[104px] px-3 py-6 text-right">
                  <div className="font-medium text-foreground">{formatKRW(p.contract_amount)}</div>
                </td>
                <td className="w-[104px] px-3 py-6 text-right">
                  <div className="font-medium text-foreground">{formatKRW(p.purchase_amount)}</div>
                </td>
                <td className="w-[104px] px-3 py-6 text-right">
                  <div className="font-medium text-primary">{formatKRW(expectedProfit(p.contract_amount, p.purchase_amount))}</div>
                  <div className="mt-1 text-[11px] text-foreground-quaternary">{marginRate(p.contract_amount, p.purchase_amount)}%</div>
                </td>
                <td className="w-[104px] px-3 py-6 text-right">
                  {p.payments.length === 0 ? (
                    <span className="text-[12px] text-foreground-quaternary">—</span>
                  ) : (
                    <div className="flex flex-col items-end gap-2">
                      {p.payments.map((pay, i) => <PaymentLine key={pay.id ?? i} payment={pay} />)}
                    </div>
                  )}
                </td>
                <td className="w-[104px] px-3 py-6 text-right">
                  <div className={`font-medium ${receivable(p) > 0 ? 'text-foreground' : 'text-foreground-quaternary'}`}>{formatKRW(receivable(p))}</div>
                </td>
                <td className="px-5 py-6 align-top">
                  {p.note
                    ? <p className="max-w-[220px] whitespace-pre-wrap break-words text-[12px] text-foreground-secondary line-clamp-3">{p.note}</p>
                    : <span className="text-[12px] text-foreground-quaternary">—</span>}
                </td>
                <td className="w-16 px-2 py-6">
                  <div className="flex items-center justify-center gap-2">
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
