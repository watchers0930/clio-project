'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BANK_OPTIONS } from '@/lib/bulk-transfer/bank-codes';
import type { TransferPayee, TransferPayeeInput } from '@/lib/bulk-transfer/types';

interface Props {
  open: boolean;
  editing: TransferPayee | null;
  onClose: () => void;
  onSubmit: (input: TransferPayeeInput) => Promise<void>;
}

const inputCls =
  'w-full rounded-xl border border-border bg-surface-secondary px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary';
const labelCls = 'mb-1.5 block text-[12px] font-medium text-foreground-secondary';

export function PayeeModal({ open, editing, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [bankCode, setBankCode] = useState('081');
  const [account, setAccount] = useState('');
  const [holder, setHolder] = useState('');
  const [phone, setPhone] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '');
      setBankCode(editing?.bank_code ?? '081');
      setAccount('');
      setHolder(editing?.account_holder ?? '');
      setPhone(editing?.notify_phone ?? '');
      setMemo(editing?.memo ?? '');
      setError('');
    }
  }, [open, editing]);

  if (!open) return null;

  const save = async () => {
    if (!name.trim()) {
      setError('거래처명은 필수입니다.');
      return;
    }
    if (!editing && !account.replace(/[\s-]/g, '')) {
      setError('계좌번호를 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        name: name.trim(),
        bank_code: bankCode,
        account: account.replace(/[\s-]/g, ''),
        account_holder: holder.trim() || null,
        notify_phone: phone.trim() || null,
        memo: memo.trim() || null,
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
      <div className="w-full max-w-md rounded-2xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-[15px] font-semibold text-foreground">{editing ? '거래처 수정' : '거래처 추가'}</h3>
          <button onClick={onClose} className="text-foreground-secondary hover:text-foreground">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-3">
          <div>
            <label className={labelCls}>거래처명</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예) OO건설, 김철수" className={inputCls} />
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div>
              <label className={labelCls}>은행</label>
              <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className={inputCls}>
                {BANK_OPTIONS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                계좌번호{' '}
                {editing && <span className="font-normal text-foreground-quaternary">(변경 시에만 입력)</span>}
              </label>
              <input
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                inputMode="numeric"
                placeholder={editing ? `현재: ${editing.account_masked}` : '하이픈 없이 숫자만'}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                예금주 <span className="font-normal text-foreground-quaternary">(선택)</span>
              </label>
              <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="예금주명" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                SMS 통지번호 <span className="font-normal text-foreground-quaternary">(선택)</span>
              </label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="01012345678" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              메모 <span className="font-normal text-foreground-quaternary">(선택)</span>
            </label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="내부 메모" className={inputCls} />
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <p className="text-[11px] text-foreground-quaternary">계좌번호는 AES-256 암호화되어 저장됩니다.</p>
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
