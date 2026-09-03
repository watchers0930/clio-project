'use client';

import { useEffect, useRef, useState } from 'react';
import type { DailyCall } from '@daily-co/daily-js';
import { Languages } from 'lucide-react';
import { useLiveCaptions } from '@/hooks/useLiveCaptions';
import { CaptionOverlay, CAPTION_LANGS } from './CaptionOverlay';

interface VideoCallModalProps {
  isOpen: boolean;
  roomUrl: string | null;
  token: string | null;
  onClose: () => void;
}

/**
 * Daily prebuilt iframe 화상회의 모달 + 실시간 번역 자막.
 * - 프레임 생성/입장은 방 정보가 바뀔 때만 1회. 자막 토글/언어는 별도 관리.
 * - 입장 실패 시 Daily iframe 안내를 볼 수 있게 모달을 유지한다.
 */
export function VideoCallModal({ isOpen, roomUrl, token, onClose }: VideoCallModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const joinedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [captionsOn, setCaptionsOn] = useState(false);
  const [targetLang, setTargetLang] = useState('ko');
  const { captions, pushFinal, clear } = useLiveCaptions(targetLang);

  // 프레임 생성/입장 (자막 상태와 무관하게 1회)
  useEffect(() => {
    if (!isOpen || !roomUrl || !token || !containerRef.current) return;

    let cancelled = false;
    const container = containerRef.current;
    joinedRef.current = false;

    (async () => {
      const DailyIframe = (await import('@daily-co/daily-js')).default;
      if (cancelled) return;

      const frame = DailyIframe.createFrame(container, {
        showLeaveButton: true,
        showFullscreenButton: true,
        iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '12px' },
      });
      callRef.current = frame;
      frame.on('joined-meeting', () => { joinedRef.current = true; });
      frame.on('left-meeting', () => { if (joinedRef.current) onCloseRef.current(); });
      // 라이브 자막 수신 → 최종 발화만 번역 큐로
      frame.on('transcription-message', (ev) => {
        if (!ev) return;
        const isFinal = (ev.rawResponse as { is_final?: boolean })?.is_final;
        if (isFinal === false) return; // interim(중간) 결과는 건너뜀
        const text = ev.text ?? '';
        if (!text) return;
        const pid = ev.participantId ?? 'local';
        const p = frame.participants?.()[pid];
        const name = p?.user_name || (pid === 'local' ? '나' : '상대');
        const ts = ev.timestamp instanceof Date ? ev.timestamp.getTime() : text.length;
        pushFinal(`${pid}-${ts}`, name, text);
      });
      await frame.join({ url: roomUrl, token }).catch(() => {});
    })();

    return () => {
      cancelled = true;
      callRef.current?.destroy();
      callRef.current = null;
      clear();
    };
  }, [isOpen, roomUrl, token, pushFinal, clear]);

  // 자막 on/off → 트랜스크립션 시작/중지 (입장 완료 후 동작)
  useEffect(() => {
    const frame = callRef.current;
    if (!frame) return;
    (async () => {
      try {
        if (captionsOn) await frame.startTranscription();
        else await frame.stopTranscription();
      } catch {
        /* 미입장·권한 등으로 실패하면 무시 (입장 후 다시 토글) */
      }
    })();
  }, [captionsOn]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl bg-neutral-900 shadow-2xl">
        {/* 상단 컨트롤 바 */}
        <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
          <button
            onClick={() => setCaptionsOn((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              captionsOn ? 'bg-primary text-white' : 'bg-black/50 text-white hover:bg-black/70'
            }`}
          >
            <Languages size={15} />
            {captionsOn ? '자막 켜짐' : '번역 자막'}
          </button>
          {captionsOn && (
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="rounded-md bg-black/50 px-2 py-1.5 text-sm text-white outline-none"
            >
              {CAPTION_LANGS.map((l) => (
                <option key={l.code} value={l.code} className="text-black">
                  {l.label}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={onClose}
            className="rounded-md bg-black/50 px-3 py-1.5 text-sm font-medium text-white hover:bg-black/70"
          >
            나가기
          </button>
        </div>

        <div ref={containerRef} className="h-full w-full" />
        <CaptionOverlay captions={captions} enabled={captionsOn} />
      </div>
    </div>
  );
}
