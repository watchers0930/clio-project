'use client';

import { Loader2, Download, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkApplyBarProps {
  acceptedCount: number;
  totalCount: number;
  outputFormat: 'docx' | 'hwpx';
  onFormatChange: (format: 'docx' | 'hwpx') => void;
  onDownload: () => void;
  isApplying: boolean;
}

export function BulkApplyBar({
  acceptedCount,
  totalCount,
  outputFormat,
  onFormatChange,
  onDownload,
  isApplying,
}: BulkApplyBarProps) {
  if (acceptedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-foreground text-white px-6 py-3.5 flex items-center gap-4 shadow-2xl">
      {/* 수락 건수 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <CheckCircle className="w-4 h-4 text-green-400" />
        <span className="text-sm">
          <span className="font-semibold text-green-400">{acceptedCount}개</span>
          <span className="text-foreground-quaternary"> 조항 수락됨 / 전체 {totalCount}개</span>
        </span>
      </div>

      <div className="flex-1" />

      {/* 파일 형식 선택 */}
      <div className="flex gap-1.5">
        {(['docx', 'hwpx'] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => onFormatChange(fmt)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              outputFormat === fmt
                ? 'bg-white text-foreground'
                : 'text-foreground-quaternary hover:text-white border border-foreground/30',
            )}
          >
            {fmt.toUpperCase()}
          </button>
        ))}
      </div>

      {/* 다운로드 버튼 */}
      <button
        onClick={onDownload}
        disabled={isApplying}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
          isApplying
            ? 'bg-primary/50 cursor-not-allowed'
            : 'bg-primary hover:bg-primary-dark',
        )}
      >
        {isApplying ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 파일 생성 중…</>
        ) : (
          <><Download className="w-3.5 h-3.5" /> 수정 파일 다운로드</>
        )}
      </button>
    </div>
  );
}
