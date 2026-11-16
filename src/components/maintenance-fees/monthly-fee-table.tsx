'use client';

import type { MonthlyRow, MonthlyView } from '@/lib/maintenance-fees/types';
import { won } from '@/lib/maintenance-fees/format';

interface Props {
  view: MonthlyView;
  monthText: string; // 예: '2026년 11월'
  onRowClick: (row: MonthlyRow) => void;
}

function Diff({ value }: { value: number | null }) {
  if (value === null) return <span className="text-foreground-quaternary">—</span>;
  if (value === 0) return <span className="text-foreground-secondary">0</span>;
  return (
    <span className={value > 0 ? 'text-red-500' : 'text-blue-600'}>
      {value > 0 ? '+' : ''}
      {won(value)}
    </span>
  );
}

export function MonthlyFeeTable({ view, monthText, onRowClick }: Props) {
  const totalDiff = view.prevTotal === null ? null : view.total - view.prevTotal;

  return (
    <div className="flex flex-col gap-4">
      {/* 월 합계 카드 */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-surface-secondary px-5 py-4">
        <span className="text-[13px] font-medium text-foreground-secondary">
          {monthText} 관리비 합계 ({view.rows.length}건)
        </span>
        <div className="flex items-end gap-4">
          <span className="text-[12px] text-foreground-secondary">
            전월 대비 <Diff value={totalDiff} />
          </span>
          <span className="font-mono text-[20px] font-semibold text-foreground">{won(view.total)}원</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr>
              <th className="text-left">항목</th>
              <th className="text-right">사용량</th>
              <th className="text-right">단가</th>
              <th className="text-right">금액</th>
              <th className="text-right">전월 대비</th>
              <th className="text-left">메모</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-foreground-tertiary" style={{ padding: '48px 20px' }}>
                  이 달에 입력된 관리비가 없습니다.
                </td>
              </tr>
            ) : (
              view.rows.map((row) => (
                <tr key={row.entry.id} onClick={() => onRowClick(row)} className="cursor-pointer">
                  <td className="font-medium text-foreground">
                    {row.item.name}
                    {!row.item.is_active && <span className="text-[11px] text-foreground-quaternary"> (숨김)</span>}
                  </td>
                  <td className="text-right font-mono">
                    {row.entry.usage === null ? '—' : `${row.entry.usage.toLocaleString('ko-KR', { maximumFractionDigits: 3 })}${row.item.unit ? ` ${row.item.unit}` : ''}`}
                  </td>
                  <td className="text-right font-mono">
                    {row.entry.unit_price === null ? '—' : `${row.entry.unit_price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원`}
                  </td>
                  <td className="text-right font-mono font-medium text-foreground">
                    <div className="flex flex-col items-end gap-0.5">
                      <span>{won(row.entry.amount)}원</span>
                      {row.entry.amount_overridden && <span className="text-[11px] font-normal text-amber-600">직접 입력</span>}
                    </div>
                  </td>
                  <td className="text-right font-mono">
                    <Diff value={row.diff} />
                  </td>
                  <td className="text-foreground-secondary">{row.entry.memo ?? ''}</td>
                </tr>
              ))
            )}
          </tbody>
          {view.rows.length > 0 && (
            <tfoot>
              <tr className="bg-surface-secondary">
                <td className="font-semibold text-foreground">합계</td>
                <td />
                <td />
                <td className="text-right font-mono font-semibold text-foreground">{won(view.total)}원</td>
                <td className="text-right font-mono">
                  <Diff value={totalDiff} />
                </td>
                <td className="text-[12px] text-foreground-secondary">
                  {view.prevTotal === null ? '' : `전월 ${won(view.prevTotal)}원`}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
