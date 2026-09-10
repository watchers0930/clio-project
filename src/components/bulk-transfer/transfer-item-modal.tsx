'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { TransferItem, TransferItemInput, TransferPayee } from '@/lib/bulk-transfer/types';

interface Props {
  open: boolean;
  editing: TransferItem | null;
  payees: TransferPayee[];
  onClose: () => void;
  onAddPayee: () => void;
  onSubmit: (input: TransferItemInput) => Promise<void>;
}

const inputCls =
  'w-full rounded-xl border border-border bg-surface-secondary px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary';
const labelCls = 'mb-1.5 block text-[12px] font-medium text-foreground-secondary';

/** 숫자 문자열에 천단위 콤마 */
function withComma(v: string): string {
  const digits = v.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('ko-KR') : '';
}

export function TransferItemModal({ open, editing, payees, onClose, onAddPayee, onSubmit }: Props) {
  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [withdraw, setWithdraw] = useState('');
  const [memo, setMemo] = useState('');
  const [cms, setCms] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPayeeId(editing?.payee_id ?? payees[0]?.id ?? '');
      setAmount(editing ? Number(editing.amount).toLocaleString('ko-KR') : '');
      setDeposit(editing?.deposit_display ?? '');
      setWithdraw(editing?.withdraw_display ?? '');
      setMemo(editing?.memo ?? '');
      setCms(editing?.cms_code ?? '');
      setPhone(editing?.notify_phone ?? '');
      setError('');
    }
  }, [open, editing, payees]);

  if (!open) return null;

  const selectedPayee = payees.find((p) => p.id === payeeId);

  const save = async () => {
    const amt = Number(amount.replace(/\D/g, ''));
    if (!payeeId) {
      setError('거래처를 선택해 주세요.');
      return;
    }
    if (!amt || amt <= 0) {
      setError('이체 금액을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        payee_id: payeeId,
        amount: amt,
        deposit_display: deposit.trim() || null,
        withdraw_display: withdraw.trim() || null,
        memo: memo.trim() || null,
        cms_code: cms.trim() || null,
        notify_phone: phone.trim() || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-[15px] font-semibold text-foreground">{editing ? '이체 건 수정' : '이체 건 추가'}</h3>
          <button onClick={onClose} className="text-foreground-secondary hover:text-foreground">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between">
              <label className={labelCls}>거래처</label>
              <button onClick={onAddPayee} className="mb-1.5 text-[12px] font-medium text-primary hover:underline">
                + 새 거래처
              </button>
            </div>
            {payees.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-[12px] text-foreground-tertiary">
                등록된 거래처가 없습니다. &lsquo;+ 새 거래처&rsquo;로 먼저 계좌를 등록해 주세요.
              </p>
            ) : (
              <select value={payeeId} onChange={(e) => setPayeeId(e.target.value)} className={inputCls}>
                {payees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.bank_name} {p.account_masked}
                  </option>
                ))}
              </select>
            )}
            {selectedPayee && (
              <p className="mt-1.5 text-[11px] text-foreground-quaternary">
                입금: {selectedPayee.bank_name} {selectedPayee.account_masked}
                {selectedPayee.account_holder ? ` · 예금주 ${selectedPayee.account_holder}` : ''}
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>이체 금액 (원)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(withComma(e.target.value))}
              inputMode="numeric"
              placeholder="0"
              className={`${inputCls} text-right font-mono text-[15px]`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                입금통장표시 <span className="font-normal text-foreground-quaternary">(선택)</span>
              </label>
              <input value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="받는분 통장 표기" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                출금통장표시 <span className="font-normal text-foreground-quaternary">(선택)</span>
              </label>
              <input value={withdraw} onChange={(e) => setWithdraw(e.target.value)} placeholder="보내는분 통장 표기" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                메모 <span className="font-normal text-foreground-quaternary">(선택)</span>
              </label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="내부 메모" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                SMS 통지번호 <span className="font-normal text-foreground-quaternary">(선택)</span>
              </label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="미입력 시 거래처 번호" className={inputCls} />
            </div>
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button onClick={onClose} className="h-9 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground-secondary hover:bg-surface-secondary">
            취소
          </button>
          <button
            onClick={() => void save()}
            disabled={saving || payees.length === 0}
            className="h-9 rounded-xl bg-primary px-5 text-[13px] font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
