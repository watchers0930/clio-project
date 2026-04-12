'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

export interface UseAudioRecorderReturn {
  status: RecordingStatus;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  analyserNode: AnalyserNode | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

const MAX_DURATION_SECS = 600; // 10분 (Vercel 4.5MB 제한 대응)

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // 타이머 정리
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 스트림·AudioContext 정리
  const cleanup = useCallback(() => {
    clearTimer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setAnalyserNode(null);
  }, [clearTimer]);

  const startRecording = useCallback(async () => {
    // 브라우저 지원 체크
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('이 브라우저는 마이크 녹음을 지원하지 않습니다. 파일을 직접 업로드해 주세요.');
      return;
    }

    setError(null);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('마이크 접근 권한이 없습니다. 브라우저 주소창의 마이크 아이콘을 클릭하여 권한을 허용해 주세요.');
      return;
    }

    streamRef.current = stream;

    // AnalyserNode 연결 (파형 시각화용)
    try {
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      setAnalyserNode(analyser);
    } catch {
      // 파형 없이 녹음만 진행
      setAnalyserNode(null);
    }

    // MIME 타입 결정
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      // 기존 Object URL 해제
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setAudioBlob(blob);
      setAudioUrl(url);
      cleanup();
    };

    recorder.start(1000); // 1초 간격 chunk
    setStatus('recording');
    setDuration(0);

    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, [cleanup]);

  const stopRecording = useCallback(() => {
    clearTimer();
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    setStatus('stopped');
  }, [clearTimer]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      clearTimer();
      setStatus('paused');
    }
  }, [clearTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      setStatus('recording');
    }
  }, []);

  const resetRecording = useCallback(() => {
    clearTimer();
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    cleanup();
    // Object URL 메모리 해제
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setStatus('idle');
    setError(null);
    chunksRef.current = [];
  }, [clearTimer, cleanup]);

  // 10분 초과 자동 정지
  useEffect(() => {
    if (status === 'recording' && duration >= MAX_DURATION_SECS) {
      stopRecording();
    }
  }, [duration, status, stopRecording]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      clearTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [clearTimer]);

  return {
    status,
    duration,
    audioBlob,
    audioUrl,
    analyserNode,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
}

/** 초 → MM:SS 포맷 */
export function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
