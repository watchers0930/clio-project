'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

function Modal({
  open,
  onClose,
  children,
  title,
  description,
  className,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn(
          'mx-0 max-h-[90vh] w-full overflow-y-auto rounded-[24px] bg-white shadow-xl',
          sizeStyles[size],
          className
        )}
      >
        {/* 헤더 */}
        {(title || description) && (
          <div className="relative flex flex-col items-center border-b border-border px-6 py-6 sm:px-8 sm:py-7">
            {title && (
              <h2 className="text-[15px] font-semibold text-foreground text-center">{title}</h2>
            )}
            {description && (
              <p className="mt-3 text-center text-xs text-secondary">{description}</p>
            )}
            <button
              onClick={onClose}
              className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-[#aaa] transition-colors hover:text-foreground sm:right-6"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* 헤더 없을 때 닫기 버튼 */}
        {!title && !description && (
          <div className="flex justify-end px-5 pt-5 sm:px-7">
            <button
              onClick={onClose}
              className="text-[#aaa] hover:text-foreground transition-colors cursor-pointer"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* 컨텐츠 */}
        <div className="flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>
    </div>
  );
}

export { Modal };
export type { ModalProps };
