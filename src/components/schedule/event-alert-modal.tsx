'use client';

import { X, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { CalendarEvent } from '@/lib/supabase/types';

interface EventAlertModalProps {
  open: boolean;
  events: CalendarEvent[];
  onClose: () => void;
  onSuppress: () => void;
}

export function EventAlertModal({ open, events, onClose, onSuppress }: EventAlertModalProps) {
  if (!open || events.length === 0) return null;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateLabel = format(tomorrow, 'M월 d일 (EEEEE)', { locale: ko });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4"
        style={{ padding: '28px 32px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between" style={{ marginBottom: 16 }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(46,111,242,0.10)' }}
            >
              <Bell size={17} style={{ color: '#2E6FF2' }} />
            </div>
            <div>
              <p className="text-[11px] text-foreground-tertiary">내일 일정 알림</p>
              <p className="text-[15px] font-bold text-foreground">{dateLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-foreground-tertiary hover:text-foreground transition-colors mt-0.5"
          >
            <X size={17} />
          </button>
        </div>

        {/* 일정 목록 */}
        <div className="flex flex-col gap-2.5" style={{ marginBottom: 20 }}>
          {events.map((evt) => {
            const timeStr = evt.all_day
              ? '종일'
              : format(new Date(evt.start_at), 'HH:mm');
            return (
              <div
                key={evt.id}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: '#F7F8FA' }}
              >
                <div
                  className="w-1.5 h-10 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#2E6FF2' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-foreground-tertiary font-num">{timeStr}</p>
                  <p className="text-[13px] font-semibold text-foreground truncate">
                    {evt.title}
                  </p>
                  {evt.location && (
                    <p className="text-[11px] text-foreground-tertiary truncate">
                      📍 {evt.location}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={onSuppress}
            className="flex-1 h-10 rounded-xl border border-border text-[13px] text-foreground-secondary hover:bg-surface-secondary transition-colors"
          >
            오늘 다시 보지 않기
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl text-[13px] font-medium text-white transition-colors"
            style={{ backgroundColor: '#2E6FF2' }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
