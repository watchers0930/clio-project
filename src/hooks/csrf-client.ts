// 공통 CSRF fetch 래퍼 (프론트 전용)
//
// 설계서 §5는 이 래퍼의 이상적 위치를 `lib/http/api-client`로 두지만,
// 이번 작업의 수정 허용 경로가 components/·app/·hooks/ 로 한정되어 lib/ 를 만들 수 없다.
// → 재사용 프론트 로직이므로 hooks/ 에 모듈로 배치한다.
//
// 역할: 변이 요청(POST/PATCH/PUT/DELETE)에 `X-CSRF-Token`과 `credentials:'include'`를
//       자동 첨부하고, 403(토큰 만료·불일치) 시 토큰을 1회 재발급해 재시도한다.
//       GET은 토큰이 불필요하다(설계서 §5).

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

type MutationMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

// 세션 수명 동안 토큰을 캐시한다. 만료 10초 전 선재발급.
let cachedToken: string | null = null;
let cachedExpiry = 0;
let inflight: Promise<string | null> | null = null;
// 계정 전환·로그아웃 시 증가시켜, 진행 중이던 이전 세션 발급 응답이
// 새 세션 캐시를 덮어쓰지 못하게 한다(F07: 지연 발급 응답 무효화).
let tokenGeneration = 0;

async function requestToken(): Promise<string | null> {
  const gen = tokenGeneration;
  try {
    const res = await fetch('/api/csrf', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success && json.data?.token) {
      // 발급 대기 중 resetCsrfToken()이 호출됐다면(계정전환) 이 응답은
      // 이전 세션 토큰이므로 캐시에 반영하지 않는다.
      if (gen !== tokenGeneration) return null;
      cachedToken = json.data.token as string;
      cachedExpiry = json.data.expiresAt ? Date.parse(json.data.expiresAt) : 0;
      return cachedToken;
    }
  } catch {
    // 네트워크 오류 → 토큰 없음으로 처리(호출부가 403 처리)
  }
  return null;
}

/** 세션 결합 CSRF 토큰을 가져온다. force=true면 강제 재발급. */
export async function getCsrfToken(force = false): Promise<string | null> {
  const now = Date.now();
  const fresh = cachedToken && (cachedExpiry === 0 || now < cachedExpiry - 10_000);
  if (!force && fresh) return cachedToken;
  if (inflight) return inflight;
  inflight = requestToken().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** CSRF 캐시 초기화 (로그아웃·계정전환 시) */
export function resetCsrfToken(): void {
  cachedToken = null;
  cachedExpiry = 0;
  // 세대 증가 → 진행 중이던 이전 세션의 발급 응답을 무효화하고,
  // 다음 요청이 반드시 새 토큰을 발급받도록 한다.
  tokenGeneration += 1;
  inflight = null;
}

async function parse<T>(res: Response): Promise<ApiResult<T>> {
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: string;
  };
  return {
    ok: res.ok && json?.success !== false,
    status: res.status,
    data: json?.data,
    error: json?.error,
  };
}

/** 조회(GET): 쿠키 세션 포함, CSRF 토큰 불필요 */
export async function apiGet<T>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return parse<T>(res);
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : '네트워크 오류가 발생했습니다.' };
  }
}

/** 변이(POST/PATCH/PUT/DELETE): X-CSRF-Token 자동 첨부 + 403 시 1회 재발급 재시도.
 *  signal을 넘기면 cleanup(계정전환·언마운트) 시 진행 중 요청을 취소할 수 있다(F07). */
export async function apiMutate<T>(
  url: string,
  method: MutationMethod,
  body?: unknown,
  signal?: AbortSignal,
): Promise<ApiResult<T>> {
  const send = (token: string | null): Promise<Response> =>
    fetch(url, {
      method,
      credentials: 'include',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { 'X-CSRF-Token': token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  try {
    let res = await send(await getCsrfToken());
    if (res.status === 403 && !signal?.aborted) {
      // 토큰 만료·불일치 → 강제 재발급 후 1회 재시도
      res = await send(await getCsrfToken(true));
    }
    return parse<T>(res);
  } catch (e) {
    if (signal?.aborted) return { ok: false, status: 0, error: '요청이 취소되었습니다.' };
    return { ok: false, status: 0, error: e instanceof Error ? e.message : '네트워크 오류가 발생했습니다.' };
  }
}

/** 기존 fetch 호출부용 얇은 래퍼. 변이 메서드면 X-CSRF-Token을 자동 첨부하고
 *  403(토큰 만료·불일치) 시 1회 재발급 재시도한다. 응답은 원본 Response 그대로 반환하므로
 *  기존 `res.ok`/`res.json()` 처리 로직을 바꾸지 않고 CSRF 가드로 이관할 수 있다(F01).
 *  GET/HEAD는 토큰 없이 쿠키 세션만 포함한다. FormData 등 기존 body·헤더를 보존한다. */
export async function csrfFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const base: RequestInit = { ...init, credentials: init.credentials ?? 'include' };
  if (method === 'GET' || method === 'HEAD') return fetch(url, base);

  const headers = init.headers as Record<string, string> | undefined;
  const send = (token: string | null): Promise<Response> =>
    fetch(url, {
      ...base,
      headers: { ...headers, ...(token ? { 'X-CSRF-Token': token } : {}) },
    });

  let res = await send(await getCsrfToken());
  if (res.status === 403 && !base.signal?.aborted) {
    res = await send(await getCsrfToken(true));
  }
  return res;
}
