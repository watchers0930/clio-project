'use client';

import { useEffect, useRef, useState } from 'react';
import { X, FileText, StickyNote, ListTodo, CheckCircle2 } from 'lucide-react';
import { Spinner } from '@/components/ui';
import IdeaCard from './IdeaCard';
import type { MemoGroup } from '@/hooks/useMemoGroups';

interface Idea {
  index: number;
  title: string;
  description: string;
  effect: string;
}

interface IdeaSuggestPanelProps {
  open: boolean;
  group: MemoGroup | null;
  onClose: () => void;
  onSaveAsMemo: (content: string) => void;
  onCreateDocument: (content: string) => void;
}

type TodoStatus = 'idle' | 'loading' | 'done' | 'error';

export default function IdeaSuggestPanel({
  open,
  group,
  onClose,
  onSaveAsMemo,
  onCreateDocument,
}: IdeaSuggestPanelProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [todoStatus, setTodoStatus] = useState<TodoStatus>('idle');
  const [todoCount, setTodoCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // 패널 열릴 때마다 초기화 + 스트리밍 시작
  useEffect(() => {
    if (!open || !group) return;

    setIdeas([]);
    setStreamError(null);
    setLoading(true);
    setTodoStatus('idle');
    setTodoCount(0);

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch('/api/memos/groups/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: group.id, groupName: group.name }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) throw new Error('제안 생성에 실패했습니다');

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
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const parsed = JSON.parse(raw) as {
                type: string;
                index?: number;
                title?: string;
                description?: string;
                effect?: string;
              };
              if (parsed.type === 'idea') {
                setIdeas((prev) => [
                  ...prev,
                  {
                    index: parsed.index ?? prev.length + 1,
                    title: parsed.title ?? '',
                    description: parsed.description ?? '',
                    effect: parsed.effect ?? '',
                  },
                ]);
              }
            } catch {
              console.warn('[IdeaSuggestPanel] SSE parse failed:', raw);
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setStreamError(err instanceof Error ? err.message : '제안 생성에 실패했습니다');
      } finally {
        setLoading(false);
      }
    })();

    return () => { controller.abort(); };
  }, [open, group]);

  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  const buildIdeaText = (): string => {
    if (!group) return '';
    return ideas
      .map((idea) => `${idea.index}. ${idea.title}\n설명: ${idea.description}\n예상 효과: ${idea.effect}`)
      .join('\n\n');
  };

  const handleConvertToTodos = async () => {
    if (ideas.length === 0 || !group) return;
    setTodoStatus('loading');
    try {
      const res = await fetch('/api/todos/from-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaText: buildIdeaText(), groupName: group.name }),
      });
      const result = await res.json() as { success: boolean; count?: number; error?: string };
      if (result.success) {
        setTodoCount(result.count ?? 0);
        setTodoStatus('done');
      } else {
        throw new Error(result.error ?? '등록 실패');
      }
    } catch (err: unknown) {
      console.warn('[IdeaSuggestPanel] todo convert error:', err);
      setTodoStatus('error');
    }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={onClose} />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white border-l border-[#E2E5EA] shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#E2E5EA] flex-shrink-0">
          <div>
            <p className="text-[15px] font-semibold text-[#1B1F2B]">아이디어 제안</p>
            {group && (
              <p className="text-[12px] text-[#A0A7B5] mt-0.5">{group.name} 기반</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A0A7B5] hover:bg-[#F7F8FA] hover:text-[#1B1F2B] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && ideas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Spinner size="md" />
              <p className="text-[13px] text-[#A0A7B5]">아이디어를 생각하는 중...</p>
            </div>
          )}

          {streamError && (
            <div className="text-center py-10">
              <p className="text-[13px] text-red-500">{streamError}</p>
            </div>
          )}

          {ideas.length > 0 && (
            <div className="flex flex-col gap-3">
              {ideas.map((idea) => (
                <IdeaCard
                  key={idea.index}
                  index={idea.index}
                  title={idea.title}
                  description={idea.description}
                  effect={idea.effect}
                />
              ))}
              {loading && (
                <div className="flex items-center gap-2 py-2 pl-1">
                  <Spinner size="sm" />
                  <span className="text-[12px] text-[#A0A7B5]">더 생각하는 중...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        {ideas.length > 0 && !loading && (
          <div className="px-6 py-4 border-t border-[#E2E5EA] flex flex-col gap-2 flex-shrink-0">

            {/* 실행 계획으로 만들기 */}
            {todoStatus === 'done' ? (
              <div className="flex items-center justify-center gap-2 w-full py-2.5 text-[13px] font-medium text-[#16A34A] bg-[#F0FDF4] rounded-lg border border-[#BBF7D0]">
                <CheckCircle2 size={14} />
                할일 {todoCount}개가 등록되었습니다
              </div>
            ) : (
              <button
                onClick={handleConvertToTodos}
                disabled={todoStatus === 'loading'}
                className="flex items-center justify-center gap-2 w-full py-2.5 text-[13px] font-medium text-white rounded-lg transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#1B1F2B' }}
                onMouseEnter={(e) => {
                  if (todoStatus !== 'loading') (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2E3445';
                }}
                onMouseLeave={(e) => {
                  if (todoStatus !== 'loading') (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1B1F2B';
                }}
              >
                {todoStatus === 'loading' ? (
                  <><Spinner size="sm" />할일 분석 중...</>
                ) : (
                  <><ListTodo size={14} />실행 계획으로 만들기</>
                )}
              </button>
            )}

            {todoStatus === 'error' && (
              <p className="text-[11px] text-red-500 text-center">등록에 실패했습니다. 다시 시도해 주세요.</p>
            )}

            <button
              onClick={() => onCreateDocument(buildIdeaText())}
              className="flex items-center justify-center gap-2 w-full py-2.5 text-[13px] font-medium text-white rounded-lg transition-colors"
              style={{ backgroundColor: '#2E6FF2' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1A5AD9'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2E6FF2'; }}
            >
              <FileText size={14} />
              문서로 생성
            </button>

            <button
              onClick={() => onSaveAsMemo(buildIdeaText())}
              className="flex items-center justify-center gap-2 w-full py-2.5 text-[13px] font-medium text-[#1B1F2B] border border-[#E2E5EA] rounded-lg hover:bg-[#F7F8FA] transition-colors"
            >
              <StickyNote size={14} />
              메모로 저장
            </button>
          </div>
        )}
      </div>
    </>
  );
}
