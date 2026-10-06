'use client';

import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { MonthlyExpense } from '@/lib/bulk-transfer/types';
import { currentMonth, monthLabel } from '@/lib/bulk-transfer/month-utils';

interface Props {
  expenses: MonthlyExpense[];
  onAdd: (month: string) => void;
  onEdit: (e: MonthlyExpense) => void;
  onDelete: (e: MonthlyExpense) => void;
}

export function MonthlyExpenseList({ expenses, onAdd, onEdit, onDelete }: Props) {
  const [month, setMonth] = useState(currentMonth());

  const monthItems = useMemo(
    () =>
      expenses
        .filter((e) => e.month === month)
        .sort((a, b) => Number(b.amount) - Number(a.amount)),
    [expenses, month],
  );
  const total = useMemo(() => monthItems.reduce((s, e) => s + Number(e.amount), 0), [monthItems]);

  return (
    <div className="flex flex-col gap-4">
      {/* 안내 + 월 선택 + 추가 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px] text-foreground-secondary">
          그 달에만 발생한 변동 지출을 월별로 기록합니다. 당월 총지출 = 고정지출 + 해당 월 월지출.
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className="h-9 rounded-xl border border-border bg-white px-3 text-[13px] text-foreground"
          />
          <button
            onClick={() => onAdd(month)}
            className="flex items-center justify-center gap-1.5 h-9 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground hover:bg-surface-secondary transition-colors"
          >
            <Plus size={15} strokeWidth={1.5} />
            항목 추가
          </button>
        </div>
      </div>

      {/* 월 합계 카드 */}
      <div className="flex items-end justify-between rounded-xl border border-border bg-surface-secondary px-5 py-4">
        <span className="text-[13px] font-medium text-foreground-secondary">
          {monthLabel(month)} 월지출 합계 ({monthItems.length}건)
        </span>
        <span className="font-mono text-[20px] font-semibold text-foreground">{total.toLocaleString('ko-KR')}원</span>
      </div>

      {/* 모바일 카드 */}
      <div className="flex flex-col md:hidden" style={{ gap: '10px' }}>
        {monthItems.length === 0 ? (
          <div className="rounded-xl border border-border bg-white py-12 text-center text-[13px] text-foreground-tertiary">
            {monthLabel(month)}에 등록된 월지출이 없습니다.
          </div>
        ) : (
          monthItems.map((e) => (
            <div key={e.id} className="rounded-xl border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-[14px] font-medium text-foreground">{e.label}</p>
                  {e.memo && <p className="mt-0.5 text-[12px] text-foreground-secondary">{e.memo}</p>}
                </div>
                <div className="flex flex-shrink-0 items-center gap-4">
                  <button onClick={() => onEdit(e)} className="text-foreground-secondary hover:text-primary transition-colors" title="수정">
                    <Pencil size={16} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => onDelete(e)} className="text-foreground-secondary hover:text-red-500 transition-colors" title="삭제">
                    <Trash2 size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-[11px] text-foreground-quaternary">금액</p>
                <p className="mt-0.5 font-mono text-[16px] font-medium text-foreground">{Number(e.amount).toLocaleString('ko-KR')}원</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 데스크탑 테이블 */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full table-fixed text-[13px]">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[20%]" />
            <col className="w-[34%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr className="bg-surface-secondary">
              <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">항목명</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground-secondary">금액</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">메모</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground-secondary">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {monthItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-14 text-center text-[13px] text-foreground-tertiary">
                  {monthLabel(month)}에 등록된 월지출이 없습니다.
                </td>
              </tr>
            ) : (
              monthItems.map((e) => (
                <tr key={e.id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground truncate">{e.label}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{Number(e.amount).toLocaleString('ko-KR')}</td>
                  <td className="px-4 py-3 text-foreground-secondary truncate">{e.memo || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => onEdit(e)} className="text-foreground-secondary hover:text-primary transition-colors" title="수정">
                        <Pencil size={14} strokeWidth={1.5} />
                      </button>
                      <button onClick={() => onDelete(e)} className="text-foreground-secondary hover:text-red-500 transition-colors" title="삭제">
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {monthItems.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-surface-secondary/60">
                <td className="px-4 py-3 text-left font-semibold text-foreground">합계</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{total.toLocaleString('ko-KR')}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
