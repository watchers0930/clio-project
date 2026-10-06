'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { FixedExpense } from '@/lib/bulk-transfer/types';

interface Props {
  expenses: FixedExpense[];
  balance: number;
  onSaveBalance: (value: number) => Promise<void>;
  onAdd: () => void;
  onEdit: (e: FixedExpense) => void;
  onDelete: (e: FixedExpense) => void;
}

type SortKey = 'label' | 'amount';
type SortDir = 'asc' | 'desc';

const SORT_LABELS: Record<SortKey, string> = {
  label: '항목명',
  amount: '금액',
};

export function FixedExpenseList({ expenses, balance, onSaveBalance, onAdd, onEdit, onDelete }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('amount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [balanceInput, setBalanceInput] = useState('');
  const [savingBal, setSavingBal] = useState(false);

  const total = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const remaining = balance - total;

  useEffect(() => {
    setBalanceInput(balance ? balance.toLocaleString('ko-KR') : '');
  }, [balance]);

  const commitBalance = async () => {
    const v = Number(balanceInput.replace(/\D/g, ''));
    if (v === balance) return; // 변경 없음
    setSavingBal(true);
    try {
      await onSaveBalance(v);
    } catch {
      setBalanceInput(balance ? balance.toLocaleString('ko-KR') : ''); // 실패 시 원복
    } finally {
      setSavingBal(false);
    }
  };

  const sorted = useMemo(() => {
    const factor = sortDir === 'asc' ? 1 : -1;
    return [...expenses].sort((a, b) => {
      const cmp = sortKey === 'amount' ? Number(a.amount) - Number(b.amount) : a.label.localeCompare(b.label, 'ko-KR');
      if (cmp === 0) return a.label.localeCompare(b.label, 'ko-KR');
      return cmp * factor;
    });
  }, [expenses, sortKey, sortDir]);

  const changeSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'label' ? 'asc' : 'desc'); // 이름은 가나다순, 월·금액은 큰/최신 먼저
    }
  };

  const sortIcon = (col: SortKey) => {
    if (col !== sortKey) return null;
    return sortDir === 'asc' ? (
      <ArrowUp size={12} strokeWidth={2} className="inline" />
    ) : (
      <ArrowDown size={12} strokeWidth={2} className="inline" />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 액션 바 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px] text-foreground-secondary">
          매월 반복되는 고정 지출을 기록합니다. 실제 이체와는 무관한 기록용 목록입니다.
        </div>
        <div className="flex items-center gap-2">
          {/* 모바일 정렬 셀렉트 */}
          <select
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(':') as [SortKey, SortDir];
              setSortKey(k);
              setSortDir(d);
            }}
            className="h-9 rounded-xl border border-border bg-white px-3 text-[13px] text-foreground md:hidden"
          >
            <option value="amount:desc">금액 높은순</option>
            <option value="amount:asc">금액 낮은순</option>
            <option value="label:asc">항목명 가나다순</option>
            <option value="label:desc">항목명 역순</option>
          </select>
          <button
            onClick={onAdd}
            className="flex items-center justify-center gap-1.5 h-9 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground hover:bg-surface-secondary transition-colors"
          >
            <Plus size={15} strokeWidth={1.5} />
            항목 추가
          </button>
        </div>
      </div>

      {/* 잔고·지출·잔액 카드 */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-secondary px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <label className="text-[13px] font-medium text-foreground-secondary" htmlFor="fe-balance">현재 잔고</label>
          <div className="flex items-center gap-1.5">
            <input
              id="fe-balance"
              value={balanceInput}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setBalanceInput(digits ? Number(digits).toLocaleString('ko-KR') : '');
              }}
              onBlur={() => void commitBalance()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              inputMode="numeric"
              placeholder="0"
              className="w-40 rounded-lg border border-border bg-white px-3 py-1.5 text-right font-mono text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-[13px] text-foreground-secondary">원</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-foreground-secondary">고정지출 합계 ({expenses.length}건)</span>
          <span className="font-mono text-[15px] text-foreground">− {total.toLocaleString('ko-KR')}원</span>
        </div>
        <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
          <span className="text-[13px] font-semibold text-foreground">잔액 {savingBal && <span className="font-normal text-foreground-quaternary">(저장 중…)</span>}</span>
          <span className={`font-mono text-[20px] font-semibold ${remaining < 0 ? 'text-red-500' : 'text-foreground'}`}>
            {remaining.toLocaleString('ko-KR')}원
          </span>
        </div>
      </div>

      {/* 모바일: 카드 리스트 */}
      <div className="flex flex-col md:hidden" style={{ gap: '10px' }}>
        {sorted.length === 0 ? (
          <div className="rounded-xl border border-border bg-white py-12 text-center text-[13px] text-foreground-tertiary">
            등록된 고정지출이 없습니다. &lsquo;항목 추가&rsquo; 버튼을 눌러 등록해 주세요.
          </div>
        ) : (
          sorted.map((e) => (
            <div key={e.id} className="rounded-xl border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-[14px] font-medium text-foreground">{e.label}</p>
                  {e.memo && <p className="mt-0.5 text-[12px] text-foreground-secondary">{e.memo}</p>}
                </div>
                <div className="flex flex-shrink-0 items-center gap-4">
                  <button onClick={() => onEdit(e)} className="text-foreground-secondary hover:text-primary transition-colors" title="수정">
                    <Pencil size={16} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => onDelete(e)} className="text-foreground-secondary hover:text-red-500 transition-colors" title="삭제">
                    <Trash2 size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-[11px] text-foreground-quaternary">금액</p>
                <p className="mt-0.5 font-mono text-[16px] font-medium text-foreground">{Number(e.amount).toLocaleString('ko-KR')}원</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 데스크탑: 테이블 (헤더 클릭 정렬) */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full table-fixed text-[13px]">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[20%]" />
            <col className="w-[34%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr className="bg-surface-secondary">
              <SortableTh label="항목명" col="label" sortKey={sortKey} onClick={changeSort} icon={sortIcon('label')} />
              <SortableTh label="금액" col="amount" sortKey={sortKey} onClick={changeSort} align="right" icon={sortIcon('amount')} />
              <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">메모</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground-secondary">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-14 text-center text-[13px] text-foreground-tertiary">
                  등록된 고정지출이 없습니다. 항목 추가 버튼을 눌러 등록해 주세요.
                </td>
              </tr>
            ) : (
              sorted.map((e) => (
                <tr key={e.id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground truncate">{e.label}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{Number(e.amount).toLocaleString('ko-KR')}</td>
                  <td className="px-4 py-3 text-foreground-secondary truncate">{e.memo || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => onEdit(e)} className="text-foreground-secondary hover:text-primary transition-colors" title="수정">
                        <Pencil size={14} strokeWidth={1.5} />
                      </button>
                      <button onClick={() => onDelete(e)} className="text-foreground-secondary hover:text-red-500 transition-colors" title="삭제">
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-surface-secondary/60">
                <td className="px-4 py-3 text-left font-semibold text-foreground">합계</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{total.toLocaleString('ko-KR')}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-[11px] text-foreground-quaternary">
        정렬: {SORT_LABELS[sortKey]} {sortDir === 'asc' ? '오름차순' : '내림차순'} · 총 {expenses.length}건
      </p>
    </div>
  );
}

function SortableTh({
  label,
  col,
  sortKey,
  onClick,
  icon,
  align = 'left',
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  onClick: (k: SortKey) => void;
  icon: React.ReactNode;
  align?: 'left' | 'right';
}) {
  const active = col === sortKey;
  return (
    <th className={`px-4 py-3 font-semibold text-foreground-secondary ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        onClick={() => onClick(col)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${active ? 'text-foreground' : ''}`}
      >
        {label}
        {icon}
      </button>
    </th>
  );
}
