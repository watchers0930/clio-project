'use client';

import type { YearlyView } from '@/lib/maintenance-fees/types';
import { won } from '@/lib/maintenance-fees/format';

interface Props {
  view: YearlyView;
  year: number;
}

// 15열 표라 전역 셀 여백(16px 20px)을 줄여 쓴다
const cell = { padding: '12px 10px' };
const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);

export function YearlyFeeTable({ view, year }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-surface-secondary px-5 py-4">
        <span className="text-[13px] font-medium text-foreground-secondary">
          {year}년 관리비 합계 ({view.rows.length}개 항목)
        </span>
        <span className="font-mono text-[20px] font-semibold text-foreground">{won(view.grandTotal)}원</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[1280px] text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 text-left" style={cell}>항목</th>
              {MONTHS.map((m) => (
                <th key={m} className="text-right" style={cell}>{m}</th>
              ))}
              <th className="text-right" style={cell}>연간 사용량</th>
              <th className="text-right" style={cell}>평균 단가</th>
              <th className="text-right" style={cell}>연 합계</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.length === 0 ? (
              <tr>
                <td colSpan={16} className="text-center text-foreground-tertiary" style={{ padding: '48px 20px' }}>
                  {year}년에 입력된 관리비가 없습니다.
                </td>
              </tr>
            ) : (
              view.rows.map((row) => (
                <tr key={row.item.id}>
                  <td className="sticky left-0 z-10 bg-white font-medium text-foreground" style={cell}>
                    {row.item.name}
                    {!row.item.is_active && <span className="text-[11px] text-foreground-quaternary"> (숨김)</span>}
                  </td>
                  {row.months.map((v, i) => (
                    <td key={i} className="text-right font-mono" style={cell}>
                      {v === null ? <span className="text-foreground-quaternary">—</span> : won(v)}
                    </td>
                  ))}
                  <td className="text-right font-mono" style={cell}>
                    {row.usageTotal === null
                      ? '—'
                      : `${row.usageTotal.toLocaleString('ko-KR', { maximumFractionDigits: 3 })}${row.item.unit ? ` ${row.item.unit}` : ''}`}
                  </td>
                  <td className="text-right font-mono" style={cell}>
                    {row.avgUnitPrice === null ? '—' : `${row.avgUnitPrice.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원`}
                  </td>
                  <td className="text-right font-mono font-semibold text-foreground" style={cell}>{won(row.amountTotal)}</td>
                </tr>
              ))
            )}
          </tbody>
          {view.rows.length > 0 && (
            <tfoot>
              <tr className="bg-surface-secondary">
                <td className="sticky left-0 z-10 bg-surface-secondary font-semibold text-foreground" style={cell}>월 총액</td>
                {view.monthTotals.map((v, i) => (
                  <td key={i} className="text-right font-mono font-semibold text-foreground" style={cell}>
                    {view.rows.every((r) => r.months[i] === null) ? <span className="text-foreground-quaternary">—</span> : won(v)}
                  </td>
                ))}
                <td style={cell} />
                <td style={cell} />
                <td className="text-right font-mono font-semibold text-primary" style={cell}>{won(view.grandTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-[12px] text-foreground-tertiary">
        금액 단위: 원 · 평균 단가 = 사용량이 있는 달의 금액 합 ÷ 사용량 합
      </p>
    </div>
  );
}
