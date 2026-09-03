'use client';

import { UserPlus } from 'lucide-react';

export interface Knocker {
  id: string;
  name: string;
}

interface WaitingRoomBannerProps {
  knockers: Knocker[];
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
}

/**
 * 게스트 입장 대기 승인 배너. 모달 상단 중앙에 크게 표시.
 */
export function WaitingRoomBanner({ knockers, onAdmit, onDeny }: WaitingRoomBannerProps) {
  if (knockers.length === 0) return null;

  return (
    <div className="absolute left-1/2 top-4 z-40 flex w-[min(92%,420px)] -translate-x-1/2 flex-col gap-2">
      {knockers.map((k) => (
        <div
          key={k.id}
          className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-2xl ring-1 ring-black/5"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <UserPlus size={18} className="text-primary" />
          </div>
          <p className="min-w-0 flex-1 text-[14px] text-neutral-900">
            <span className="font-bold">{k.name || '게스트'}</span>님이 입장을 요청했습니다
          </p>
          <button
            onClick={() => onAdmit(k.id)}
            className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary/90"
          >
            수락
          </button>
          <button
            onClick={() => onDeny(k.id)}
            className="shrink-0 rounded-lg bg-neutral-100 px-3.5 py-2 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-200"
          >
            거절
          </button>
        </div>
      ))}
    </div>
  );
}
