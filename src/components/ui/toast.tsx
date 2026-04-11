'use client';

import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { create } from 'zustand';
import { cn } from '@/lib/utils';

/* ── store ── */
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  show: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** 편의 훅 */
export function useToast() {
  const show = useToastStore((s) => s.show);
  return {
    success: (msg: string) => show(msg, 'success'),
    error: (msg: string) => show(msg, 'error'),
    info: (msg: string) => show(msg, 'info'),
  };
}

/* ── renderer (AppLayout에 한 번만 마운트) ── */
const icons: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const styles: Record<ToastType, string> = {
  success: 'border-l-[3px] border-l-[#30d158] bg-white',
  error:   'border-l-[3px] border-l-[#ff3b30] bg-white',
  info:    'border-l-[3px] border-l-[#2E6FF2] bg-white',
};

const iconStyles: Record<ToastType, string> = {
  success: 'text-[#30d158]',
  error:   'text-[#ff3b30]',
  info:    'text-[#2E6FF2]',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = icons[toast.type];

  useEffect(() => {
    return () => {};
  }, []);

  return (
    <div
      className={cn(
        'flex items-start gap-3 w-80 rounded-xl shadow-lg border border-[#E2E5EA] px-4 py-3',
        'animate-in slide-in-from-right-4 fade-in-0 duration-200',
        styles[toast.type]
      )}
    >
      <Icon size={17} className={cn('mt-0.5 flex-shrink-0', iconStyles[toast.type])} />
      <p className="flex-1 text-[13px] text-[#1B1F2B] leading-snug">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-[#a1a1a6] hover:text-[#1B1F2B] transition-colors cursor-pointer"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function ToastRenderer() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
