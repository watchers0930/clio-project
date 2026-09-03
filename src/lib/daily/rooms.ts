/**
 * Daily.co REST API 서버 전용 래퍼
 * ⚠️ DAILY_API_KEY 는 서버에서만 사용한다. 클라이언트/로그에 절대 노출 금지.
 * @see https://docs.daily.co/reference/rest-api
 */

const DAILY_API_BASE = 'https://api.daily.co/v1';

/** 방 이름 안전 문자 검증 (Daily: 영문·숫자·_·- 만 허용) */
const ROOM_NAME_RE = /^[A-Za-z0-9_-]{1,60}$/;

function getApiKey(): string {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error('DAILY_API_KEY 미설정');
  return key;
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  };
}

/** Daily 응답에서 민감정보 없이 에러 메시지만 추출 */
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; info?: string };
    return body.info || body.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export interface DailyRoom {
  name: string;
  url: string;
}

/**
 * 방을 조회하고 없으면 생성한다. (멱등)
 * @param roomName 결정론적 방 이름 (예: clio-<eventId>)
 * @param expSeconds 방 만료까지 남은 초 (기본 24시간)
 */
export async function ensureRoom(
  roomName: string,
  expSeconds = 24 * 60 * 60,
): Promise<DailyRoom> {
  if (!ROOM_NAME_RE.test(roomName)) throw new Error('잘못된 방 이름');

  // 1) 기존 방 조회
  const getRes = await fetch(`${DAILY_API_BASE}/rooms/${roomName}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (getRes.ok) {
    const room = (await getRes.json()) as { name: string; url: string };
    return { name: room.name, url: room.url };
  }
  if (getRes.status !== 404) {
    throw new Error(`Daily 방 조회 실패: ${await readError(getRes)}`);
  }

  // 2) 없으면 생성 (private + 만료시각 지정)
  const exp = Math.floor(Date.now() / 1000) + expSeconds;
  const createRes = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: roomName,
      privacy: 'private',
      properties: {
        exp,
        eject_at_room_exp: true,
        enable_screenshare: true,
        enable_chat: true,
        enable_prejoin_ui: true,
      },
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Daily 방 생성 실패: ${await readError(createRes)}`);
  }
  const room = (await createRes.json()) as { name: string; url: string };
  return { name: room.name, url: room.url };
}

/**
 * 특정 방에 입장할 수 있는 meeting token 발급 (private 방 필수).
 * @param roomName 방 이름
 * @param userName 표시 이름
 * @param isOwner 방장 권한 여부
 * @param expSeconds 토큰 만료까지 남은 초 (기본 2시간)
 */
export async function createMeetingToken(
  roomName: string,
  userName: string,
  isOwner = false,
  expSeconds = 2 * 60 * 60,
): Promise<string> {
  if (!ROOM_NAME_RE.test(roomName)) throw new Error('잘못된 방 이름');
  const exp = Math.floor(Date.now() / 1000) + expSeconds;

  const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName.slice(0, 60),
        is_owner: isOwner,
        exp,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Daily 토큰 발급 실패: ${await readError(res)}`);
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}
