'use client';

// admin 전직원 근태 조회 훅 (설계서 §5: GET /api/attendance/admin)
// 권한은 서버에서 users.role='admin'으로 재검증한다. 이 훅은 UI 조회 상태만 담당.

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from './csrf-client';
import { kstDateBefore, todayKst } from '@/components/attendance/format';
import type { AdminAttendanceResult } from '@/components/attendance/types';

export interface AdminAttendanceQuery {
  userId?: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

function defaultQuery(): AdminAttendanceQuery {
  return { from: kstDateBefore(30), to: todayKst(), page: 1, pageSize: 20 };
}

export function useAdminAttendance() {
  const [query, setQuery] = useState<AdminAttendanceQuery>(defaultQuery);
  const [result, setResult] = useState<AdminAttendanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  // 응답 경합 방지(F08): 직원·날짜·페이지를 빠르게 바꿔도 최신 요청 응답만 반영한다.
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      from: query.from,
      to: query.to,
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    if (query.userId) params.set('userId', query.userId);
    const res = await apiGet<AdminAttendanceResult>(`/api/attendance/admin?${params.toString()}`);
    if (seq !== seqRef.current) return; // 더 최신 요청이 진행 중 → 이 응답은 버린다
    if (res.ok && res.data) {
      setResult(res.data);
      setForbidden(false);
    } else {
      setForbidden(res.status === 403);
      setError(res.status === 403 ? null : res.error ?? '전직원 근태를 불러오지 못했습니다.');
      setResult(null);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 필터 변경 시 데이터 재요청(로딩 상태 동기화)
    void load();
  }, [load]);

  return {
    query,
    setQuery,
    result,
    loading,
    error,
    forbidden,
    reload: load,
  };
}
