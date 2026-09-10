'use client';

import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Download, Check } from 'lucide-react';
import { TRANSFER_STATUS_LABELS, type TransferItem } from '@/lib/bulk-transfer/types';

interface Props {
  items: TransferItem[];
  onAdd: () => void;
  onEdit: (it: TransferItem) => void;
  onDelete: (it: TransferItem) => void;
  onToggleDone: (it: TransferItem) => void;
  onExport: (ids: string[]) => Promise<void>;
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-surface-secondary text-foreground-tertiary',
  exported: 'bg-primary/10 text-primary',
  done: 'bg-emerald-50 text-emerald-600',
};

export function TransferList({ items, onAdd, onEdit, onDelete, onToggleDone, onExport }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const selectableIds = useMemo(() => items.filter((it) => it.payee_id).map((it) => it.id), [items]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  };

  const selectedItems = items.filter((it) => selected.has(it.id));
  const selectedTotal = selectedItems.reduce((s, it) => s + Number(it.amount), 0);

  const handleExport = async () => {
    if (selected.size === 0) return;
    setExporting(true);
    try {
      await onExport([...selected]);
      setSelected(new Set());
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 액션 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-foreground-secondary">
          {selected.size > 0 ? (
            <span>
              <b className="text-foreground">{selected.size}건</b> 선택 · 합계{' '}
              <b className="text-foreground font-mono">{selectedTotal.toLocaleString('ko-KR')}원</b>
            </span>
          ) : (
            <span>이체할 건을 선택한 뒤 하나은행 파일을 생성하세요.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 h-9 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground hover:bg-surface-secondary transition-colors"
          >
            <Plus size={15} strokeWidth={1.5} />
            이체 건 추가
          </button>
          <button
            onClick={() => void handleExport()}
            disabled={selected.size === 0 || exporting}
            className="flex items-center gap-1.5 h-9 rounded-xl bg-primary px-4 text-[13px] font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
          >
            <Download size={15} strokeWidth={1.5} />
            {exporting ? '생성 중...' : '하나은행 파일 생성'}
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full table-fixed text-[13px]">
          <colgroup>
            <col className="w-[44px]" />
            <col className="w-[20%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr className="bg-surface-secondary">
              <th className="px-3 py-3 text-center">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-primary align-middle" />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">거래처</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">입금계좌</th>
              <th className="px-4 py-3 text-right font-semibold text-foreground-secondary">이체금액</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">적요</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground-secondary">상태</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground-secondary">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-[13px] text-foreground-tertiary">
                  등록된 이체 건이 없습니다. 이체 건 추가 버튼을 눌러 등록해 주세요.
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const missing = !it.payee_id;
                return (
                  <tr key={it.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(it.id)}
                        onChange={() => toggle(it.id)}
                        disabled={missing}
                        className="h-4 w-4 accent-primary align-middle disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground truncate">{it.payee_name}</td>
                    <td className="px-4 py-3 text-foreground-secondary truncate">
                      {missing ? (
                        <span className="text-red-500">거래처 삭제됨</span>
                      ) : (
                        <>
                          {it.bank_name} <span className="font-mono text-foreground-tertiary">{it.account_masked}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{Number(it.amount).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-3 text-foreground-secondary truncate">{it.memo || it.deposit_display || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLE[it.status]}`}>
                        {TRANSFER_STATUS_LABELS[it.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onToggleDone(it)}
                          className={`transition-colors ${it.status === 'done' ? 'text-emerald-600' : 'text-foreground-quaternary hover:text-emerald-600'}`}
                          title={it.status === 'done' ? '완료 해제' : '이체완료 표시'}
                        >
                          <Check size={15} strokeWidth={2} />
                        </button>
                        <button onClick={() => onEdit(it)} className="text-foreground-secondary hover:text-primary transition-colors" title="수정">
                          <Pencil size={14} strokeWidth={1.5} />
                        </button>
                        <button onClick={() => onDelete(it)} className="text-foreground-secondary hover:text-red-500 transition-colors" title="삭제">
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-foreground-quaternary">
        총 {items.length}건 · 생성된 파일은 하나은행 기업뱅킹 &lsquo;대량이체 → 파일 가져오기&rsquo;에서 업로드하세요. 실제 이체는 은행에서 실행됩니다.
      </p>
    </div>
  );
}
