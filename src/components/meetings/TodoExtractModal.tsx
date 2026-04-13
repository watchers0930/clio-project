'use client';

import { useState, useEffect } from 'react';
import { X, RefreshCw, CheckSquare, Square, AlertCircle, CalendarDays, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExtractedTodo } from '@/lib/ai/extract-todos';

interface TodoExtractModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  initialTodos: ExtractedTodo[];  // /api/transcribe 응답 또는 빈 배열 (재추출 트리거)
  onSuccess: (count: number) => void;
}

const PRIORITY_BADGE: Record<string, { label: string; cls: string }> = {
  high:   { label: '높음', cls: 'bg-red-50 text-red-600 border-red-200' },
  medium: { label: '보통', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  low:    { label: '낮음', cls: 'bg-green-50 text-green-700 border-green-200' },
};

export function TodoExtractModal({
  isOpen,
  onClose,
  documentId,
  documentTitle,
  initialTodos,
  onSuccess,
}: TodoExtractModalProps) {
  const [todos, setTodos] = useState<ExtractedTodo[]>(initialTodos);
  const [checkedIdx, setCheckedIdx] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);       // 등록 중
  const [isReExtracting, setIsReExtracting] = useState(false); // 재추출 중
  const [error, setError] = useState<string | null>(null);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (initialTodos.length > 0) {
      setTodos(initialTodos);
      // 전체 선택 상태로 시작
      setCheckedIdx(new Set(initialTodos.map((_, i) => i)));
    } else {
      // initialTodos 비어있으면 자동 재추출
      handleReExtract();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // ── 재추출 ───────────────────────────────────────────────────────────────
  const handleReExtract = async () => {
    setIsReExtracting(true);
    setError(null);
    try {
      const res = await fetch('/api/todos/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, reExtract: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? '재추출에 실패했습니다.');
        return;
      }
      const extracted: ExtractedTodo[] = json.data?.extractedTodos ?? [];
      setTodos(extracted);
      setCheckedIdx(new Set(extracted.map((_, i) => i)));
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsReExtracting(false);
    }
  };

  // ── 등록 ─────────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    const selected = todos.filter((_, i) => checkedIdx.has(i));
    if (selected.length === 0) {
      setError('등록할 항목을 선택해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/todos/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, selectedTodos: selected }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? '등록에 실패했습니다.');
        return;
      }
      onSuccess(json.data?.inserted ?? selected.length);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── 체크 토글 ────────────────────────────────────────────────────────────
  const toggleAll = () => {
    if (checkedIdx.size === todos.length) {
      setCheckedIdx(new Set());
    } else {
      setCheckedIdx(new Set(todos.map((_, i) => i)));
    }
  };

  const toggle = (idx: number) => {
    setCheckedIdx(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const checkedCount = checkedIdx.size;
  const allChecked = todos.length > 0 && checkedIdx.size === todos.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]">
        {/* 헤더 */}
        <div className="px-6 py-5 border-b border-[#E2E5EA] flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1B1F2B]">할일 자동 추출 결과</h2>
            <p className="text-[12px] text-[#888] mt-0.5 truncate max-w-xs">문서: {documentTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#F7F8FA] text-[#888] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 로딩 (재추출 중) */}
        {isReExtracting && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
            <svg className="animate-spin w-8 h-8 text-[#2E6FF2]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-[13px] text-[#888]">AI가 할일을 추출하는 중...</p>
          </div>
        )}

        {/* 본문 */}
        {!isReExtracting && (
          <>
            {/* 컨트롤 바 */}
            <div className="px-6 py-3 border-b border-[#E2E5EA] flex items-center justify-between flex-shrink-0">
              <button
                onClick={toggleAll}
                className="flex items-center gap-1.5 text-[12px] text-[#555] hover:text-[#1B1F2B] transition-colors"
              >
                {allChecked
                  ? <CheckSquare size={15} className="text-[#2E6FF2]" />
                  : <Square size={15} className="text-[#aaa]" />}
                전체 선택 ({todos.length}개 항목)
              </button>
              <button
                onClick={handleReExtract}
                disabled={isReExtracting}
                className="flex items-center gap-1 text-[12px] text-[#2E6FF2] hover:text-[#1E5FE2] transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} />
                다시 추출
              </button>
            </div>

            {/* 할일 목록 */}
            <div className="flex-1 overflow-y-auto px-6 py-3 flex flex-col gap-2">
              {todos.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[24px] mb-2">📭</p>
                  <p className="text-[13px] text-[#888]">추출된 할일 항목이 없습니다.</p>
                  <p className="text-[11px] text-[#aaa] mt-1">회의 내용에 액션 아이템이 포함되어 있지 않거나,<br />다시 추출하기를 시도해보세요.</p>
                </div>
              ) : (
                todos.map((todo, idx) => {
                  const badge = PRIORITY_BADGE[todo.priority] ?? PRIORITY_BADGE.medium;
                  const isChecked = checkedIdx.has(idx);

                  return (
                    <div
                      key={idx}
                      onClick={() => toggle(idx)}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                        isChecked
                          ? 'border-[#2E6FF2] bg-blue-50/50'
                          : 'border-[#E2E5EA] bg-white hover:border-[#2E6FF2]/50',
                      )}
                    >
                      {isChecked
                        ? <CheckSquare size={16} className="text-[#2E6FF2] flex-shrink-0 mt-0.5" />
                        : <Square size={16} className="text-[#ccc] flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1B1F2B] leading-snug">{todo.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', badge.cls)}>
                            {badge.label}
                          </span>
                          {todo.assigneeName && (
                            <span className="flex items-center gap-1 text-[11px] text-[#888]">
                              <User size={11} />
                              {todo.assigneeName}
                            </span>
                          )}
                          {todo.dueDate && (
                            <span className="flex items-center gap-1 text-[11px] text-[#888]">
                              <CalendarDays size={11} />
                              {todo.dueDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 에러 */}
            {error && (
              <div className="mx-6 mb-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-red-700">{error}</p>
              </div>
            )}

            {/* 하단 버튼 */}
            <div className="px-6 py-4 border-t border-[#E2E5EA] flex items-center justify-end gap-2 flex-shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-[#E2E5EA] text-[13px] text-[#555] hover:bg-[#F7F8FA] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleRegister}
                disabled={isLoading || checkedCount === 0}
                className={cn(
                  'px-4 py-2 rounded-lg text-[13px] font-medium transition-all',
                  checkedCount > 0 && !isLoading
                    ? 'bg-[#2E6FF2] text-white hover:bg-[#1E5FE2]'
                    : 'bg-[#E2E5EA] text-[#aaa] cursor-not-allowed',
                )}
              >
                {isLoading ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    등록 중...
                  </span>
                ) : `선택 항목 등록 (${checkedCount}개)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
