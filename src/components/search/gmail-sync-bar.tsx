'use client';

import { RefreshCw } from 'lucide-react';

function formatRelative(iso: string | null): string {
  if (!iso) return '아직 동기화되지 않음';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금 전 동기화됨';
  if (min < 60) return `${min}분 전 동기화됨`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전 동기화됨`;
  const day = Math.floor(hr / 24);
  return `${day}일 전 동기화됨`;
}

/**
 * Gmail 동기화 상태 바. 마지막 동기화 시각을 알려주고 즉시 동기화를 트리거한다.
 * 정기 cron(1시간) 사이에 방금 온 메일을 사용자가 직접 최신화할 수 있게 한다.
 */
export function GmailSyncBar({
  connected,
  lastSyncedAt,
  syncing,
  onSync,
}: {
  connected: boolean;
  lastSyncedAt: string | null;
  syncing: boolean;
  onSync: () => void;
}) {
  if (!connected) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-2.5">
      <div className="flex items-center gap-2 text-[12px] text-foreground-secondary">
        <span
          className={`inline-block h-2 w-2 rounded-full ${syncing ? 'animate-pulse bg-amber-400' : 'bg-emerald-500'}`}
          aria-hidden="true"
        />
        <span>Gmail · {syncing ? '동기화 중…' : formatRelative(lastSyncedAt)}</span>
      </div>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-foreground-secondary transition-colors hover:bg-primary-tint disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
        지금 동기화
      </button>
    </div>
  );
}
