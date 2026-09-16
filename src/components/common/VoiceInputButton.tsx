'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

// 너무 짧은 녹음은 무음일 확률이 높아 STT로 보내지 않는다(환각 방지).
const MIN_DURATION_MS = 800;
const MIN_BLOB_BYTES = 2000;

// Whisper가 무음/노이즈에서 흔히 뱉는 유튜브 아웃트로 환각 문구.
// 공백·구두점을 제거해 비교한다.
const HALLUCINATION_PHRASES = [
  '시청해주셔서감사합니다',
  '지금까지시청해주셔서감사합니다',
  '오늘도시청해주셔서감사합니다',
  '구독과좋아요부탁드립니다',
  '구독좋아요알림설정부탁드립니다',
  '다음영상에서만나요',
  '다음시간에만나요',
  '다음영상에서뵙겠습니다',
];

function normalizeForCompare(s: string): string {
  return s.replace(/[\s.,!?~…·]/g, '');
}

// 변환 결과가 사실상 환각 문구뿐이면 true.
function isHallucination(text: string): boolean {
  const n = normalizeForCompare(text);
  if (!n) return true;
  return HALLUCINATION_PHRASES.some(
    (p) => n === p || (n.length <= p.length + 4 && n.includes(p)),
  );
}

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  disabled?: boolean;
  /** true면 변환된 전체 문장을 그대로 전달(메모 본문용). 기본(false)은 첫 줄만(검색창용). */
  multiline?: boolean;
}

type VoiceStatus = 'idle' | 'recording' | 'processing';

export function VoiceInputButton({ onTranscript, className, disabled, multiline = false }: VoiceInputButtonProps) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('마이크를 사용할 수 없습니다.');
      return;
    }

    setError(null);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('마이크 권한이 없습니다.');
      return;
    }

    streamRef.current = stream;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/mp4';

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const elapsed = Date.now() - startedAtRef.current;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      // 너무 짧거나 작은 녹음은 무음일 확률이 높아 STT로 보내지 않는다(환각 방지)
      if (elapsed < MIN_DURATION_MS || blob.size < MIN_BLOB_BYTES) {
        setError('너무 짧아요. 버튼을 누른 뒤 또렷하게 말하고 다시 눌러 종료하세요.');
        setStatus('idle');
        return;
      }

      setStatus('processing');

      try {
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const formData = new FormData();
        formData.append('file', blob, `voice.${ext}`);

        const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success && data.data?.transcript) {
          const raw: string = data.data.transcript;
          // Whisper 환각(유튜브 아웃트로 문구)이면 버린다
          if (isHallucination(raw)) {
            setError('음성이 잘 인식되지 않았어요. 다시 시도해 주세요.');
            return;
          }
          // multiline이면 전체 문장(메모 본문), 아니면 첫 줄만(검색창)
          const text = multiline ? raw.trim() : raw.split('\n')[0].trim();
          if (text) onTranscript(text);
        }
      } catch {
        // 조용히 실패 (검색창은 그대로 유지)
      } finally {
        setStatus('idle');
      }
    };

    startedAtRef.current = Date.now();
    recorder.start();
    setStatus('recording');
  }, [onTranscript, multiline]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  }, []);

  const handleClick = () => {
    if (disabled) return;
    if (status === 'idle') {
      startRecording();
    } else if (status === 'recording') {
      stopRecording();
    }
  };

  if (status === 'processing') {
    return (
      <button
        disabled
        title="음성 변환 중..."
        className={`p-2.5 rounded-lg text-primary ${className ?? ''}`}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
      </button>
    );
  }

  if (status === 'recording') {
    return (
      <button
        onClick={handleClick}
        title="클릭하여 녹음 종료"
        className={`p-2.5 rounded-lg bg-red-50 text-red-500 animate-pulse ${className ?? ''}`}
      >
        <MicOff className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={error ?? '음성으로 입력'}
      className={`p-2.5 rounded-lg text-foreground-secondary hover:text-primary hover:bg-primary-tint transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className ?? ''}`}
    >
      <Mic className="w-4 h-4" />
    </button>
  );
}
