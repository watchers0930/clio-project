'use client';

import { useEffect, useState } from 'react';

/**
 * 로그인 본인 프로필(`GET /api/users/profile`) 공용 조회 훅.
 *
 * 단일 책임: 프로필 조회(네트워크)만 담당한다. UI·자동채움 정책은 소비 측(훅/컴포넌트)이 담당한다.
 *
 * 성능(플랫폼 원칙 4): 같은 화면에서 생성 자동채움 훅과 재직증명서 UI가 각각 /api/users/profile을
 * 중복 호출하던 문제를 제거한다. 모듈 수준 캐시 + in-flight 공유로 세션당 요청을 1건으로 합치고,
 * 컴포넌트 재마운트(모드 전환) 시 재조회도 캐시로 흡수한다.
 */
export interface SelfProfileData {
  name?: string;
  resident_no?: string;
  address?: string;
  department?: string;
  position?: string;
  hire_date?: string;
  phone?: string;
  [key: string]: unknown;
}

let cache: SelfProfileData | null = null;
let inflight: Promise<SelfProfileData | null> | null = null;

/** 캐시 → in-flight → 신규 fetch 순으로 단일 조회를 보장한다. 실패는 null로 수렴(조회 실패만 생략). */
function loadSelfProfile(): Promise<SelfProfileData | null> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch('/api/users/profile')
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => {
      inflight = null;
      if (json?.success && json.data) {
        cache = json.data as SelfProfileData;
        return cache;
      }
      return null;
    })
    .catch(() => {
      inflight = null;
      return null;
    });
  return inflight;
}

export function useSelfProfile(): {
  profile: SelfProfileData | null;
  loading: boolean;
  error: boolean;
} {
  // 초기 state가 캐시를 그대로 반영하므로(캐시 있으면 loading=false) effect 본문에서 동기 setState를
  // 하지 않는다. 모든 상태 갱신은 비동기 조회 콜백 안에서만 수행한다.
  const [profile, setProfile] = useState<SelfProfileData | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSelfProfile().then((data) => {
      if (cancelled) return;
      if (data) setProfile(data);
      else setError(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, loading, error };
}
