'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

// 너무 짧은 녹음은 무음일 확률이 높아 STT로 보내지 않는다(환각 방지).
const MIN_DURATION_MS = 800;
const MIN_BLOB_BYTES = 2000;
// 녹음 중 감지된 최대 음량(0~128 편차)이 이 값 미만이면 무음/노이즈로 보고 STT를 호출하지 않는다.
// 근본 대응: 환각의 원인인 "무음/노이즈 오디오"를 Whisper에 아예 보내지 않는다.
const SILENCE_PEAK_THRESHOLD = 12;

// Whisper가 무음/노이즈에서 흔히 뱉는 환각(유튜브 아웃트로·뉴스 클로징). 원문 기준 정규식.
const HALLUCINATION_REGEXES: RegExp[] = [
  /^(지금까지|오늘도)?\s*시청(해|해\s*)?주셔서\s*감사합니다\.?$/,
  /^(mbc|kbs|sbs|jtbc|ytn|채널a|tv조선|연합뉴스)\s*뉴스\s*.{2,6}(입니다|이었습니다)\.?$/i,
  /^구독(과|,)?\s*좋아요(와|,)?\s*(알림\s*설정)?\s*부탁(드립니다|해요)\.?$/,
  /^다음\s*(영상|시간|편|시간에)에?(서)?\s*(만나요|뵙겠습니다|봬요|봅시다)\.?$/,
  /^한글\s*자막\s*(by|제공).*$/i,
];

// 공백·구두점을 제거해 비교하는 백업 목록.
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
  const t = text.trim();
  if (!t) return true;
  if (HALLUCINATION_REGEXES.some((re) => re.test(t))) return true;
  const n = normalizeForCompare(t);
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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const maxAmpRef = useRef<number>(0);

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

    // 녹음 중 실제 음량을 측정해 무음/노이즈 여부를 판단한다(환각 원천 차단).
    maxAmpRef.current = 0;
    try {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      // iOS Safari는 suspended 상태로 시작 → 측정값이 0이 되어 정상 발화를 오차단할 수 있으므로 재개
      audioCtx.resume().catch(() => {});
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const measure = () => {
        if (mediaRecorderRef.current?.state !== 'recording') return;
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const dev = Math.abs(buf[i] - 128);
          if (dev > peak) peak = dev;
        }
        if (peak > maxAmpRef.current) maxAmpRef.current = peak;
        rafRef.current = requestAnimationFrame(measure);
      };
      rafRef.current = requestAnimationFrame(measure);
    } catch {
      // 음량 측정 불가 환경에서는 측정을 건너뛴다(무음 컷은 시간·크기·환각필터가 대신 방어).
      maxAmpRef.current = SILENCE_PEAK_THRESHOLD; // 컷에 걸리지 않도록 통과 처리
    }

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
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;

      const elapsed = Date.now() - startedAtRef.current;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      // 너무 짧거나 작은 녹음은 무음일 확률이 높아 STT로 보내지 않는다(환각 방지)
      if (elapsed < MIN_DURATION_MS || blob.size < MIN_BLOB_BYTES) {
        setError('너무 짧아요. 버튼을 누른 뒤 또렷하게 말하고 다시 눌러 종료하세요.');
        setStatus('idle');
        return;
      }
      // 근본 방어: 실제 음량이 사람 목소리 수준에 못 미치면(무음/노이즈) STT를 호출하지 않는다
      if (maxAmpRef.current < SILENCE_PEAK_THRESHOLD) {
        setError('소리가 감지되지 않았어요. 마이크에 가까이서 또렷하게 말해 주세요.');
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
