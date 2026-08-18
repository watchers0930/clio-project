'use client';

import { X } from 'lucide-react';
import {
  PAYMENT_TYPE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type DepartmentOption,
  type WorkProject,
} from '@/lib/work-ledger/types';
import {
  expectedProfit,
  formatKRW,
  isPaymentOverdue,
  marginRate,
  paymentsTotal,
  paidTotal,
  unpaidTotal,
  toKoreanMoney,
} from '@/lib/work-ledger/calc';

interface Props {
  open: boolean;
  project: WorkProject | null;
  departments: DepartmentOption[];
  onClose: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-3.5">
      <span className="w-24 flex-shrink-0 text-[12px] text-foreground-tertiary">{label}</span>
      <div className="flex-1 text-[13px] text-foreground">{children}</div>
    </div>
  );
}

function Money({ value }: { value: number }) {
  return (
    <div>
      <div className="font-medium">{formatKRW(value)}</div>
      <div className="mt-0.5 text-[11px] text-foreground-tertiary">{toKoreanMoney(value)}</div>
    </div>
  );
}

export function WorkProjectDetailModal({ open, project, departments, onClose }: Props) {
  if (!open || !project) return null;

  const color = STATUS_COLORS[project.status];
  const deptNames = project.visible_department_ids.length
    ? departments.filter((d) => project.visible_department_ids.includes(d.id)).map((d) => d.name).join(', ')
    : '전체 공개';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[15px] font-semibold text-foreground">{project.name}</h3>
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}18`, color }}>
              {STATUS_LABELS[project.status]}
            </span>
          </div>
          <button onClick={onClose} className="text-foreground-secondary hover:text-foreground">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="divide-y divide-border">
            <Row label="발주처">{project.client_name ?? '—'}</Row>
            <Row label="매입처">{project.supplier_name ?? '—'}</Row>
            <Row label="담당자">{project.manager_name ?? '—'}</Row>
            <Row label="계약일">{project.contract_date ?? '—'}</Row>
            <Row label="완료예정일">{project.due_date ?? '—'}</Row>
            <Row label="계약총액"><Money value={project.contract_amount} /></Row>
            <Row label="매입금액"><Money value={project.purchase_amount} /></Row>
            <Row label="예상수익">
              <div className="font-medium">
                {formatKRW(expectedProfit(project.contract_amount, project.purchase_amount))}
                <span className="ml-2 text-[11px] font-normal text-foreground-quaternary">({marginRate(project.contract_amount, project.purchase_amount)}%)</span>
              </div>
              <div className="mt-0.5 text-[11px] text-foreground-tertiary">{toKoreanMoney(expectedProfit(project.contract_amount, project.purchase_amount))}</div>
            </Row>
            <Row label="확인 팀">{deptNames}</Row>
            {project.note && <Row label="비고"><span className="whitespace-pre-wrap">{project.note}</span></Row>}
          </div>

          {/* 대금 단계 */}
          <div className="mt-6">
            <h4 className="mb-2 text-[12px] font-semibold text-foreground-secondary">대금 단계</h4>
            {project.payments.length === 0 ? (
              <p className="text-[12px] text-foreground-quaternary">등록된 대금 단계가 없습니다.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-surface-secondary text-left text-foreground-secondary">
                      <th className="px-3 py-2 font-medium">구분</th>
                      <th className="px-3 py-2 text-right font-medium">금액</th>
                      <th className="px-3 py-2 font-medium">예정일</th>
                      <th className="px-3 py-2 text-center font-medium">수금</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {project.payments.map((p, i) => {
                      const overdue = isPaymentOverdue(p);
                      const label = p.type === 'interim' ? `중도금${p.seq}` : PAYMENT_TYPE_LABELS[p.type];
                      return (
                        <tr key={p.id ?? i}>
                          <td className="px-3 py-2 font-medium text-foreground">{label}</td>
                          <td className="px-3 py-2 text-right text-foreground">{formatKRW(p.amount)}</td>
                          <td className={`px-3 py-2 ${overdue ? 'text-red-600' : 'text-foreground-secondary'}`}>{p.due_date ?? '—'}{overdue && ' (연체)'}</td>
                          <td className="px-3 py-2 text-center">{p.paid ? <span className="text-emerald-600">완료</span> : <span className="text-foreground-quaternary">예정</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-secondary/60">
                      <td className="px-3 py-2 font-semibold text-foreground">합계</td>
                      <td className="px-3 py-2 text-right font-semibold text-foreground">{formatKRW(paymentsTotal(project.payments))}</td>
                      <td className="px-3 py-2 text-[11px] text-foreground-tertiary" colSpan={2}>
                        수금 {formatKRW(paidTotal(project))} · 미수금 {formatKRW(unpaidTotal(project))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <p className="border-t border-border bg-white px-3 py-2 text-right text-[11px] text-foreground-tertiary">
                  {toKoreanMoney(paymentsTotal(project.payments))}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4">
          <button onClick={onClose} className="h-9 rounded-xl border border-border px-5 text-[13px] font-medium text-foreground-secondary hover:bg-surface-secondary">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
