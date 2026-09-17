'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { create } from 'zustand';
import { X, MessageSquareText, MessagesSquare, Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

/* ── 알림 행 타입(테이블과 동일) ── */
interface NotificationRow {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
}

/* ── store: 화면에 떠 있는 슬라이드 알림 ── */
interface NotificationToastStore {
  items: NotificationRow[];
  push: (n: NotificationRow) => void;
  dismiss: (id: string) => void;
}

const useNotificationToastStore = create<NotificationToastStore>((set) => ({
  items: [],
  push: (n) =>
    set((s) => (s.items.some((i) => i.id === n.id) ? s : { items: [...s.items, n] })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

/* ── 아이콘 매핑 (모듈 최상위 컴포넌트) ── */
function NotificationIcon({ type, size = 18 }: { type: string; size?: number }) {
  if (type === 'chat_request') return <MessagesSquare size={size} />;
  if (type === 'document_comment') return <MessageSquareText size={size} />;
  return <Bell size={size} />;
}

/* ── 슬라이드 알림 카드 ── */
function NotificationCard({
  item,
  onDismiss,
  onOpen,
}: {
  item: NotificationRow;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role={item.link ? 'button' : undefined}
      onClick={item.link ? onOpen : undefined}
      className={cn(
        'flex w-80 items-start gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-lg',
        'border-l-[3px] border-l-primary',
        'animate-in slide-in-from-right-6 fade-in-0 duration-300',
        item.link && 'cursor-pointer hover:bg-surface-secondary transition-colors',
      )}
    >
      <span className="mt-0.5 flex-shrink-0 text-primary">
        <NotificationIcon type={item.type} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground leading-snug">{item.title}</p>
        {item.body && (
          <p className="mt-0.5 text-[12px] text-foreground-secondary leading-snug line-clamp-2">
            {item.body}
          </p>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="flex-shrink-0 text-foreground-quaternary hover:text-foreground transition-colors cursor-pointer"
        aria-label="알림 닫기"
      >
        <X size={15} />
      </button>
    </div>
  );
}

/**
 * 전역 알림 provider — 현재 로그인 사용자의 notifications INSERT를 Supabase Realtime으로
 * 구독하여 우측 상단에 슬라이드 알림을 띄운다. AppLayout에 한 번만 마운트한다.
 * (RLS로 recipient_id = auth.uid() 행만 수신되므로 타인 알림은 도달하지 않는다.)
 */
export function NotificationToaster() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const items = useNotificationToastStore((s) => s.items);
  const push = useNotificationToastStore((s) => s.push);
  const dismiss = useNotificationToastStore((s) => s.dismiss);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          push(payload.new as NotificationRow);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, push]);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <NotificationCard
            item={item}
            onDismiss={() => dismiss(item.id)}
            onOpen={() => {
              if (item.link) router.push(item.link);
              dismiss(item.id);
            }}
          />
        </div>
      ))}
    </div>
  );
}
