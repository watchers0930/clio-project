'use client';

// 연차 잔여 집계 조회 훅 (설계서 §5: GET /api/leave-requests/balance)

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from './csrf-client';
import type { LeaveBalanceView } from '@/components/attendance/types';

export function useLeaveBalance(asOf?: string) {
  const [balance, setBalance] = useState<LeaveBalanceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = asOf ? `?asOf=${asOf}` : '';
    const res = await apiGet<LeaveBalanceView>(`/api/leave-requests/balance${qs}`);
    if (res.ok && res.data) {
      setBalance(res.data);
    } else {
      setError(res.error ?? '연차 잔여를 불러오지 못했습니다.');
      setBalance(null);
    }
    setLoading(false);
  }, [asOf]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 기준일 변경 시 데이터 재요청(로딩 상태 동기화)
    void load();
  }, [load]);

  return { balance, loading, error, reload: load };
}
