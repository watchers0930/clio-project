'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Loader2, Save, CheckSquare, FileText } from 'lucide-react';
import { useMemoIdea } from '@/hooks/useMemoIdea';
import MemoTodoConfirmModal, { type ExtractedTodo } from './memo-todo-confirm-modal';

interface MemoIdeaPanelProps {
  memoIds: string[];
  memoCount: number;
  onClose: () => void;
  onMemoSaved?: () => void;
}

export default function MemoIdeaPanel({
  memoIds,
  memoCount,
  onClose,
  onMemoSaved,
}: MemoIdeaPanelProps) {
  const { text, loading, done, error, generate, reset } = useMemoIdea();
  const [savingMemo, setSavingMemo] = useState(false);
  const [extractingTodos, setExtractingTodos] = useState(false);
  const [extractedTodos, setExtractedTodos] = useState<ExtractedTodo[]>([]);
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  // memoIds가 바뀌면 새 아이디어 자동 생성
  const memoKey = memoIds.join(',');
  useEffect(() => {
    reset();
    if (memoIds.length >= 2) generate(memoIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoKey]);

  // 스트리밍 중 자동 스크롤
  useEffect(() => {
    if (textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight;
    }
  }, [text]);

  const handleSaveMemo = async () => {
    if (!text || savingMemo) return;
    setSavingMemo(true);
    try {
      const res = await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '💡 AI 아이디어', content: text, color: 'blue' }),
      });
      const result = await res.json() as { success: boolean; data?: { id: string } };
      if (result.success) {
        if (result.data?.id) {
          fetch(`/api/memos/${result.data.id}/embed`, { method: 'POST' }).catch(() => {});
        }
        onMemoSaved?.();
        onClose();
      }
    } finally {
      setSavingMemo(false);
    }
  };

  const handleExtractTodos = async () => {
    if (!text || extractingTodos) return;
    setExtractingTodos(true);
    try {
      const res = await fetch('/api/todos/from-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaText: text }),
      });
      const result = await res.json() as {
        success: boolean;
        data?: ExtractedTodo[];
        error?: string;
      };
      if (result.success && result.data) {
        setExtractedTodos(result.data);
        setTodoModalOpen(true);
      }
    } finally {
      setExtractingTodos(false);
    }
  };

  const actionsEnabled = done && !loading;

  return (
    <>
      <div
        className="flex flex-col h-full border-l flex-shrink-0"
        style={{ width: 420, background: 'white', borderColor: '#E2E8F0' }}
      >
        {/* 상단 그라디언트 스트라이프 */}
        <div
          style={{ height: 4, background: 'linear-gradient(90deg, #6366F1 0%, #8B5CF6 100%)', flexShrink: 0 }}
        />

        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: '#E2E8F0' }}
        >
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-[#6366F1]" />
              <span className="text-[13px] font-semibold text-[#1E293B]">아이디어 생성</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">선택한 메모 {memoCount}개 기반</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
          >
            <X size={14} className="text-[#94A3B8]" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div ref={textRef} className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-[13px] text-red-500 text-center">{error}</p>
              <button
                onClick={() => generate(memoIds)}
                className="px-4 py-2 text-[12px] font-medium text-[#6366F1] border border-[#6366F1] rounded-lg hover:bg-[#6366F1]/5 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : loading && !text ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-[#94A3B8]">
              <Loader2 size={16} className="animate-spin text-[#6366F1]" />
              <span>아이디어를 생성하고 있습니다...</span>
            </div>
          ) : (
            <div className="text-[13px] text-[#1E293B] leading-[1.85] whitespace-pre-wrap">
              {text}
              {loading && (
                <span className="inline-block w-[2px] h-[14px] bg-[#6366F1] animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          )}
        </div>

        {/* 액션 버튼 (스트리밍 완료 후 활성화) */}
        {(done || !!text) && (
          <div
            className="px-5 py-4 border-t flex gap-2 flex-shrink-0"
            style={{ borderColor: '#E2E8F0' }}
          >
            <button
              onClick={handleSaveMemo}
              disabled={!actionsEnabled || savingMemo}
              className="flex items-center gap-1.5 flex-1 justify-center py-2.5 text-[12px] font-medium rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#6366F1]/5"
              style={{ borderColor: '#6366F1', color: '#6366F1' }}
            >
              {savingMemo ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              메모로 저장
            </button>
            <button
              onClick={handleExtractTodos}
              disabled={!actionsEnabled || extractingTodos}
              className="flex items-center gap-1.5 flex-1 justify-center py-2.5 text-[12px] font-medium rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#22C55E]/5"
              style={{ borderColor: '#22C55E', color: '#22C55E' }}
            >
              {extractingTodos ? <Loader2 size={12} className="animate-spin" /> : <CheckSquare size={12} />}
              할일 추출
            </button>
            <button
              disabled={true}
              className="flex items-center gap-1.5 flex-1 justify-center py-2.5 text-[12px] font-medium rounded-xl border opacity-40 cursor-not-allowed"
              style={{ borderColor: '#94A3B8', color: '#94A3B8' }}
              title="Phase 4 — 추후 지원"
            >
              <FileText size={12} />
              문서 생성
            </button>
          </div>
        )}
      </div>

      {/* 할일 확인 모달 */}
      {todoModalOpen && (
        <MemoTodoConfirmModal
          todos={extractedTodos}
          onClose={() => setTodoModalOpen(false)}
        />
      )}
    </>
  );
}
