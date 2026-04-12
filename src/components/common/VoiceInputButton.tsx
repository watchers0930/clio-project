'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  disabled?: boolean;
}

type VoiceStatus = 'idle' | 'recording' | 'processing';

export function VoiceInputButton({ onTranscript, className, disabled }: VoiceInputButtonProps) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

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

      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (blob.size < 1000) {
        setStatus('idle');
        return; // 너무 짧은 녹음 무시
      }

      setStatus('processing');

      try {
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const formData = new FormData();
        formData.append('file', blob, `voice.${ext}`);

        const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success && data.data?.transcript) {
          // 첫 줄만 검색창 입력용으로 사용 (줄바꿈 제거)
          const text = data.data.transcript.split('\n')[0].trim();
          onTranscript(text);
        }
      } catch {
        // 조용히 실패 (검색창은 그대로 유지)
      } finally {
        setStatus('idle');
      }
    };

    recorder.start();
    setStatus('recording');
  }, [onTranscript]);

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
        className={`p-2 rounded-lg text-[#2E6FF2] ${className ?? ''}`}
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
        className={`p-2 rounded-lg bg-red-50 text-red-500 animate-pulse ${className ?? ''}`}
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
      className={`p-2 rounded-lg text-[#6e6e73] hover:text-[#2E6FF2] hover:bg-[#f0f5ff] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className ?? ''}`}
    >
      <Mic className="w-4 h-4" />
    </button>
  );
}
