'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { FeeEntry, FeeEntryCreateInput, FeeEntryFields, FeeEntryUpdateInput, FeeItem } from '@/lib/maintenance-fees/types';
import { computeAmount } from '@/lib/maintenance-fees/calc';
import { toInput, unitPriceOnItemChange, won } from '@/lib/maintenance-fees/format';
import { parseNumberInput } from '@/lib/format/number-input';
import { NumberInput } from '@/components/ui/number-input';
import { useDialogA11y } from '@/hooks/use-dialog-a11y';
import { inputCls, labelCls, primaryBtn, secondaryBtn } from './fee-modal-styles';

// 열릴 때만 렌더된다(부모가 key 로 다시 마운트) — 초기값은 useState 초기화로 잡는다
interface Props {
  month: string; // 'YYYY-MM'
  monthText: string;
  items: FeeItem[];
  usedItemIds: Set<string>; // 이 달에 이미 입력된 항목 (신규 입력 선택지에서 제외)
  editing: FeeEntry | null;
  locked: boolean; // 바깥에서 삭제 처리 중 — 저장·삭제 잠금
  onClose: () => void;
  onSubmit: (input: FeeEntryCreateInput | FeeEntryUpdateInput, id?: string) => Promise<string | null>;
  onDelete: (entry: FeeEntry) => void;
  onManageItems: () => void;
}

export function FeeEntryModal({ month, monthText, items, usedItemIds, editing, locked, onClose, onSubmit, onDelete, onManageItems }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // 삭제 처리 중에는 Escape 로도 닫히지 않게
  const closeIfIdle = useCallback(() => {
    if (!locked) onClose();
  }, [locked, onClose]);
  useDialogA11y(true, closeIfIdle, panelRef);

  const [itemId, setItemId] = useState(editing?.item_id ?? '');
  const [usage, setUsage] = useState(toInput(editing?.usage ?? null));
  const [unitPrice, setUnitPrice] = useState(toInput(editing?.unit_price ?? null));
  const [amount, setAmount] = useState(editing ? toInput(editing.amount) : '');
  const [overridden, setOverridden] = useState(editing?.amount_overridden ?? false);
  const [memo, setMemo] = useState(editing?.memo ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectable = useMemo(
    () => items.filter((it) => it.is_active && !usedItemIds.has(it.id)),
    [items, usedItemIds],
  );
  // 신규 입력 중 고른 항목이 항목 관리에서 숨겨지거나 삭제되면 선택을 무효로 본다
  const itemGone = !editing && itemId !== '' && !selectable.some((it) => it.id === itemId);
  const selectedId = itemGone ? '' : itemId;
  const item = items.find((it) => it.id === (editing ? itemId : selectedId)) ?? null;
  const computed = computeAmount(parseNumberInput(usage), parseNumberInput(unitPrice));
  // 자동 계산 중이면 금액칸은 계산값을 보여준다
  const autoMode = computed !== null && !overridden;
  const amountText = autoMode ? won(computed) : amount;
  const typedAmount = parseNumberInput(amount);
  const busy = saving || locked;

  const selectItem = (id: string) => {
    // 이전 항목은 선택 원본(itemId)으로 찾는다 — 숨겨져 선택이 무효가 된 항목의 기본 단가도 '자동으로 들어간 값'으로 보고 교체
    const prev = items.find((it) => it.id === itemId) ?? null;
    setUnitPrice(unitPriceOnItemChange(unitPrice, prev, items.find((it) => it.id === id) ?? null));
    setItemId(id);
  };

  // 사용량·단가를 지워 자동 계산이 끝나면, 방금까지 보이던 계산값을 금액칸에 남긴다
  const changeCalcInput = (setter: (v: string) => void, nextUsage: string, nextPrice: string, next: string) => {
    if (autoMode && computeAmount(parseNumberInput(nextUsage), parseNumberInput(nextPrice)) === null) setAmount(won(computed));
    setter(next);
  };

  const changeAmount = (v: string) => {
    setAmount(v);
    if (computed !== null) setOverridden(true);
  };

  const save = async () => {
    if (!editing && !selectedId) {
      setError('항목을 선택해 주세요.');
      return;
    }
    const isOverride = overridden && computed !== null;
    const body: FeeEntryFields = {
      usage: parseNumberInput(usage),
      unit_price: parseNumberInput(unitPrice),
      amount: autoMode ? null : typedAmount,
      amount_overridden: isOverride,
      memo: memo.trim() || null,
    };
    if (!autoMode && body.amount === null) {
      setError('금액을 입력하거나 사용량과 단가를 함께 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    const err = editing
      ? await onSubmit({ ...body, updated_at: editing.updated_at }, editing.id)
      : await onSubmit({ ...body, item_id: selectedId, month });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-white shadow-xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 id={titleId} className="text-[15px] font-semibold text-foreground">
            {monthText} 관리비 {editing ? '수정' : '입력'}
          </h3>
          <button onClick={closeIfIdle} className="p-0 text-foreground-secondary hover:text-foreground" aria-label="닫기">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className={labelCls}>항목</span>
              <button onClick={onManageItems} className="p-0 text-[12px] font-medium text-primary hover:underline">
                항목 관리
              </button>
            </div>
            {editing ? (
              <div className={`${inputCls} text-foreground-secondary`}>{item?.name ?? '알 수 없는 항목'}</div>
            ) : selectable.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-[12px] text-foreground-tertiary">
                선택할 항목이 없습니다. 항목 관리에서 항목을 추가해 주세요.
              </p>
            ) : (
              <select value={selectedId} onChange={(e) => selectItem(e.target.value)} aria-label="항목" className={inputCls}>
                <option value="">항목 선택</option>
                {selectable.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                    {it.unit ? ` (${it.unit})` : ''}
                  </option>
                ))}
              </select>
            )}
            {itemGone && <p className="text-[12px] text-amber-600">고른 항목이 숨겨지거나 삭제되었습니다. 다시 선택해 주세요.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>사용량{item?.unit ? ` (${item.unit})` : ''}</span>
              <NumberInput
                value={usage}
                onValueChange={(v) => changeCalcInput(setUsage, v, unitPrice, v)}
                decimals={3}
                maxInt={12}
                aria-label="사용량"
                placeholder="없으면 비워 두세요"
                className={`${inputCls} text-right font-mono`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>단가 (원)</span>
              <NumberInput
                value={unitPrice}
                onValueChange={(v) => changeCalcInput(setUnitPrice, usage, v, v)}
                decimals={2}
                maxInt={10}
                aria-label="단가 (원)"
                placeholder="0"
                className={`${inputCls} text-right font-mono`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className={labelCls}>금액 (원)</span>
              {autoMode && <span className="text-[11px] text-foreground-tertiary">사용량 × 단가 자동 계산</span>}
              {overridden && computed !== null && (
                <button onClick={() => setOverridden(false)} className="p-0 text-[12px] font-medium text-primary hover:underline">
                  자동 계산으로 되돌리기
                </button>
              )}
            </div>
            <NumberInput
              value={amountText}
              onValueChange={changeAmount}
              decimals={0}
              allowNegative
              aria-label="금액 (원)"
              placeholder="0"
              className={`${inputCls} text-right font-mono text-[15px]`}
            />
            {overridden && computed !== null && (
              <p className="text-[12px] text-amber-600">
                직접 입력 · 계산값 {won(computed)}원
                {typedAmount !== null && typedAmount !== computed
                  ? ` (차이 ${typedAmount - computed > 0 ? '+' : ''}${won(typedAmount - computed)}원)`
                  : ''}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>
              메모 <span className="font-normal text-foreground-quaternary">(선택)</span>
            </span>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} aria-label="메모" maxLength={200} placeholder="예: 11월 고지서" className={inputCls} />
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          <div>
            {editing && (
              <button
                onClick={() => onDelete(editing)}
                disabled={busy}
                className="h-9 rounded-xl px-3 text-[13px] font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                {locked ? '삭제 중...' : '삭제'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={locked} className={`${secondaryBtn} disabled:opacity-50`}>
              취소
            </button>
            <button onClick={() => void save()} disabled={busy} className={primaryBtn}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
