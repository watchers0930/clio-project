'use client';

import { X, AlertTriangle } from 'lucide-react';
import type { ExpiryItem } from '@/types/expiry';

interface ExpiryAlertModalProps {
  items: ExpiryItem[];
  onDismissToday: () => void;
  onClose: () => void;
}

function getDayBadgeStyle(days: number): { bg: string; text: string; label: string } {
  if (days <= 0) return { bg: 'bg-red-100', text: 'text-red-700', label: '만료됨' };
  if (days <= 7) return { bg: 'bg-orange-100', text: 'text-orange-700', label: `D-${days}` };
  if (days <= 14) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: `D-${days}` };
  return { bg: 'bg-gray-100', text: 'text-gray-600', label: `D-${days}` };
}

function formatExpiryDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function ExpiryAlertModal({ items, onDismissToday, onClose }: ExpiryAlertModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md mx-4"
        style={{ maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* 헤더 */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" strokeWidth={2} />
            <h2 className="text-[15px] font-semibold text-foreground">만료 임박 문서 알림</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-page-bg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5" style={{ overflowY: 'auto', flex: 1 }}>
          <p className="text-[14px] text-muted mb-4">
            D-30 이내 만료 예정인 문서가 있습니다.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item) => {
              const badge = getDayBadgeStyle(item.days_remaining);
              return (
                <div
                  key={item.schedule_id}
                  className="flex items-center justify-between rounded-xl border border-border bg-page-bg"
                  style={{ padding: '12px 16px', gap: 12 }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span
                      className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${badge.bg} ${badge.text}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-[13px] font-medium text-foreground truncate">
                      {item.file_name}
                    </span>
                  </div>
                  <span className="text-[12px] text-muted font-num flex-shrink-0">
                    {formatExpiryDate(item.expiry_date)}
                  </span>
                </div>
              );
            })}
          </div>

          {items.some((i) => i.days_remaining <= 0) && (
            <p className="text-[12px] text-red-600 mt-3">
              ※ 이미 만료된 문서가 포함되어 있습니다. 즉시 검토가 필요합니다.
            </p>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          <button
            onClick={onDismissToday}
            className="text-[13px] text-muted hover:text-foreground transition-colors"
          >
            오늘 다시 보지 않기
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary text-white text-[13px] font-medium hover:bg-primary-dark transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
