'use client';

import { useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDialogA11y } from '@/hooks/use-dialog-a11y';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
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
  const panelRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const descId = `${reactId}-desc`;

  // Escape 닫기·Tab 초점 가두기·초점 복원 — 공용 hook(창이 겹치면 맨 위 창만 반응)
  useDialogA11y(open, onClose, panelRef);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        aria-label={title ? undefined : '대화상자'}
        tabIndex={-1}
        className={cn(
          'mx-0 max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-xl outline-none',
          sizeStyles[size],
          className
        )}
      >
        {/* 헤더 */}
        {(title || description) && (
          <div className="relative flex flex-col items-center border-b border-border px-6 py-6 sm:px-8 sm:py-7">
            {title && (
              <h2 id={titleId} className="text-[15px] font-semibold text-foreground text-center">{title}</h2>
            )}
            {description && (
              <p id={descId} className="mt-3 text-center text-xs text-secondary">{description}</p>
            )}
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-foreground-quaternary transition-colors hover:text-foreground sm:right-6"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* 헤더 없을 때 닫기 버튼 */}
        {!title && !description && (
          <div className="flex justify-end px-5 pt-5 sm:px-7">
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="text-foreground-quaternary hover:text-foreground transition-colors cursor-pointer"
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
