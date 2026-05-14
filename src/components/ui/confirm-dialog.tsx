'use client';

import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

interface ConfirmDialogProps {
  open: boolean;
  /** 다이얼로그 제목 */
  title: string;
  /** 상세 설명 */
  description?: string;
  /** 확인 버튼 레이블 */
  confirmLabel?: string;
  /** 취소 버튼 레이블 */
  cancelLabel?: string;
  /** 확인 버튼 색상 (danger = 빨강, primary = 파랑) */
  variant?: 'danger' | 'primary';
  /** 처리 중 여부 */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'danger',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div className="bg-white rounded-[24px] shadow-xl w-full max-w-sm p-9 text-center sm:p-10">
        {/* 아이콘 */}
        <div className={cn(
          'w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center',
          variant === 'danger' ? 'bg-red-50' : 'bg-[#0071e3]/10'
        )}>
          {variant === 'danger' ? (
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          ) : (
            <svg className="w-7 h-7 text-[#0071e3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          )}
        </div>

        <h3 className="text-base font-semibold text-[#1d1d1f] mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-[#6e6e73] leading-relaxed mb-6">{description}</p>
        )}
        {!description && <div className="mb-6" />}

        <div className="flex gap-3.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex-1 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-2',
              variant === 'danger'
                ? 'bg-[#1d1d1f] hover:bg-[#2d2d2f]'
                : 'bg-[#0071e3] hover:bg-[#005bbf]'
            )}
          >
            {loading && <Spinner size="sm" variant="white" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
