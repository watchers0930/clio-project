'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { FixedExpense, FixedExpenseInput } from '@/lib/bulk-transfer/types';

interface Props {
  open: boolean;
  editing: FixedExpense | null;
  onClose: () => void;
  onSubmit: (input: FixedExpenseInput) => Promise<void>;
}

const inputCls =
  'w-full rounded-xl border border-border bg-surface-secondary px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary';
const labelCls = 'mb-1.5 block text-[12px] font-medium text-foreground-secondary';

/** 숫자 문자열에 천단위 콤마 */
function withComma(v: string): string {
  const digits = v.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('ko-KR') : '';
}

export function FixedExpenseModal({ open, editing, onClose, onSubmit }: Props) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setLabel(editing?.label ?? '');
      setAmount(editing ? Number(editing.amount).toLocaleString('ko-KR') : '');
      setMemo(editing?.memo ?? '');
      setError('');
    }
  }, [open, editing]);

  if (!open) return null;

  const save = async () => {
    const amt = Number(amount.replace(/\D/g, ''));
    if (!label.trim()) {
      setError('항목명을 입력해 주세요.');
      return;
    }
    if (!amt || amt <= 0) {
      setError('금액을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({ label: label.trim(), amount: amt, memo: memo.trim() || null });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-[15px] font-semibold text-foreground">{editing ? '고정지출 수정' : '고정지출 추가'}</h3>
          <button onClick={onClose} className="text-foreground-secondary hover:text-foreground">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-3">
          <div>
            <label className={labelCls}>항목명</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: 임대료, 4대보험, 통신비"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>금액 (원)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(withComma(e.target.value))}
              inputMode="numeric"
              placeholder="0"
              className={`${inputCls} text-right font-mono text-[15px]`}
            />
          </div>

          <div>
            <label className={labelCls}>
              메모 <span className="font-normal text-foreground-quaternary">(선택)</span>
            </label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="내부 메모" className={inputCls} />
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button onClick={onClose} className="h-9 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground-secondary hover:bg-surface-secondary">
            취소
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="h-9 rounded-xl bg-primary px-5 text-[13px] font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
