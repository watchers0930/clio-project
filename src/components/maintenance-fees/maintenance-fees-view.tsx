'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useMaintenanceFees } from '@/hooks/use-maintenance-fees';
import { buildMonthlyView, buildYearlyView } from '@/lib/maintenance-fees/calc';
import type { FeeEntry, FeeItem } from '@/lib/maintenance-fees/types';
import { MonthlyFeeTable } from './monthly-fee-table';
import { YearlyFeeTable } from './yearly-fee-table';
import { FeeEntryModal } from './fee-entry-modal';
import { FeeItemManager } from './fee-item-manager';

type Tab = 'monthly' | 'yearly';

const navBtn = 'flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-foreground-secondary hover:bg-surface-secondary';

export function MaintenanceFeesView() {
  const now = new Date();
  const [tab, setTab] = useState<Tab>('monthly');
  const [year, setYear] = useState(now.getFullYear());
  const [monthNo, setMonthNo] = useState(now.getMonth() + 1);
  const [entryModal, setEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FeeEntry | null>(null);
  const [itemManager, setItemManager] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(false); // 기록 삭제 처리 중 — 입력창 잠금
  const toast = useToast();
  const { confirmState, openConfirm, closeConfirm } = useConfirmDialog();
  const { items, entries, ready, forbidden, error, saveItem, deleteItem, saveEntry, deleteEntry } = useMaintenanceFees(year);

  const month = `${year}-${String(monthNo).padStart(2, '0')}`;
  const monthText = `${year}년 ${monthNo}월`;
  const monthlyView = useMemo(() => buildMonthlyView(items, entries, month), [items, entries, month]);
  const yearlyView = useMemo(() => buildYearlyView(items, entries, year), [items, entries, year]);
  const usedItemIds = useMemo(() => new Set(monthlyView.rows.map((r) => r.item.id)), [monthlyView]);

  // 월 이동이 연도를 넘으면 연도도 바뀌어 hook 이 그 연도를 다시 불러온다
  const moveMonth = (delta: number) => {
    const idx = year * 12 + (monthNo - 1) + delta;
    setYear(Math.floor(idx / 12));
    setMonthNo((idx % 12) + 1);
  };
  const movePeriod = (delta: number) => (tab === 'monthly' ? moveMonth(delta) : setYear((y) => y + delta));

  const openEntry = (entry: FeeEntry | null) => {
    setEditingEntry(entry);
    setEntryModal(true);
  };

  const confirmDeleteEntry = (entry: FeeEntry) =>
    openConfirm('관리비 기록 삭제', `${monthText} 기록을 삭제합니다. 되돌릴 수 없습니다.`, async () => {
      closeConfirm();
      setDeletingEntry(true);
      const err = await deleteEntry(entry.id);
      setDeletingEntry(false);
      if (err) return toast.error(err);
      setEntryModal(false);
      toast.success('삭제했습니다.');
    });

  const confirmDeleteItem = (item: FeeItem) =>
    openConfirm('관리비 항목 삭제', `'${item.name}' 항목을 삭제합니다. 기록이 있는 항목은 숨기기만 할 수 있습니다.`, async () => {
      closeConfirm();
      const err = await deleteItem(item.id);
      if (err) return toast.error(err);
      toast.success('항목을 삭제했습니다.');
    });

  if (forbidden) {
    return <div className="py-20 text-center text-[14px] text-foreground-secondary">권한이 없습니다. 시스템 관리자만 볼 수 있습니다.</div>;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[16px] font-semibold text-foreground">관리비</h2>
          <p className="text-[13px] text-foreground-secondary">
            관리비 항목별 사용량·단가·금액을 월별로 입력하고 연도별로 확인합니다. 금액은 사용량 × 단가로 자동 계산되며 고지서 금액으로 고칠 수 있습니다.
          </p>
        </div>

        <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-1">
            {(['monthly', 'yearly'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  tab === t ? 'border-primary text-primary' : 'border-transparent text-foreground-secondary hover:text-foreground'
                }`}
              >
                {t === 'monthly' ? '월별' : '연도별'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <button onClick={() => movePeriod(-1)} className={navBtn} aria-label="이전">
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <span className="min-w-[110px] text-center text-[14px] font-semibold text-foreground">{tab === 'monthly' ? monthText : `${year}년`}</span>
            <button onClick={() => movePeriod(1)} className={navBtn} aria-label="다음">
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
            <button onClick={() => setItemManager(true)} className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground hover:bg-surface-secondary">
              <Settings2 size={15} strokeWidth={1.5} />
              항목 관리
            </button>
            {tab === 'monthly' && (
              <button onClick={() => openEntry(null)} disabled={!ready} className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-[13px] font-medium text-white hover:bg-primary-dark disabled:opacity-50">
                <Plus size={15} strokeWidth={1.5} />
                입력
              </button>
            )}
          </div>
        </div>

        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</p>}

        {!ready ? (
          error ? null : (
            <div className="flex items-center justify-center py-20">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )
        ) : tab === 'monthly' ? (
          <MonthlyFeeTable view={monthlyView} monthText={monthText} onRowClick={(row) => openEntry(row.entry)} />
        ) : (
          <YearlyFeeTable view={yearlyView} year={year} />
        )}
      </div>

      {entryModal && (
        <FeeEntryModal
          key={editingEntry?.id ?? `new-${month}`}
          month={month}
          monthText={monthText}
          items={items}
          usedItemIds={usedItemIds}
          editing={editingEntry}
          locked={deletingEntry}
          onClose={() => setEntryModal(false)}
          onSubmit={async (input, id) => {
            const err = await saveEntry(input, id);
            if (!err) toast.success('저장했습니다.');
            return err;
          }}
          onDelete={confirmDeleteEntry}
          onManageItems={() => setItemManager(true)}
        />
      )}
      {itemManager && <FeeItemManager items={items} onClose={() => setItemManager(false)} onSave={saveItem} onDelete={confirmDeleteItem} />}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel ?? '삭제'}
        variant={confirmState.variant ?? 'danger'}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </>
  );
}
