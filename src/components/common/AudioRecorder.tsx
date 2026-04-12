'use client';

import { useEffect, useRef } from 'react';
import { Mic, Square, Pause, Play, RotateCcw } from 'lucide-react';
import { useAudioRecorder, formatDuration } from '@/hooks/useAudioRecorder';

interface AudioRecorderProps {
  onComplete: (blob: Blob) => void;
  onSwitchToUpload?: () => void; // 마이크 권한 거부 시 탭 전환 콜백
  className?: string;
}

const MAX_BLOB_SIZE = 4 * 1024 * 1024; // 4MB (Vercel 요청 제한 여유)

export function AudioRecorder({ onComplete, onSwitchToUpload, className }: AudioRecorderProps) {
  const {
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
  } = useAudioRecorder();

  // 파형 캔버스 ref (P2용 — 현재는 간단한 볼륨 바로 대체)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // 간단한 볼륨 바 애니메이션
  useEffect(() => {
    if (status !== 'recording' || !analyserNode || !canvasRef.current) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLen = analyserNode.frequencyBinCount;
    const data = new Uint8Array(bufferLen);

    function draw() {
      animFrameRef.current = requestAnimationFrame(draw);
      analyserNode!.getByteFrequencyData(data);

      ctx!.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 20;
      const barWidth = canvas.width / barCount - 2;
      const step = Math.floor(bufferLen / barCount);

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j];
        const avg = sum / step;
        const height = (avg / 255) * canvas.height;
        const x = i * (barWidth + 2);
        const y = (canvas.height - height) / 2;

        ctx!.fillStyle = '#2E6FF2';
        ctx!.beginPath();
        ctx!.roundRect(x, y, barWidth, Math.max(4, height), 2);
        ctx!.fill();
      }
    }

    draw();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [status, analyserNode]);

  const handleComplete = () => {
    if (!audioBlob) return;
    if (audioBlob.size > MAX_BLOB_SIZE) {
      alert('녹음 파일이 너무 큽니다. 10분 이내 녹음만 전송할 수 있습니다.');
      return;
    }
    onComplete(audioBlob);
  };

  // ── idle ──
  if (status === 'idle') {
    return (
      <div className={`flex flex-col items-center justify-center gap-6 py-10 ${className ?? ''}`}>
        {error ? (
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
            </div>
            <p className="text-sm text-[#6e6e73] leading-relaxed">{error}</p>
            {onSwitchToUpload && (
              <button
                onClick={onSwitchToUpload}
                className="px-4 py-2 rounded-lg text-sm text-[#2E6FF2] border border-[#2E6FF2] hover:bg-blue-50 transition-colors"
              >
                파일 업로드로 전환
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center">
              <Mic className="w-7 h-7 text-[#6e6e73]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#1d1d1f]">마이크로 직접 녹음하기</p>
              <p className="text-xs text-[#6e6e73] mt-1">최대 10분 · Chrome, Safari, Firefox 지원</p>
            </div>
            <button
              onClick={startRecording}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#2E6FF2] transition-colors"
            >
              <Mic className="w-4 h-4" />
              녹음 시작
            </button>
          </>
        )}
      </div>
    );
  }

  // ── recording / paused ──
  if (status === 'recording' || status === 'paused') {
    return (
      <div className={`flex flex-col items-center gap-5 py-8 ${className ?? ''}`}>
        {/* 상태 표시 */}
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              status === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-yellow-400'
            }`}
          />
          <span className="text-sm font-medium text-[#1d1d1f]">
            {status === 'recording' ? '녹음 중' : '일시정지'}
          </span>
          <span className="text-sm font-num text-[#6e6e73]">{formatDuration(duration)}</span>
        </div>

        {/* 파형 캔버스 */}
        <canvas
          ref={canvasRef}
          width={240}
          height={48}
          className="rounded-lg bg-[#f5f5f7]"
        />

        {/* 10분 남은 시간 경고 */}
        {duration >= 540 && (
          <p className="text-xs text-orange-500">최대 녹음 시간(10분)이 거의 다 됐어요</p>
        )}

        {/* 컨트롤 버튼 */}
        <div className="flex items-center gap-3">
          <button
            onClick={status === 'recording' ? pauseRecording : resumeRecording}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
          >
            {status === 'recording' ? (
              <><Pause className="w-4 h-4" /> 일시정지</>
            ) : (
              <><Play className="w-4 h-4" /> 재개</>
            )}
          </button>
          <button
            onClick={stopRecording}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-red-600 transition-colors"
          >
            <Square className="w-4 h-4" />
            정지
          </button>
        </div>
      </div>
    );
  }

  // ── stopped ──
  return (
    <div className={`flex flex-col items-center gap-5 py-8 ${className ?? ''}`}>
      {/* 완료 뱃지 */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <span className="text-sm font-medium text-[#1d1d1f]">
          녹음 완료 ({formatDuration(duration)})
        </span>
      </div>

      {/* 미리듣기 */}
      {audioUrl && (
        <audio
          src={audioUrl}
          controls
          className="w-full max-w-xs rounded-lg"
          style={{ height: 40 }}
        />
      )}

      {/* 버튼 */}
      <div className="flex items-center gap-3">
        <button
          onClick={resetRecording}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          다시 녹음
        </button>
        <button
          onClick={handleComplete}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2E6FF2] text-white text-sm font-medium hover:bg-[#1a5ad9] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          변환 시작
        </button>
      </div>
    </div>
  );
}
