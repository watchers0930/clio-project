'use client';

import { useCallback, useState } from 'react';

interface VideoRoomState {
  roomUrl: string | null;
  token: string | null;
}

/**
 * 화상회의 방 입장 상태·로직 훅.
 * join(key, eventId?) → 서버에서 Daily 방/토큰 발급 → 모달 오픈용 상태 세팅.
 * joiningKey 로 어떤 버튼이 로딩 중인지 구분(버튼별 로딩 표시).
 */
export function useVideoRoom() {
  const [joiningKey, setJoiningKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<VideoRoomState | null>(null);

  const join = useCallback(async (key: string, eventId?: string) => {
    if (joiningKey) return; // 중복 입장 방지
    setJoiningKey(key);
    setError(null);
    try {
      const res = await fetch('/api/meetings/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventId ? { eventId } : {}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || '화상회의 입장에 실패했습니다');
      }
      setRoom({ roomUrl: json.data.roomUrl, token: json.data.token });
    } catch (err) {
      setError(err instanceof Error ? err.message : '화상회의 입장에 실패했습니다');
    } finally {
      setJoiningKey(null);
    }
  }, [joiningKey]);

  const leave = useCallback(() => {
    setRoom(null);
    setError(null);
  }, []);

  return { joiningKey, error, room, join, leave };
}
