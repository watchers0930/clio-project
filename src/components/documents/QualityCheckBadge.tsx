'use client';

import type { QualitySeverity } from '@/lib/supabase/types';

interface QualityCheckBadgeProps {
  severity: QualitySeverity;
  label?: string;
}

const SEVERITY_CONFIG: Record<QualitySeverity, { text: string; cls: string }> = {
  error:      { text: '오류',   cls: 'text-red-600 bg-red-50 border-red-200' },
  warning:    { text: '경고',   cls: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  suggestion: { text: '제안',   cls: 'text-blue-600 bg-blue-50 border-blue-200' },
};

export function QualityCheckBadge({ severity, label }: QualityCheckBadgeProps) {
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.suggestion;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${config.cls}`}>
      {label ?? config.text}
    </span>
  );
}
