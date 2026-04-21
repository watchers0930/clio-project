'use client';

import { X, CheckCircle2 } from 'lucide-react';

export interface ExtractedTodo {
  id: string;
  title: string;
  priority: string;
}

interface MemoTodoConfirmModalProps {
  todos: ExtractedTodo[];
  onClose: () => void;
}

const PRIORITY_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  high:   { label: '상', color: '#EF4444', bg: '#FEF2F2' },
  medium: { label: '중', color: '#F59E0B', bg: '#FFFBEB' },
  low:    { label: '하', color: '#22C55E', bg: '#F0FDF4' },
};

export default function MemoTodoConfirmModal({ todos, onClose }: MemoTodoConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 400, maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
          style={{ borderColor: '#E2E8F0' }}
        >
          <h3 className="text-[15px] font-semibold text-[#1E293B]">할일 추출 결과</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[#F1F5F9] transition-colors"
          >
            <X size={14} className="text-[#94A3B8]" />
          </button>
        </div>

        {/* 할일 목록 */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div className="space-y-2">
            {todos.map((todo) => {
              const style = PRIORITY_STYLE[todo.priority] ?? PRIORITY_STYLE.medium;
              return (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                  style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}
                >
                  <CheckCircle2 size={15} className="flex-shrink-0" style={{ color: '#22C55E' }} />
                  <span className="flex-1 text-[13px] text-[#334155] leading-snug">{todo.title}</span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ color: style.color, background: style.bg }}
                  >
                    {style.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 푸터 */}
        <div
          className="px-6 py-5 border-t flex items-center justify-between flex-shrink-0"
          style={{ borderColor: '#E2E8F0' }}
        >
          <p className="text-[12px] text-[#94A3B8]">
            {todos.length}개 할일이 등록되었습니다.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-[13px] font-medium text-white rounded-xl hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
