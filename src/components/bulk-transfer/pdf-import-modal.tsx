'use client';

import { useRef, useState } from 'react';
import { X, FileUp, Sparkles } from 'lucide-react';
import type { AccountExtractResult, ExtractedAccount } from '@/lib/bulk-transfer/extract-accounts';
import type { TransferItemInput, TransferPayee, TransferPayeeInput } from '@/lib/bulk-transfer/types';

interface Props {
  open: boolean;
  onClose: () => void;
  createPayee: (input: TransferPayeeInput) => Promise<TransferPayee>;
  createItem: (input: TransferItemInput) => Promise<unknown>;
  onDone: (msg: string) => void;
}

const inputCls =
  'w-full rounded-xl border border-border bg-surface-secondary px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary';
const labelCls = 'mb-1.5 block text-[12px] font-medium text-foreground-secondary';

function withComma(v: string): string {
  const d = v.replace(/\D/g, '');
  return d ? Number(d).toLocaleString('ko-KR') : '';
}

export function PdfImportModal({ open, onClose, createPayee, createItem, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 추출 결과 편집 상태
  const [accounts, setAccounts] = useState<ExtractedAccount[]>([]);
  const [accIdx, setAccIdx] = useState(0);
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [holder, setHolder] = useState('');

  const reset = () => {
    setFileName('');
    setAnalyzing(false);
    setSaving(false);
    setError('');
    setAccounts([]);
    setAccIdx(0);
    setPayeeName('');
    setAmount('');
    setMemo('');
    setHolder('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose();
  };

  if (!open) return null;

  const analyze = async (file: File) => {
    setFileName(file.name);
    setAnalyzing(true);
    setError('');
    setAccounts([]);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/bulk-transfer/extract', { method: 'POST', body: fd });
      const json = (await res.json().catch(() => ({}))) as { data?: AccountExtractResult; error?: string };
      if (!res.ok) {
        setError(json.error ?? '분석에 실패했습니다.');
        return;
      }
      const data = json.data;
      if (!data || data.accounts.length === 0) {
        setError(json.error ?? '문서에서 입금 계좌를 찾지 못했습니다.');
        return;
      }
      setAccounts(data.accounts);
      setAccIdx(0);
      setPayeeName(data.payee_name || data.title || '');
      setAmount(data.amount ? data.amount.toLocaleString('ko-KR') : '');
      setMemo(data.memo || '');
      setHolder(data.holder || '');
    } catch {
      setError('분석 중 오류가 발생했습니다.');
    } finally {
      setAnalyzing(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void analyze(f);
  };

  const register = async () => {
    const acc = accounts[accIdx];
    const amt = Number(amount.replace(/\D/g, ''));
    if (!acc) {
      setError('계좌를 선택해 주세요.');
      return;
    }
    if (!payeeName.trim()) {
      setError('거래처명을 입력해 주세요.');
      return;
    }
    if (!amt || amt <= 0) {
      setError('금액을 확인해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payee = await createPayee({
        name: payeeName.trim(),
        bank_code: acc.bank_code,
        account: acc.account,
        account_holder: holder.trim() || null,
        notify_phone: null,
        memo: '문서 추출 등록',
      });
      await createItem({
        payee_id: payee.id,
        amount: amt,
        deposit_display: null,
        withdraw_display: null,
        memo: memo.trim() || null,
        cms_code: null,
        notify_phone: null,
        source_type: 'contract',
        source_id: null,
      });
      onDone('문서에서 이체 건을 등록했습니다.');
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const hasResult = accounts.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-[15px] font-semibold text-foreground">PDF에서 불러오기</h3>
          <button onClick={close} className="text-foreground-secondary hover:text-foreground">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* 파일 선택 */}
          <div>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" onChange={onPick} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={analyzing}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-secondary px-4 py-4 text-[13px] font-medium text-foreground-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
            >
              <FileUp size={16} strokeWidth={1.5} />
              {fileName || '납부서·청구서·세금계산서 PDF 선택'}
            </button>
            <p className="mt-1.5 text-[11px] text-foreground-quaternary">
              문서에서 은행·계좌·금액을 AI가 추출합니다. 스캔본도 인식(OCR)합니다.
            </p>
          </div>

          {analyzing && (
            <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-foreground-secondary">
              <Sparkles size={16} className="animate-pulse text-primary" />
              문서 분석 중...
            </div>
          )}

          {/* 추출 결과 검토 */}
          {hasResult && !analyzing && (
            <div className="flex flex-col gap-4 border-t border-border pt-4">
              <div>
                <label className={labelCls}>입금 계좌 (문서에서 추출한 전체 — 선택)</label>
                <select value={accIdx} onChange={(e) => setAccIdx(Number(e.target.value))} className={inputCls}>
                  {accounts.map((a, i) => (
                    <option key={`${a.bank_code}-${a.account}`} value={i}>
                      {a.bank_name} · {a.account_display}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-foreground-quaternary">
                  {accounts.length}개 계좌 추출됨 · 하나은행이 맨 위에 정렬됩니다.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>거래처명</label>
                  <input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>금액 (원)</label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(withComma(e.target.value))}
                    inputMode="numeric"
                    className={`${inputCls} text-right font-mono`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    적요 <span className="font-normal text-foreground-quaternary">(선택)</span>
                  </label>
                  <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="세목·납부번호 등" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>
                    예금주 <span className="font-normal text-foreground-quaternary">(선택)</span>
                  </label>
                  <input value={holder} onChange={(e) => setHolder(e.target.value)} className={inputCls} />
                </div>
              </div>

              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                ⚠️ 계좌번호·금액이 문서와 일치하는지 반드시 확인 후 등록하세요. 잘못된 계좌는 오이체로 이어집니다.
              </p>
            </div>
          )}

          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button onClick={close} className="h-9 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground-secondary hover:bg-surface-secondary">
            취소
          </button>
          <button
            onClick={() => void register()}
            disabled={!hasResult || saving || analyzing}
            className="h-9 rounded-xl bg-primary px-5 text-[13px] font-medium text-white hover:bg-primary-dark disabled:opacity-40"
          >
            {saving ? '등록 중...' : '이체 건으로 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
