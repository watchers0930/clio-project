'use client';

import {
  useEffect,
  useRef,
  type ReactNode,
  type MouseEvent,
} from 'react';
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const handleBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={cn(
        'backdrop:bg-navy/40 backdrop:backdrop-blur-sm',
        'bg-transparent p-0 m-auto',
        'open:animate-in open:fade-in-0 open:zoom-in-95',
        'max-h-[90vh]'
      )}
    >
      <div
        className={cn(
          'bg-white rounded-xl shadow-xl border border-clio-border',
          'w-[calc(100vw-2rem)]',
          sizeStyles[size],
          className
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between px-6 pt-5 pb-0">
            <div>
              {title && (
                <h2 className="text-lg font-semibold text-clio-text">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm text-clio-text-secondary">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-clio-text-secondary hover:bg-clio-bg hover:text-clio-text transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Close button if no header */}
        {!title && !description && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-clio-text-secondary hover:bg-clio-bg hover:text-clio-text transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        )}

        {/* Content */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </dialog>
  );
}

export { Modal };
export type { ModalProps };
