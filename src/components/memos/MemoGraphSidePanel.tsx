'use client';

import { useRef, useState, useEffect } from 'react';
import { Pencil, Sparkles, X, Loader2 } from 'lucide-react';
import type { ForceGraphNode } from '@/types/memo-graph';

const COLOR_MAP: Record<string, string> = {
  default: '#94A3B8',
  blue: '#6366F1',
  green: '#22C55E',
  yellow: '#F59E0B',
  red: '#EF4444',
  purple: '#A855F7',
};

interface MemoGraphSidePanelProps {
  selected: ForceGraphNode[];
  onEdit: (memoId: string) => void;
  onClose: () => void;
}

export default function MemoGraphSidePanel({
  selected,
  onEdit,
  onClose,
}: MemoGraphSidePanelProps) {
  const [ideaText, setIdeaText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [ideaError, setIdeaError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ideaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIdeaText('');
    setIdeaError(null);
    abortRef.current?.abort();
  }, [selected.map((s) => s.id).join(',')]);

  const handleGenerateIdea = async () => {
    if (selected.length < 2 || generating) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setIdeaText('');
    setIdeaError(null);
    setGenerating(true);

    try {
      const res = await fetch('/api/memos/idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoIds: selected.map((s) => s.id) }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        setIdeaError('아이디어 생성 실패');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const { text, error } = JSON.parse(payload) as { text?: string; error?: string };
            if (error) { setIdeaError(error); break; }
            if (text) {
              setIdeaText((prev) => {
                const next = prev + text;
                setTimeout(() => {
                  ideaRef.current?.scrollTo({ top: ideaRef.current.scrollHeight });
                }, 0);
                return next;
              });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== 'AbortError') {
        setIdeaError('네트워크 오류');
      }
    } finally {
      setGenerating(false);
    }
  };

  if (selected.length === 0) return null;

  const accentColor = COLOR_MAP[selected[0].color] ?? COLOR_MAP.default;
  const isSingle = selected.length === 1;
  const node = selected[0];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단 컬러 스트라이프 */}
      <div style={{ height: 5, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)`, flexShrink: 0 }} />

      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
        style={{ borderColor: '#E2E8F0' }}
      >
        <span className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider">
          {isSingle ? '메모' : `메모 ${selected.length}개 선택`}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-[#F1F5F9] transition-colors"
        >
          <X size={14} className="text-[#94A3B8]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isSingle ? (
          <div className="px-6 py-5">
            <div className="h-[3px] rounded-full mb-5" style={{ backgroundColor: accentColor }} />
            <h3 className="text-[15px] font-semibold text-[#1E293B] leading-snug mb-4">
              {node.title}
            </h3>
            {node.content ? (
              <p className="text-[13px] text-[#475569] leading-[1.9] whitespace-pre-wrap">
                {node.content}
              </p>
            ) : (
              <p className="text-[12px] text-[#94A3B8] italic">내용 없음</p>
            )}
            <button
              onClick={() => onEdit(node.id)}
              className="mt-6 flex items-center gap-1.5 w-full justify-center py-2.5 text-[12px] font-medium rounded-lg border transition-colors"
              style={{ borderColor: accentColor, color: accentColor }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = accentColor + '15';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              <Pencil size={12} />
              수정하기
            </button>
          </div>
        ) : (
          <div className="px-6 py-5">
            <div className="space-y-2 mb-5">
              {selected.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLOR_MAP[n.color] ?? COLOR_MAP.default }}
                  />
                  <span className="text-[12px] text-[#334155] font-medium truncate">{n.title}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleGenerateIdea}
              disabled={generating}
              className="flex items-center gap-2 w-full justify-center py-2.5 text-[13px] font-semibold rounded-xl transition-all"
              style={{
                background: generating
                  ? '#E2E8F0'
                  : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                color: generating ? '#94A3B8' : 'white',
              }}
            >
              {generating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {generating ? '아이디어 생성 중...' : '아이디어 생성'}
            </button>

            {ideaError && (
              <p className="mt-3 text-[12px] text-red-500">{ideaError}</p>
            )}

            {ideaText && (
              <div
                ref={ideaRef}
                className="mt-4 max-h-[320px] overflow-y-auto rounded-xl p-4 text-[13px] text-[#1E293B] leading-[1.85] whitespace-pre-wrap"
                style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)', border: '1px solid #C7D2FE' }}
              >
                {ideaText}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
