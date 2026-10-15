'use client';

// 휴가 신청 조회·생성·수정·연결·상신 훅
// (설계서 §5: GET /api/leave-requests, POST /api/leave-requests, PATCH /api/leave-requests/[id])

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiMutate } from './csrf-client';
import type {
  LeaveCreateInput,
  LeaveRequestView,
  LeaveStatus,
  LeaveUpdateInput,
} from '@/components/attendance/types';

export function useLeaveRequests(statusFilter?: LeaveStatus) {
  const [requests, setRequests] = useState<LeaveRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    const res = await apiGet<{ requests: LeaveRequestView[] }>(`/api/leave-requests${qs}`);
    if (res.ok && res.data) {
      setRequests(res.data.requests ?? []);
    } else {
      setError(res.error ?? '휴가 신청 목록을 불러오지 못했습니다.');
      setRequests([]);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 상태 필터 변경 시 데이터 재요청(로딩 상태 동기화)
    void load();
  }, [load]);

  const upsert = useCallback((view: LeaveRequestView) => {
    setRequests((prev) => {
      const exists = prev.some((r) => r.id === view.id);
      const next = exists ? prev.map((r) => (r.id === view.id ? view : r)) : [view, ...prev];
      return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }, []);

  /** 초안 생성 (서버가 근무일·차감량·정책버전·스냅샷 계산) */
  const create = useCallback(
    async (input: LeaveCreateInput): Promise<LeaveRequestView> => {
      const res = await apiMutate<LeaveRequestView>('/api/leave-requests', 'POST', input);
      if (!res.ok || !res.data) throw new Error(resolveError(res.status, res.error));
      upsert(res.data);
      return res.data;
    },
    [upsert],
  );

  /** 초안 수정 / 문서 연결 재시도 / 상신 (action으로 구분) */
  const patch = useCallback(
    async (id: string, input: LeaveUpdateInput): Promise<LeaveRequestView> => {
      const res = await apiMutate<LeaveRequestView>(`/api/leave-requests/${id}`, 'PATCH', input);
      if (!res.ok || !res.data) throw new Error(resolveError(res.status, res.error, input.action));
      upsert(res.data);
      return res.data;
    },
    [upsert],
  );

  return {
    requests,
    loading,
    error,
    reload: load,
    create,
    update: (id: string, patchInput: Omit<LeaveUpdateInput, 'action'>) =>
      patch(id, { action: 'update', ...patchInput }),
    linkDocument: (id: string, documentId: string) =>
      patch(id, { action: 'link_document', documentId }),
    submit: (id: string) => patch(id, { action: 'submit' }),
  };
}

function resolveError(status: number, error?: string, action?: LeaveUpdateInput['action']): string {
  if (status === 409) {
    if (action === 'submit') {
      return error ?? '상신할 수 없습니다. 조직도 상위자 또는 문서 연결 상태를 확인해주세요.';
    }
    return error ?? '기간이 겹치거나 잔여가 부족합니다. 신청 내용을 확인해주세요.';
  }
  if (status === 403) return error ?? '보안 검증에 실패했습니다. 새로고침 후 다시 시도해주세요.';
  if (status === 404) return error ?? '신청 건을 찾을 수 없습니다.';
  if (status === 400) return error ?? '입력값을 확인해주세요.';
  return error ?? '요청 처리에 실패했습니다.';
}
