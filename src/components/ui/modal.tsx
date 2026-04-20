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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn(
          'bg-white rounded-2xl shadow-xl w-full mx-4 max-h-[85vh] overflow-y-auto',
          sizeStyles[size],
          className
        )}
      >
        {/* 헤더 */}
        {(title || description) && (
          <div className="relative flex flex-col items-center px-8 py-6 border-b border-border">
            {title && (
              <h2 className="text-[15px] font-semibold text-foreground text-center">{title}</h2>
            )}
            {description && (
              <p className="text-xs text-secondary text-center" style={{ marginTop: '2px' }}>{description}</p>
            )}
            <button
              onClick={onClose}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-[#aaa] hover:text-foreground transition-colors cursor-pointer"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* 헤더 없을 때 닫기 버튼 */}
        {!title && !description && (
          <div className="flex justify-end px-6 pt-4">
            <button
              onClick={onClose}
              className="text-[#aaa] hover:text-foreground transition-colors cursor-pointer"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* 컨텐츠 */}
        <div className="px-8 py-6">{children}</div>
      </div>
    </div>
  );
}

export { Modal };
export type { ModalProps };
