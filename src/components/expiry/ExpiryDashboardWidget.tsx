'use client';

import { useExpiryAlert } from './ExpiryAlertProvider';
import { AlertTriangle, Clock } from 'lucide-react';

function getDayBadgeStyle(days: number) {
  if (days <= 0) return { bg: 'bg-red-100', text: 'text-red-700', label: '만료됨' };
  if (days <= 7) return { bg: 'bg-orange-100', text: 'text-orange-700', label: `D-${days}` };
  if (days <= 14) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: `D-${days}` };
  return { bg: 'bg-gray-100', text: 'text-gray-500', label: `D-${days}` };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function ExpiryDashboardWidget() {
  const { items, isLoading } = useExpiryAlert();

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div
        className="flex items-center justify-between border-b border-border"
        style={{ padding: '20px 24px' }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-500" strokeWidth={2} />
          <h2 className="text-[16px] font-semibold text-foreground">만료 임박 문서</h2>
        </div>
        {items.length > 0 && (
          <span className="text-[12px] font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md">
            {items.length}건
          </span>
        )}
      </div>

      <div style={{ padding: '10px 0' }}>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6">
            <Clock size={14} className="text-muted animate-spin" />
            <span className="text-[13px] text-muted">확인 중...</span>
          </div>
        ) : items.length === 0 ? (
          <p className="text-[13px] text-muted text-center py-6">
            D-30 이내 만료 예정 문서가 없습니다.
          </p>
        ) : (
          items.map((item) => {
            const badge = getDayBadgeStyle(item.days_remaining);
            return (
              <div
                key={item.schedule_id}
                className="flex items-center border-b border-border last:border-b-0"
                style={{ gap: 14, padding: '14px 24px' }}
              >
                <span
                  className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-md ${badge.bg} ${badge.text}`}
                >
                  {badge.label}
                </span>
                <span className="flex-1 text-[13px] text-foreground truncate">{item.file_name}</span>
                <span className="text-[12px] text-muted font-num flex-shrink-0">
                  {formatDate(item.expiry_date)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
