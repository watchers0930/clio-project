'use client';

import { useRef, useState } from 'react';

/**
 * 회의록 '회의 내용' 입력 — 요약/결과 직접 입력 + 음성파일 STT.
 * 음성을 첨부하면 /api/transcribe(textOnly)로 전사·요약 텍스트를 받아 입력칸을 채우고,
 * 사용자가 수정·보완한다. 값은 documentInputs.meeting_summary / meeting_result 로 저장된다.
 */
export function MeetingContentInput({
  summaryValue,
  resultValue,
  onChangeSummary,
  onChangeResult,
}: {
  summaryValue: string;
  resultValue: string;
  onChangeSummary: (v: string) => void;
  onChangeResult: (v: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const taCls = 'w-full px-3 py-2.5 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary';

  const handleAudio = async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('textOnly', 'true');
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? '음성 변환에 실패했습니다.');
        return;
      }
      // 요약을 회의 내용에, 후속 액션을 회의 결과에 채운다(비어 있을 때만 덮지 않도록 기존값 유지 선택 가능하나 STT는 새로 채움)
      onChangeSummary(data.summary || data.transcript || '');
      if (Array.isArray(data.actionItems) && data.actionItems.length > 0) {
        onChangeResult(data.actionItems.map((a: string) => `- ${a}`).join('\n'));
      }
    } catch {
      setError('음성 변환 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <p className="text-sm font-medium text-foreground">회의 내용</p>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => handleAudio(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-tint disabled:opacity-50"
          >
            {loading ? '변환 중…' : '🎙 음성파일로 작성(STT)'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-danger" style={{ marginBottom: 6 }}>{error}</p>}

      <label className="block text-xs text-foreground-secondary" style={{ marginBottom: 6 }}>회의 내용 (요약)</label>
      <textarea
        value={summaryValue}
        onChange={(e) => onChangeSummary(e.target.value)}
        rows={5}
        placeholder="회의에서 논의한 핵심 쟁점과 배경을 정리하세요. (음성파일 첨부 시 자동 채워집니다)"
        className={taCls}
        style={{ marginBottom: 12 }}
      />

      <label className="block text-xs text-foreground-secondary" style={{ marginBottom: 6 }}>회의 결과</label>
      <textarea
        value={resultValue}
        onChange={(e) => onChangeResult(e.target.value)}
        rows={4}
        placeholder="결정 사항, 액션 아이템, 후속 일정을 정리하세요."
        className={taCls}
      />
    </div>
  );
}
