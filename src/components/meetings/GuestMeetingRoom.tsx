'use client';

import { useEffect, useRef, useState } from 'react';
import type { DailyCall } from '@daily-co/daily-js';
import { Video, Loader2 } from 'lucide-react';

/**
 * 게스트(비로그인) 화상회의 입장 화면.
 * 이름 입력 → 공개 API로 방 확인 → 토큰 없이 노킹 입장(호스트 승인 대기).
 */
export function GuestMeetingRoom({ room }: { room: string }) {
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const nameRef = useRef('');
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);

  const handleJoin = async () => {
    const nm = name.trim();
    if (!nm) return;
    nameRef.current = nm;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch('/api/meetings/guest-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '입장에 실패했습니다');
      setRoomUrl(json.data.roomUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : '입장에 실패했습니다');
      setJoining(false);
    }
  };

  // 방 URL 확보되면 프레임 생성 + 노킹 입장
  useEffect(() => {
    if (!roomUrl || !containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;
    (async () => {
      const DailyIframe = (await import('@daily-co/daily-js')).default;
      if (cancelled) return;
      const frame = DailyIframe.createFrame(container, {
        showLeaveButton: true,
        iframeStyle: { width: '100%', height: '100%', border: '0' },
      });
      callRef.current = frame;
      // 토큰 없이 join → 비공개방이므로 노킹(대기실) → 호스트 승인 시 입장
      await frame.join({ url: roomUrl, userName: nameRef.current }).catch(() => {});
    })();
    return () => {
      cancelled = true;
      callRef.current?.destroy();
      callRef.current = null;
    };
  }, [roomUrl]);

  // 입장 진행(대기실 포함) → 전체 화면 iframe
  if (roomUrl) {
    return <div ref={containerRef} className="h-screen w-screen bg-neutral-900" />;
  }

  // 이름 입력 화면
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Video className="text-primary" size={24} />
          </div>
          <h1 className="text-lg font-bold text-foreground">화상회의 입장</h1>
          <p className="text-[13px] text-foreground-secondary">
            이름을 입력하면 호스트 승인 후 입장됩니다.
          </p>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          placeholder="이름"
          maxLength={30}
          autoFocus
          className="mb-3 w-full rounded-xl border border-border px-4 py-3 text-[14px] outline-none focus:border-primary"
        />
        {error && <p className="mb-3 text-[12px] text-red-500">{error}</p>}
        <button
          onClick={handleJoin}
          disabled={joining || !name.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {joining ? <Loader2 className="animate-spin" size={16} /> : <Video size={16} />}
          {joining ? '입장 중…' : '입장하기'}
        </button>
      </div>
    </div>
  );
}
