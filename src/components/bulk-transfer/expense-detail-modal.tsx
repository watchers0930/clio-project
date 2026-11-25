'use client';

import { useEffect } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { memoLines } from '@/lib/bulk-transfer/memo-lines';

interface Props {
  /** 표시할 항목. null 이면 닫힘 */
  expense: { label: string; amount: number | string; memo: string | null } | null;
  /** 제목 앞 구분 (예: 고정지출, 2026년 11월 월지출) */
  kind: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** 고정지출·월지출 항목 상세: 금액 + 메모를 내용별 한 줄씩 */
export function ExpenseDetailModal({ expense, kind, onClose, onEdit, onDelete }: Props) {
  useEffect(() => {
    if (!expense) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expense, onClose]);

  if (!expense) return null;
  const lines = memoLines(expense.memo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${expense.label} 상세`}
        className="w-full max-w-md rounded-2xl border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <p className="text-[12px] text-foreground-quaternary">{kind}</p>
            <h3 className="break-words text-[15px] font-semibold text-foreground">{expense.label}</h3>
          </div>
          <button onClick={onClose} className="text-foreground-secondary hover:text-foreground" title="닫기">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div>
            <p className="text-[12px] font-medium text-foreground-secondary">금액</p>
            <p className="mt-0.5 font-mono text-[20px] font-semibold text-foreground">
              {Number(expense.amount).toLocaleString('ko-KR')}원
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-foreground-secondary">세부 내용</p>
            {lines.length === 0 ? (
              <p className="text-[13px] text-foreground-quaternary">메모가 없습니다.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface-secondary">
                {lines.map((line, i) => (
                  <li key={i} className="break-words px-4 py-2.5 text-[13px] leading-relaxed text-foreground">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] text-foreground-secondary hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} strokeWidth={1.5} />
            삭제
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-[13px] text-foreground hover:bg-surface-secondary transition-colors"
            >
              닫기
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-medium text-white hover:bg-primary-dark transition-colors"
            >
              <Pencil size={14} strokeWidth={1.5} />
              수정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
