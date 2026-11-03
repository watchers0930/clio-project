'use client';

// 본인 근태 조회·보정 훅 (설계서 §5: GET /api/attendance, PATCH /api/attendance/[workDate])
// 조회 단위 = 월(달력, 1일~말일).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiMutate } from './csrf-client';
import { todayKst } from '@/components/attendance/format';
import { compareYm, monthRange, ymOf, type YearMonth } from '@/components/attendance/calendar-utils';
import type { AttendanceCorrectionInput, AttendanceDayView, HolidayView } from '@/components/attendance/types';

export interface AttendanceRange {
  from: string; // KST 'YYYY-MM-DD'
  to: string;
}

const REFRESH_INTERVAL_MS = 60_000;

export function useAttendance() {
  const [today, setToday] = useState(todayKst);
  const [month, setMonthState] = useState<YearMonth>(() => ymOf(todayKst()));
  const [days, setDays] = useState<AttendanceDayView[]>([]);
  const [holidays, setHolidays] = useState<HolidayView[]>([]);
  // 서버가 공휴일 조회에 실패하면 holidays=null → 휴가 표시 정확도 경고
  const [holidaysError, setHolidaysError] = useState(false);
  // 오늘 기록은 보고 있는 달과 무관하게 요약 카드에 필요하므로 따로 보관한다.
  const [todayDay, setTodayDay] = useState<AttendanceDayView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 현재 구간 데이터를 실제로 받았는지 — 못 받은 상태(로딩·실패)에서 빈 날로 보정 진입하는 것을 막는다.
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  // 사용자가 직접 달을 옮겼는지 — 안 옮겼으면 KST 월 경계에서 자동으로 새 달로 넘어간다.
  const isDefaultRef = useRef(true);
  // 응답 경합 방지(F08): 월 조회·오늘 단건 조회 각각 가장 최근 요청의 응답만 반영한다.
  const seqRef = useRef(0);
  const todaySeqRef = useRef(0);
  // 오늘 기록을 이번 날짜 기준으로 한 번이라도 받았는지
  const todayKnownRef = useRef(false);
  // 진행 중인 월 조회의 seq(0=없음). 진행 중이면 폴링이 새 요청으로 무효화하지 않도록 건너뛴다(느린 응답 기아 방지).
  // seq로 기록해야 보정 등으로 무효화된 요청도 끝나면 표시가 풀린다(폴링 영구 정지 방지).
  const inFlightRef = useRef(0);

  const range = useMemo<AttendanceRange>(() => monthRange(month), [month]);
  const isCurrentMonth = compareYm(month, ymOf(today)) === 0;

  const markReady = (v: boolean) => {
    readyRef.current = v;
    setReady(v);
  };

  /** 보고 있는 달 변경. 미래 달로는 이동하지 않는다. */
  const setMonth = useCallback((next: YearMonth) => {
    const cur = ymOf(todayKst());
    if (compareYm(next, cur) > 0) return;
    isDefaultRef.current = compareYm(next, cur) === 0;
    setMonthState(next);
  }, []);

  const applyToday = (view: AttendanceDayView | null) => {
    todaySeqRef.current += 1; // 진행 중인 오늘 단건 조회의 늦은 응답을 무효화
    todayKnownRef.current = true;
    setTodayDay(view);
  };

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const seq = ++seqRef.current;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
        markReady(false);
      }
      inFlightRef.current = seq;
      const res = await apiGet<{ days: AttendanceDayView[]; holidays?: HolidayView[] | null }>(
        `/api/attendance?from=${range.from}&to=${range.to}`,
      );
      if (inFlightRef.current === seq) inFlightRef.current = 0;
      if (seq !== seqRef.current) return; // 더 최신 요청이 진행 중 → 이 응답은 버린다(로딩 해제도 최신 요청 몫)
      if (res.ok && res.data) {
        const list = res.data.days ?? [];
        setDays(list);
        setHolidays(res.data.holidays ?? []);
        setHolidaysError(res.data.holidays === null);
        setError(null);
        markReady(true);
        if (range.to >= today) applyToday(list.find((d) => d.workDate === today) ?? null);
      } else if (!opts?.silent || !readyRef.current) {
        // 데이터를 한 번도 못 받은 상태의 실패는 silent라도 오류로 유지한다(빈 달력 보정 진입 차단)
        setError(res.error ?? '근태 기록을 불러오지 못했습니다.');
        setDays([]);
        markReady(false);
      }
      // silent 요청이 일반 요청을 무효화했을 수 있으므로, 최신 요청이 끝나면 항상 로딩을 해제한다.
      setLoading(false);
    },
    [range, today],
  );

  /** 지난 달을 보는 중에도 요약 카드용 오늘 기록만 갱신(달력 데이터는 건드리지 않음) */
  const loadToday = useCallback(async (date: string) => {
    const seq = ++todaySeqRef.current;
    const res = await apiGet<{ days: AttendanceDayView[] }>(`/api/attendance?from=${date}&to=${date}`);
    if (seq !== todaySeqRef.current || !res.ok || !res.data) return;
    todayKnownRef.current = true;
    setTodayDay(res.data.days?.[0] ?? null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 달 변경 시 데이터 재요청(로딩 상태 동기화)
    void load();
  }, [load]);

  // 첫 조회 전에 지난 달로 옮긴 경우 등, 오늘 기록을 아직 모르면 단건으로 채운다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 오늘 기록 미확보 시 서버 재요청(응답 콜백에서만 상태 변경)
    if (range.to < today && !todayKnownRef.current) void loadToday(today);
  }, [range.to, today, loadToday]);

  // 화면을 켜 둔 동안 최신 heartbeat 반영 + KST 자정·월 경계 처리(F05).
  // 갱신 주체는 이 훅 하나로 고정해 중복 폴링을 막는다.
  useEffect(() => {
    const id = setInterval(() => {
      const now = todayKst();
      if (now !== today) {
        // 날짜가 바뀜 → 어제 기록을 '오늘'로 보여주지 않도록 비우고 구간 재계산(재조회 트리거).
        todayKnownRef.current = false;
        todaySeqRef.current += 1;
        setTodayDay(null);
        setToday(now);
        if (isDefaultRef.current) setMonthState(ymOf(now));
        return;
      }
      if (range.to >= today) {
        if (inFlightRef.current === 0) void load({ silent: true });
      } else void loadToday(today);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [range, today, load, loadToday]);

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
        return exists
          ? prev.map((d) => (d.workDate === updated.workDate ? updated : d))
          : [...prev, updated];
      });
      if (updated.workDate === todayKst()) applyToday(updated);
      return updated;
    },
    [],
  );

  return {
    month,
    setMonth,
    isCurrentMonth,
    today,
    range,
    days,
    holidays,
    holidaysError,
    ready,
    todayDay,
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
