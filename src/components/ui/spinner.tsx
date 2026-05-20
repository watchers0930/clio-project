import { cn } from '@/lib/utils';

interface SpinnerProps {
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 색상 variant */
  variant?: 'default' | 'primary' | 'white';
  className?: string;
}

const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-[3px]',
};

const colorMap = {
  default: 'border-border border-t-foreground-secondary',
  primary: 'border-border border-t-primary',
  white:   'border-white/30 border-t-white',
};

export function Spinner({ size = 'md', variant = 'primary', className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="로딩 중"
      className={cn(
        'rounded-full animate-spin shrink-0',
        sizeMap[size],
        colorMap[variant],
        className
      )}
    />
  );
}

/** 전체 화면 로딩 오버레이 */
export function FullPageSpinner() {
  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

/** 인라인 로딩 스켈레톤 카드 */
export function SkeletonCard({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-border rounded-sm" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-36 bg-white rounded-lg border border-border" />
        ))}
      </div>
    </div>
  );
}
