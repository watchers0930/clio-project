'use client';

import { type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** 검색 버튼만 비활성화 (input은 활성 유지) */
  buttonDisabled?: boolean;
  /** 검색 버튼 표시 여부 */
  showButton?: boolean;
  buttonLabel?: string;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { wrapper: 'h-10', input: 'pl-10 pr-4 text-sm', icon: 'left-3 w-4 h-4' },
  md: { wrapper: 'h-12', input: 'pl-11 pr-4 text-sm', icon: 'left-3 w-4.5 h-4.5' },
  lg: { wrapper: 'h-14', input: 'pl-12 pr-5 text-base', icon: 'left-4 w-5 h-5' },
};

export function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = '검색...',
  disabled,
  buttonDisabled,
  showButton,
  buttonLabel = '검색',
  loading,
  className,
  size = 'md',
}: SearchInputProps) {
  const s = sizeMap[size];

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) onSearch();
  };

  return (
    <div className={cn('relative flex items-center', s.wrapper, className)}>
      {/* 검색 아이콘 */}
      <svg
        className={cn(`absolute ${s.icon} text-[#a1a1a6] pointer-events-none`)}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
      </svg>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f]',
          'placeholder:text-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3]',
          'disabled:opacity-50 disabled:cursor-not-allowed transition-all',
          s.input,
          showButton && 'pr-20',
          'h-full'
        )}
      />

      {showButton && (
        <button
          onClick={onSearch}
          disabled={buttonDisabled ?? disabled ?? loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3.5 py-2 rounded-lg bg-[#1d1d1f] text-white text-xs font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40"
        >
          {loading ? (
            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
          ) : buttonLabel}
        </button>
      )}
    </div>
  );
}
