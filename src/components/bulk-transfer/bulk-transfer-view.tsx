'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useBulkTransfer } from '@/hooks/use-bulk-transfer';
import type {
  FixedExpense,
  FixedExpenseInput,
  MonthlyExpense,
  MonthlyExpenseInput,
  TransferItem,
  TransferItemInput,
  TransferPayee,
  TransferPayeeInput,
} from '@/lib/bulk-transfer/types';
import { TransferList } from './transfer-list';
import { PayeeManager } from './payee-manager';
import { PayeeModal } from './payee-modal';
import { TransferItemModal } from './transfer-item-modal';
import { PdfImportModal } from './pdf-import-modal';
import { FixedExpenseList } from './fixed-expense-list';
import { FixedExpenseModal } from './fixed-expense-modal';
import { MonthlyExpenseList } from './monthly-expense-list';
import { MonthlyExpenseModal } from './monthly-expense-modal';
import { ExpenseComparison } from './expense-comparison';
import { currentMonth } from '@/lib/bulk-transfer/month-utils';

type Tab = 'items' | 'payees' | 'fixed' | 'monthly' | 'compare';

export function BulkTransferView() {
  const toast = useToast();
  const {
    payees,
    items,
    loading,
    createPayee,
    updatePayee,
    deletePayee,
    createItem,
    updateItem,
    setItemStatus,
    deleteItem,
    fixedExpenses,
    monthlyExpenses,
    balance,
    saveBalance,
    createExpense,
    updateExpense,
    deleteExpense,
    createMonthly,
    updateMonthly,
    deleteMonthly,
    exportItems,
  } = useBulkTransfer();

  const [tab, setTab] = useState<Tab>('items');
  const [payeeModal, setPayeeModal] = useState(false);
  const [editingPayee, setEditingPayee] = useState<TransferPayee | null>(null);
  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TransferItem | null>(null);
  const [pdfModal, setPdfModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);
  const [monthlyModal, setMonthlyModal] = useState(false);
  const [editingMonthly, setEditingMonthly] = useState<MonthlyExpense | null>(null);
  const [monthlyDefaultMonth, setMonthlyDefaultMonth] = useState(currentMonth());

  // --- 거래처 핸들러 ---
  const openAddPayee = () => {
    setEditingPayee(null);
    setPayeeModal(true);
  };
  const openEditPayee = (p: TransferPayee) => {
    setEditingPayee(p);
    setPayeeModal(true);
  };
  const submitPayee = async (input: TransferPayeeInput) => {
    if (editingPayee) {
      await updatePayee(editingPayee.id, input);
      toast.success('거래처가 수정되었습니다.');
    } else {
      await createPayee(input);
      toast.success('거래처가 추가되었습니다.');
    }
  };
  const handleDeletePayee = async (p: TransferPayee) => {
    if (!window.confirm(`'${p.name}' 거래처를 삭제하시겠습니까?`)) return;
    try {
      await deletePayee(p.id);
      toast.success('삭제되었습니다.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  };

  // --- 이체 건 핸들러 ---
  const openAddItem = () => {
    setEditingItem(null);
    setItemModal(true);
  };
  const openEditItem = (it: TransferItem) => {
    setEditingItem(it);
    setItemModal(true);
  };
  const submitItem = async (input: TransferItemInput) => {
    if (editingItem) {
      await updateItem(editingItem.id, input);
      toast.success('이체 건이 수정되었습니다.');
    } else {
      await createItem(input);
      toast.success('이체 건이 추가되었습니다.');
    }
  };
  const handleDeleteItem = async (it: TransferItem) => {
    if (!window.confirm(`'${it.payee_name}' 이체 건을 삭제하시겠습니까?`)) return;
    try {
      await deleteItem(it.id);
      toast.success('삭제되었습니다.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  };
  const handleToggleDone = async (it: TransferItem) => {
    try {
      await setItemStatus(it.id, it.status === 'done' ? 'pending' : 'done');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '상태 변경에 실패했습니다.');
    }
  };
  const handleExport = async (ids: string[]) => {
    try {
      await exportItems(ids);
      toast.success('하나은행 대량이체 파일을 생성했습니다.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '파일 생성에 실패했습니다.');
    }
  };

  // --- 월 고정지출 핸들러 ---
  const openAddExpense = () => {
    setEditingExpense(null);
    setExpenseModal(true);
  };
  const openEditExpense = (e: FixedExpense) => {
    setEditingExpense(e);
    setExpenseModal(true);
  };
  const submitExpense = async (input: FixedExpenseInput) => {
    if (editingExpense) {
      await updateExpense(editingExpense.id, input);
      toast.success('고정지출이 수정되었습니다.');
    } else {
      await createExpense(input);
      toast.success('고정지출이 추가되었습니다.');
    }
  };
  const handleDeleteExpense = async (e: FixedExpense) => {
    if (!window.confirm(`'${e.label}' 항목을 삭제하시겠습니까?`)) return;
    try {
      await deleteExpense(e.id);
      toast.success('삭제되었습니다.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    }
  };
  const handleSaveBalance = async (value: number) => {
    try {
      await saveBalance(value);
      toast.success('잔고가 저장되었습니다.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '잔고 저장에 실패했습니다.');
      throw err; // 목록에서 입력값 원복
    }
  };

  // --- 월지출 핸들러 ---
  const openAddMonthly = (month: string) => {
    setEditingMonthly(null);
    setMonthlyDefaultMonth(month);
    setMonthlyModal(true);
  };
  const openEditMonthly = (e: MonthlyExpense) => {
    setEditingMonthly(e);
    setMonthlyModal(true);
  };
  const submitMonthly = async (input: MonthlyExpenseInput) => {
    if (editingMonthly) {
      await updateMonthly(editingMonthly.id, input);
      toast.success('월지출이 수정되었습니다.');
    } else {
      await createMonthly(input);
      toast.success('월지출이 추가되었습니다.');
    }
  };
  const handleDeleteMonthly = async (e: MonthlyExpense) => {
    if (!window.confirm(`'${e.label}' 항목을 삭제하시겠습니까?`)) return;
    try {
      await deleteMonthly(e.id);
      toast.success('삭제되었습니다.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    }
  };

  // 아이템 모달에서 "새 거래처" → 거래처 모달로 전환
  const addPayeeFromItem = () => {
    setItemModal(false);
    setEditingPayee(null);
    setPayeeModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-[16px] font-semibold text-foreground">대량이체</h2>
          <p className="mt-1.5 text-[13px] text-foreground-secondary">
            거래처 지급 건을 모아 하나은행 대량이체 파일(.xls)을 생성합니다. 실제 이체는 하나은행 사이트에서 실행하세요.
          </p>
        </div>

        {/* 탭 */}
        <div className="flex items-center gap-1 border-b border-border">
          <TabButton active={tab === 'items'} onClick={() => setTab('items')} label={`이체 목록 (${items.length})`} />
          <TabButton active={tab === 'payees'} onClick={() => setTab('payees')} label={`거래처 (${payees.length})`} />
          <TabButton active={tab === 'fixed'} onClick={() => setTab('fixed')} label={`고정지출 (${fixedExpenses.length})`} />
          <TabButton active={tab === 'monthly'} onClick={() => setTab('monthly')} label={`월지출 (${monthlyExpenses.length})`} />
          <TabButton active={tab === 'compare'} onClick={() => setTab('compare')} label="비교" />
        </div>

        {tab === 'items' && (
          <TransferList
            items={items}
            onAdd={openAddItem}
            onImport={() => setPdfModal(true)}
            onEdit={openEditItem}
            onDelete={(it) => void handleDeleteItem(it)}
            onToggleDone={(it) => void handleToggleDone(it)}
            onExport={handleExport}
          />
        )}
        {tab === 'payees' && (
          <PayeeManager payees={payees} onAdd={openAddPayee} onEdit={openEditPayee} onDelete={(p) => void handleDeletePayee(p)} />
        )}
        {tab === 'fixed' && (
          <FixedExpenseList
            expenses={fixedExpenses}
            balance={balance}
            onSaveBalance={handleSaveBalance}
            onAdd={openAddExpense}
            onEdit={openEditExpense}
            onDelete={(e) => void handleDeleteExpense(e)}
          />
        )}
        {tab === 'monthly' && (
          <MonthlyExpenseList
            expenses={monthlyExpenses}
            onAdd={openAddMonthly}
            onEdit={openEditMonthly}
            onDelete={(e) => void handleDeleteMonthly(e)}
          />
        )}
        {tab === 'compare' && (
          <ExpenseComparison fixedExpenses={fixedExpenses} monthlyExpenses={monthlyExpenses} />
        )}
      </div>

      <PdfImportModal
        open={pdfModal}
        onClose={() => setPdfModal(false)}
        createPayee={createPayee}
        createItem={createItem}
        onDone={(msg) => toast.success(msg)}
      />

      <PayeeModal open={payeeModal} editing={editingPayee} onClose={() => setPayeeModal(false)} onSubmit={submitPayee} />
      <TransferItemModal
        open={itemModal}
        editing={editingItem}
        payees={payees}
        onClose={() => setItemModal(false)}
        onAddPayee={addPayeeFromItem}
        onSubmit={submitItem}
      />
      <FixedExpenseModal
        open={expenseModal}
        editing={editingExpense}
        onClose={() => setExpenseModal(false)}
        onSubmit={submitExpense}
      />
      <MonthlyExpenseModal
        open={monthlyModal}
        editing={editingMonthly}
        defaultMonth={monthlyDefaultMonth}
        onClose={() => setMonthlyModal(false)}
        onSubmit={submitMonthly}
      />
    </>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${
        active ? 'border-primary text-primary' : 'border-transparent text-foreground-secondary hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}
