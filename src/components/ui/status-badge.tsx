import { cn } from '@/lib/utils';
import { FILE_STATUS_COLOR, APPROVAL_STATUS_BADGE, DOCUMENT_STATUS_BADGE, FILE_TYPE_BADGE } from '@/lib/constants/ui';

interface StatusBadgeProps {
  /** 뱃지 타입 */
  type: 'file-status' | 'approval' | 'document' | 'file-type';
  /** 상태/타입 값 */
  value: string;
  className?: string;
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  let label = value;
  let colorClass = 'bg-[#f5f5f7] text-[#6e6e73]';

  switch (type) {
    case 'file-status': {
      colorClass = FILE_STATUS_COLOR[value] ?? colorClass;
      break;
    }
    case 'approval': {
      const badge = APPROVAL_STATUS_BADGE[value];
      if (badge) { label = badge.label; colorClass = badge.color; }
      break;
    }
    case 'document': {
      const badge = DOCUMENT_STATUS_BADGE[value];
      if (badge) { label = badge.label; colorClass = badge.color; }
      break;
    }
    case 'file-type': {
      colorClass = FILE_TYPE_BADGE[value] ?? colorClass;
      break;
    }
  }

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
      colorClass,
      className
    )}>
      {label}
    </span>
  );
}

/** 간단한 텍스트 뱃지 (자유 색상) */
export function TextBadge({
  children,
  color,
  className,
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f5f5f7] text-[#1d1d1f]',
        className
      )}
      style={color ? { backgroundColor: `${color}15`, color } : undefined}
    >
      {children}
    </span>
  );
}
