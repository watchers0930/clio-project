'use client';

import { useId, useRef, useState } from 'react';
import { Eye, EyeOff, Pencil, Trash2, X } from 'lucide-react';
import type { FeeItem, FeeItemInput } from '@/lib/maintenance-fees/types';
import { toInput } from '@/lib/maintenance-fees/format';
import { parseNumberInput } from '@/lib/format/number-input';
import { NumberInput } from '@/components/ui/number-input';
import { useDialogA11y } from '@/hooks/use-dialog-a11y';
import { inputCls, labelCls, primaryBtn, secondaryBtn } from './fee-modal-styles';

// 열릴 때만 렌더된다 — 폼은 빈 상태로 시작
interface Props {
  items: FeeItem[];
  onClose: () => void;
  onSave: (input: FeeItemInput, id?: string) => Promise<string | null>;
  onDelete: (item: FeeItem) => void;
}

function toItemInput(it: FeeItem, over: Partial<FeeItemInput> = {}): FeeItemInput {
  return { name: it.name, unit: it.unit, default_unit_price: it.default_unit_price, sort_order: it.sort_order, is_active: it.is_active, ...over };
}

export function FeeItemManager({ items, onClose, onSave, onDelete }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogA11y(true, onClose, panelRef);
  const [editing, setEditing] = useState<FeeItem | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [order, setOrder] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState(''); // 숨기기 등 목록 동작 오류(폼 오류와 따로)
  // 수정 중이던 항목이 삭제되면 새 항목 입력으로 본다(없는 id 로 PATCH → 404 방지)
  const editingLive = editing ? (items.find((it) => it.id === editing.id) ?? null) : null;

  const resetForm = (it: FeeItem | null) => {
    setEditing(it);
    setName(it?.name ?? '');
    setUnit(it?.unit ?? '');
    setPrice(toInput(it?.default_unit_price ?? null));
    setOrder(it ? String(it.sort_order) : '');
    setError('');
  };

  const submit = async () => {
    if (!name.trim()) {
      setError('항목명을 입력해 주세요.');
      return;
    }
    const input: FeeItemInput = {
      name: name.trim(),
      unit: unit.trim() || null,
      default_unit_price: parseNumberInput(price),
      sort_order: order ? Number(order) : 0,
      // 폼을 연 뒤 숨김을 바꿨을 수 있어 최신 목록의 값을 쓴다
      is_active: editingLive?.is_active ?? true,
    };
    setSaving(true);
    setListError('');
    const err = await onSave(input, editingLive?.id);
    setSaving(false);
    if (err) setError(err);
    else resetForm(null);
  };

  const toggleActive = async (it: FeeItem) => {
    setListError('');
    const err = await onSave(toItemInput(it, { is_active: !it.is_active }), it.id);
    if (err) setListError(err);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-white shadow-xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 id={titleId} className="text-[15px] font-semibold text-foreground">관리비 항목 관리</h3>
          <button onClick={onClose} className="p-0 text-foreground-secondary hover:text-foreground" aria-label="닫기">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* 추가·수정 폼 */}
        <div className="flex flex-col gap-3 border-b border-border px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>항목명</span>
              <input value={name} onChange={(e) => setName(e.target.value)} aria-label="항목명" maxLength={50} placeholder="예: 전기, 수도, 일반관리비" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>
                단위 <span className="font-normal text-foreground-quaternary">(선택)</span>
              </span>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="단위" maxLength={20} placeholder="예: kWh, ㎥" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>
                기본 단가 (원) <span className="font-normal text-foreground-quaternary">(선택)</span>
              </span>
              <NumberInput
                value={price}
                onValueChange={setPrice}
                decimals={2}
                maxInt={10}
                aria-label="기본 단가 (원)"
                className={`${inputCls} text-right font-mono`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={labelCls}>표시 순서</span>
              <input
                value={order}
                onChange={(e) => setOrder(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                aria-label="표시 순서"
                placeholder="0"
                className={`${inputCls} text-right font-mono`}
              />
            </div>
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            {editingLive && (
              <button onClick={() => resetForm(null)} className={secondaryBtn}>
                새 항목으로
              </button>
            )}
            <button onClick={() => void submit()} disabled={saving} className={primaryBtn}>
              {saving ? '저장 중...' : editingLive ? '수정 저장' : '항목 추가'}
            </button>
          </div>
        </div>

        {/* 항목 목록 */}
        <div className="flex flex-col gap-2 overflow-y-auto px-6 py-4">
          {listError && <p className="text-[12px] text-red-500">{listError}</p>}
          {items.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-foreground-tertiary">등록된 항목이 없습니다.</p>
          ) : (
            items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className={`text-[13px] font-medium ${it.is_active ? 'text-foreground' : 'text-foreground-quaternary'}`}>
                    {it.name}
                    {!it.is_active && ' (숨김)'}
                  </span>
                  <span className="text-[11px] text-foreground-tertiary">
                    {[it.unit, it.default_unit_price !== null ? `기본 단가 ${toInput(it.default_unit_price)}원` : null, `순서 ${it.sort_order}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-4">
                  <button onClick={() => resetForm(it)} className="p-0 text-foreground-secondary hover:text-primary" title="수정">
                    <Pencil size={16} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => void toggleActive(it)} className="p-0 text-foreground-secondary hover:text-primary" title={it.is_active ? '숨기기' : '다시 보이기'}>
                    {it.is_active ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                  </button>
                  <button onClick={() => onDelete(it)} className="p-0 text-foreground-secondary hover:text-red-500" title="삭제">
                    <Trash2 size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
