'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const descId = `${reactId}-desc`;

  // 초점 관리(F10): 열릴 때만 초점을 패널 안으로 옮기고, 닫힌 뒤 트리거로 복원한다.
  // deps는 [open]만 — onClose가 매 렌더 새 함수여도 입력 중 초점을 빼앗지 않는다.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null;
    const panel = panelRef.current;
    if (panel) {
      const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      (items.length > 0 ? items[0] : panel).focus();
    }
    return () => {
      // 닫힌 뒤 열기 직전 초점을 가졌던 요소로 복원(키보드 흐름 유지).
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Escape 닫기 + Tab 초점 가두기. 리스너만 재바인딩하므로 재실행이 초점을 옮기지 않는다.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === panel,
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

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
