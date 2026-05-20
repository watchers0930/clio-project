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
  onSaveMemo: (text: string) => Promise<void>;
  onExtractTodos: (text: string) => Promise<ExtractedTodo[]>;
  onCreateDocument: () => Promise<void>;
  creatingDocument?: boolean;
  createDocumentError?: string | null;
}

export default function MemoIdeaPanel({
  memoIds,
  memoCount,
  onClose,
  onMemoSaved,
  onSaveMemo,
  onExtractTodos,
  onCreateDocument,
  creatingDocument = false,
  createDocumentError = null,
}: MemoIdeaPanelProps) {
  const { text, loading, done, error, generate, reset } = useMemoIdea();
  const [savingMemo, setSavingMemo] = useState(false);
  const [extractingTodos, setExtractingTodos] = useState(false);
  const [extractedTodos, setExtractedTodos] = useState<ExtractedTodo[]>([]);
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const [todoError, setTodoError] = useState<string | null>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // memoIds가 바뀌면 새 아이디어 자동 생성
  const memoKey = [...memoIds].sort().join(',');
  useEffect(() => {
    reset();
    setExtractedTodos([]);
    setTodoModalOpen(false);
    setTodoError(null);
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
      await onSaveMemo(text);
      onMemoSaved?.();
    } finally {
      setSavingMemo(false);
    }
  };

  const handleExtractTodos = async () => {
    if (!text || extractingTodos) return;
    setExtractingTodos(true);
    setTodoError(null);
    try {
      const todos = await onExtractTodos(text);
      if (todos.length === 0) {
        setExtractedTodos([]);
        setTodoModalOpen(true);
        return;
      }
      setExtractedTodos(todos);
      setTodoModalOpen(true);
    } catch (error) {
      setTodoError(error instanceof Error ? error.message : '할일 추출에 실패했습니다');
    } finally {
      setExtractingTodos(false);
    }
  };

  const handleCreateDocument = async () => {
    if (!actionsEnabled || creatingDocument) return;
    await onCreateDocument();
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
              <Sparkles size={15} className="text-indigo-500" />
              <span className="text-[13px] font-semibold text-foreground">아이디어 생성</span>
            </div>
            <p className="text-[11px] text-foreground-quaternary mt-0.5">선택한 메모 {memoCount}개 기반</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-surface-secondary transition-colors"
          >
            <X size={14} className="text-foreground-quaternary" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div ref={textRef} className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-[13px] text-red-500 text-center">{error}</p>
              <button
                onClick={() => generate(memoIds)}
                className="px-4 py-2 text-[12px] font-medium text-indigo-500 border border-indigo-500 rounded-lg hover:bg-indigo-500/5 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : loading && !text ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-foreground-quaternary">
              <Loader2 size={16} className="animate-spin text-indigo-500" />
              <span>아이디어를 생성하고 있습니다...</span>
            </div>
          ) : (
            <div className="text-[13px] text-foreground leading-[1.85] whitespace-pre-wrap">
              {text}
              {loading && (
                <span className="inline-block w-[2px] h-[14px] bg-indigo-500 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          )}
        </div>

        {/* 액션 버튼 (스트리밍 완료 후 활성화) */}
        {(done || !!text) && (
          <div
            className="px-5 py-4 border-t flex flex-col gap-2 flex-shrink-0"
            style={{ borderColor: '#E2E8F0' }}
          >
            <div className="flex gap-2">
              <button
                onClick={handleSaveMemo}
                disabled={!actionsEnabled || savingMemo}
                className="flex items-center gap-1.5 flex-1 justify-center py-2.5 text-[12px] font-medium rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-indigo-500/5"
                style={{ borderColor: '#6366F1', color: '#6366F1' }}
              >
                {savingMemo ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                메모로 저장
              </button>
              <button
                onClick={handleExtractTodos}
                disabled={!actionsEnabled || extractingTodos}
                className="flex items-center gap-1.5 flex-1 justify-center py-2.5 text-[12px] font-medium rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-success/5"
                style={{ borderColor: '#22C55E', color: '#22C55E' }}
              >
                {extractingTodos ? <Loader2 size={12} className="animate-spin" /> : <CheckSquare size={12} />}
                할일 추출
              </button>
              <button
                onClick={handleCreateDocument}
                disabled={!actionsEnabled || creatingDocument}
                className="flex items-center gap-1.5 flex-1 justify-center py-2.5 text-[12px] font-medium rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-primary/5"
                style={{ borderColor: '#2563EB', color: '#2563EB' }}
              >
                {creatingDocument ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                문서 생성
              </button>
            </div>
            {todoError && (
              <p className="text-center text-[11px] text-red-500">{todoError}</p>
            )}
            {createDocumentError && (
              <p className="text-center text-[11px] text-red-500">{createDocumentError}</p>
            )}
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
