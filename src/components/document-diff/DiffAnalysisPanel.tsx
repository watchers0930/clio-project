'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiffResult } from '@/lib/utils/myers-diff';

interface DiffAnalysisPanelProps {
  diffResult: DiffResult;
  documentType?: string;
  perspective?: 'buyer' | 'seller';
  baseDocumentId: string;
  documentTitle?: string;
}

function parseSSELine(line: string): { event?: string; data?: string } {
  if (line.startsWith('event: ')) return { event: line.slice(7).trim() };
  if (line.startsWith('data: ')) return { data: line.slice(6).trim() };
  return {};
}

export function DiffAnalysisPanel({
  diffResult,
  documentType,
  perspective,
  baseDocumentId,
  documentTitle = '',
}: DiffAnalysisPanelProps) {
  const [streamText, setStreamText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const hasChanges =
    diffResult.stats.added + diffResult.stats.removed + diffResult.stats.changed > 0;

  async function startAnalysis() {
    if (isStreaming) return;
    setStreamText('');
    setError(null);
    setIsStreaming(true);
    setStarted(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/documents/${baseDocumentId}/diff/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diffResult, contractType: documentType, perspective, title: documentTitle }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setError('AI 해석 요청에 실패했습니다.');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const { event, data } = parseSSELine(line);
          if (event) {
            currentEvent = event;
          } else if (data !== undefined) {
            if (currentEvent === 'chunk') {
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) setStreamText((prev) => prev + parsed.text);
              } catch {
                // ignore malformed chunk
              }
            } else if (currentEvent === 'error') {
              try {
                const parsed = JSON.parse(data);
                setError(parsed.message ?? 'AI 해석에 실패했습니다.');
              } catch {
                setError('AI 해석에 실패했습니다.');
              }
            } else if (currentEvent === 'done') {
              setIsStreaming(false);
            }
            currentEvent = '';
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('네트워크 오류가 발생했습니다.');
      }
    } finally {
      setIsStreaming(false);
    }
  }

  // 컴포넌트 언마운트 시 스트림 중단
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (!hasChanges) return null;

  return (
    <div className="border border-[#E2E5EA] rounded-xl overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#F7F8FA] border-b border-[#E2E5EA]">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-[#2E6FF2]" />
          <span className="text-[13px] font-semibold text-[#1B1F2B]">AI 변경 분석</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[11px] text-[#888]">
              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              분석 중...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!started && (
            <button
              onClick={startAnalysis}
              className="text-[12px] px-3 py-1.5 rounded-lg bg-[#2E6FF2] text-white hover:bg-[#1E5FE2] transition-colors"
            >
              분석 시작
            </button>
          )}
          {started && !isStreaming && (
            <button
              onClick={startAnalysis}
              className="text-[11px] text-[#2E6FF2] hover:underline"
            >
              재분석
            </button>
          )}
          <button
            onClick={() => setCollapsed((p) => !p)}
            className="p-1 rounded hover:bg-[#ECEDF0] text-[#888] transition-colors"
          >
            {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {/* 본문 */}
      {!collapsed && (
        <div className="px-4 py-3">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-3">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-700">{error}</p>
            </div>
          )}

          {!started && !error && (
            <p className="text-[13px] text-[#888] py-4 text-center">
              &quot;분석 시작&quot; 버튼을 눌러 변경 내용을 AI로 해석하세요.
            </p>
          )}

          {started && !streamText && !error && isStreaming && (
            <p className="text-[13px] text-[#888] py-4 text-center">AI가 변경 내용을 분석하는 중...</p>
          )}

          {streamText && (
            <div
              className={cn(
                'text-[13px] text-[#1B1F2B] leading-relaxed whitespace-pre-wrap',
                isStreaming && 'after:content-["▌"] after:animate-pulse after:text-[#2E6FF2]',
              )}
            >
              {streamText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
