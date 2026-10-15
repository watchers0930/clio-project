'use client';

// 연차 카드 — 부여·차감·예약·잔여·신청가능·계산 전제 (설계서 §5.5, §4.4)

import { useState } from 'react';
import { Info, AlertTriangle, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { fmtDays } from './format';
import type { LeaveBalanceView } from './types';

interface Props {
  balance: LeaveBalanceView | null;
  loading: boolean;
  error: string | null;
}

const REASON_LABEL: Record<NonNullable<LeaveBalanceView['reason']>, string> = {
  no_hire_date: '입사일이 등록되어 있지 않습니다.',
  future_hire_date: '입사일이 기준일보다 미래입니다.',
  invalid_date: '입사일 형식이 올바르지 않습니다.',
};

export function LeaveBalanceCard({ balance, loading, error }: Props) {
  const [showGrants, setShowGrants] = useState(false);
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <h3 className="text-base font-semibold text-foreground">연차 현황</h3>

        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : !balance ? (
          <p className="text-sm text-foreground-secondary">연차 정보를 표시할 수 없습니다.</p>
        ) : !balance.computable ? (
          <NotComputable balance={balance} />
        ) : (
          <>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold text-primary tabular-nums">
                {fmtDays(balance.requestableDays)}
              </span>
              <span className="pb-1 text-sm text-foreground-secondary">신청 가능</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Row label="유효 부여" value={fmtDays(balance.totalGranted)} />
              <Row label="승인 차감(예정 포함)" value={fmtDays(balance.totalDeducted)} />
              <Row label="대기 예약" value={fmtDays(balance.reservedDays)} />
              <Row label="잔여" value={fmtDays(balance.remainingDays)} strong />
            </div>

            {balance.remainingDays < 0 && (
              <p className="inline-flex items-center gap-1.5 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
                <AlertTriangle size={13} />
                잔여가 음수입니다. 관리자에게 이관 내역 확인이 필요합니다.
              </p>
            )}

            {balance.grants.length > 0 && (
              <div className="border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setShowGrants((v) => !v)}
                  className="flex w-full cursor-pointer items-center justify-between text-xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
                  aria-expanded={showGrants}
                >
                  <span>부여 구간별 잔여 ({balance.grants.length}건)</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${showGrants ? 'rotate-180' : ''}`}
                  />
                </button>
                {showGrants && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {balance.grants.map((g, i) => (
                      <li key={`${g.grantedOn}-${i}`} className="flex items-center justify-between text-xs">
                        <span className="text-foreground-secondary">
                          {g.grantedOn} ~ {g.expiresOn}
                        </span>
                        <span className="tabular-nums text-foreground">
                          {fmtDays(g.remainingDays)} / {fmtDays(g.grantedDays)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <p className="inline-flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-tertiary">
              <Info size={12} className="mt-0.5 flex-shrink-0" />
              {balance.assumptionNote}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-surface-secondary px-3 py-2">
      <span className="text-foreground-secondary">{label}</span>
      <span className={strong ? 'font-semibold text-foreground tabular-nums' : 'text-foreground tabular-nums'}>
        {value}
      </span>
    </div>
  );
}

function NotComputable({ balance }: { balance: LeaveBalanceView }) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-warning/10 px-4 py-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-warning">
        <AlertTriangle size={15} />
        연차를 계산할 수 없습니다
      </p>
      <p className="text-xs text-foreground-secondary">
        {balance.reason ? REASON_LABEL[balance.reason] : '계산에 필요한 정보가 없습니다.'} 관리자에게 입사일 등록을
        요청해주세요.
      </p>
    </div>
  );
}
