'use client';

// 본인 근태 조회·보정 훅 (설계서 §5: GET /api/attendance, PATCH /api/attendance/[workDate])

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiMutate } from './csrf-client';
import { kstDateBefore, todayKst } from '@/components/attendance/format';
import type { AttendanceCorrectionInput, AttendanceDayView } from '@/components/attendance/types';

export interface AttendanceRange {
  from: string; // KST 'YYYY-MM-DD'
  to: string;
}

// 기본 조회 구간 = 최근 30일 ~ 오늘(KST)
export const ATTENDANCE_RANGE_MAX_DAYS = 92; // 서버 기간 상한(설계 §5)

function defaultRange(): AttendanceRange {
  return { from: kstDateBefore(30), to: todayKst() };
}

const REFRESH_INTERVAL_MS = 60_000;

export function useAttendance() {
  const [range, setRangeState] = useState<AttendanceRange>(defaultRange);
  const [days, setDays] = useState<AttendanceDayView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 사용자가 직접 기간을 바꿨는지 추적 — 기본 구간일 때만 KST 자정에 자동으로 오늘까지 확장한다.
  const isDefaultRef = useRef(true);
  // 응답 경합 방지(F08): 가장 최근 요청의 응답만 반영한다.
  const seqRef = useRef(0);

  /** 사용자가 선택한 기간으로 변경(F04). 이후 자동 구간 확장은 하지 않는다. */
  const setRange = useCallback((next: AttendanceRange) => {
    isDefaultRef.current = false;
    setRangeState(next);
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const seq = ++seqRef.current;
      if (!opts?.silent) setLoading(true);
      setError(null);
      const res = await apiGet<{ days: AttendanceDayView[] }>(
        `/api/attendance?from=${range.from}&to=${range.to}`,
      );
      if (seq !== seqRef.current) return; // 더 최신 요청이 진행 중 → 이 응답은 버린다
      if (res.ok && res.data) {
        setDays(res.data.days ?? []);
      } else if (!opts?.silent) {
        setError(res.error ?? '근태 기록을 불러오지 못했습니다.');
        setDays([]);
      }
      // silent 갱신은 오류 시 기존 데이터·화면을 유지한다(백그라운드 폴링)
      if (!opts?.silent) setLoading(false);
    },
    [range],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 기간 변경 시 데이터 재요청(로딩 상태 동기화)
    void load();
  }, [load]);

  // 화면을 켜 둔 동안 최신 heartbeat 반영 + KST 자정 경계 처리(F05).
  // 갱신 주체는 이 훅 하나로 고정해 중복 폴링을 막는다.
  useEffect(() => {
    const id = setInterval(() => {
      const today = todayKst();
      if (isDefaultRef.current && range.to !== today) {
        // 기본 구간을 열어둔 채 날짜가 바뀜 → 오늘까지로 확장(구간 변경이 재조회를 트리거)
        setRangeState(defaultRange());
        return;
      }
      // 오늘을 포함하는 구간이면 조용히 재조회해 마지막 신호·퇴근 기준을 갱신
      if (range.to >= today) void load({ silent: true });
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [range, load]);

  /** 보정/복원 제출 → 성공 시 해당 날짜 뷰 갱신 */
  const correct = useCallback(
    async (workDate: string, input: AttendanceCorrectionInput): Promise<AttendanceDayView> => {
      const res = await apiMutate<AttendanceDayView>(
        `/api/attendance/${workDate}`,
        'PATCH',
        input,
      );
      if (!res.ok || !res.data) {
        throw new Error(resolveError(res.status, res.error));
      }
      const updated = res.data;
      // 보정 직후, 진행 중이던(이전에 시작된) 조회 응답이 이 갱신을 덮어쓰지 못하게 무효화한다.
      seqRef.current += 1;
      setDays((prev) => {
        const exists = prev.some((d) => d.workDate === updated.workDate);
        const next = exists
          ? prev.map((d) => (d.workDate === updated.workDate ? updated : d))
          : [updated, ...prev];
        return next.sort((a, b) => b.workDate.localeCompare(a.workDate));
      });
      return updated;
    },
    [],
  );

  return {
    range,
    setRange,
    days,
    loading,
    error,
    reload: load,
    correct,
  };
}

function resolveError(status: number, error?: string): string {
  if (status === 409) return error ?? '다른 기기에서 먼저 수정되었습니다. 새로고침 후 다시 시도해주세요.';
  if (status === 403) return error ?? '보안 검증에 실패했습니다. 새로고침 후 다시 시도해주세요.';
  if (status === 404) return error ?? '수정할 수 없는 기록입니다.';
  if (status === 400) return error ?? '입력값을 확인해주세요.';
  return error ?? '보정에 실패했습니다.';
}
