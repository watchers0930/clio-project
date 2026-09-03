'use client';

import { useEffect, useRef } from 'react';
import type { DailyCall } from '@daily-co/daily-js';

interface VideoCallModalProps {
  isOpen: boolean;
  roomUrl: string | null;
  token: string | null;
  onClose: () => void;
}

/**
 * Daily prebuilt iframe 화상회의 모달.
 * 방 정보(roomUrl/token)가 있을 때만 프레임을 생성하고, 닫히면 반드시 destroy 한다.
 */
export function VideoCallModal({ isOpen, roomUrl, token, onClose }: VideoCallModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);

  useEffect(() => {
    if (!isOpen || !roomUrl || !token || !containerRef.current) return;

    let cancelled = false;
    const container = containerRef.current;

    (async () => {
      // daily-js 는 브라우저 전용 → 동적 로드
      const DailyIframe = (await import('@daily-co/daily-js')).default;
      if (cancelled) return;

      const frame = DailyIframe.createFrame(container, {
        showLeaveButton: true,
        showFullscreenButton: true,
        iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '12px' },
      });
      callRef.current = frame;
      frame.on('left-meeting', onClose);
      await frame.join({ url: roomUrl, token }).catch(() => onClose());
    })();

    return () => {
      cancelled = true;
      callRef.current?.destroy();
      callRef.current = null;
    };
  }, [isOpen, roomUrl, token, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl bg-neutral-900 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-md bg-black/50 px-3 py-1.5 text-sm font-medium text-white hover:bg-black/70"
        >
          나가기
        </button>
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
