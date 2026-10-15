'use client';

// Electron 생존 heartbeat 전송 훅 (설계서 §1.1 · §4.1)
// AppLayout에 "1회만" 마운트한다. Electron에서만 tick을 구독하고, 웹에서는 비활성이다.
//
// 책임: main이 보내는 tick 구독 → 인증 상태 확인 → 쿠키+CSRF로 POST heartbeat
//       → 네트워크 실패 시 지수 backoff → 언마운트·계정전환·로그아웃 시 정리.
// 세션/서비스키를 다루지 않는다(쿠키 세션 + CSRF만).

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { apiMutate, resetCsrfToken } from './csrf-client';

export interface ElectronAttendanceAPI {
  onHeartbeatTick: (cb: () => void) => void;
  offHeartbeatTick: (cb: () => void) => void;
  getAutoLaunch?: () => Promise<{ openAtLogin: boolean; supported?: boolean } | boolean>;
  setAutoLaunch?: (enabled: boolean) => Promise<{ openAtLogin: boolean; supported?: boolean } | boolean>;
}

type ElectronBridge = { attendance?: ElectronAttendanceAPI } | undefined;

/** Electron attendance 브릿지 반환(없으면 null = 웹 환경) */
export function getElectronAttendance(): ElectronAttendanceAPI | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as Window & { electronAPI?: ElectronBridge }).electronAPI;
  return bridge?.attendance ?? null;
}

const BACKOFF_START_MS = 30_000;
const BACKOFF_MAX_MS = 10 * 60_000;

export function useAttendanceHeartbeat(): void {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  // 세션 토큰도 구독한다: 동일 userId 재인증·토큰 갱신 시에도 effect가 재실행되어
  // 정지 상태가 풀리고(F06) 이전 세션 요청·CSRF가 폐기된다(F07).
  const token = useAuthStore((s) => s.token ?? null);

  useEffect(() => {
    const api = getElectronAttendance();
    // 웹이거나 미인증이면 비활성. userId/token 변경(계정전환·재인증) 시 이전 effect는 정리되고 재시작된다.
    if (!api || !userId) return;

    const controller = new AbortController(); // 계정전환·언마운트 시 진행 중 요청 취소(F07)
    let sending = false;
    let stopped = false; // 인증 실패 정지 상태 — 재인증(effect 재실행) 전까지 전송 금지(F06)
    let backoff = 0;
    let nextAllowedAt = 0; // 이 시각 전에는 전송하지 않는다 — tick이 backoff를 우회 못하게(F06)
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const send = async () => {
      if (stopped || sending || controller.signal.aborted) return;
      if (Date.now() < nextAllowedAt) return; // backoff 창 중 — tick 포함 모든 전송 보류
      sending = true;
      const res = await apiMutate('/api/attendance/heartbeat', 'POST', {}, controller.signal);
      sending = false;
      if (controller.signal.aborted) return;

      if (res.ok) {
        backoff = 0;
        nextAllowedAt = 0;
        clearRetry();
        return;
      }
      // 401/403: 미인증·세션만료 → 전송 정지. 재인증/토큰 갱신 시 effect 재실행으로 재개.
      if (res.status === 401 || res.status === 403) {
        stopped = true;
        clearRetry();
        return;
      }
      // 네트워크/429/5xx → 지수 backoff. tick·retry가 동일한 nextAllowedAt 스케줄을 따른다.
      backoff = backoff ? Math.min(backoff * 2, BACKOFF_MAX_MS) : BACKOFF_START_MS;
      nextAllowedAt = Date.now() + backoff;
      clearRetry();
      retryTimer = setTimeout(() => void send(), backoff);
    };

    const onTick = () => void send();

    api.onHeartbeatTick(onTick);
    void send(); // 인증 직후 즉시 1회 전송(§4.1)

    return () => {
      controller.abort(); // 진행 중 heartbeat 요청 취소(F07)
      clearRetry();
      api.offHeartbeatTick(onTick);
      // 계정전환·재인증 시 이전 세션 CSRF 캐시·진행 중 발급을 무효화한다(F07).
      resetCsrfToken();
    };
  }, [userId, token]);
}
