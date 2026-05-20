'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VersionItem {
  id: string;
  title: string;
  versionNumber: number;
  createdAt: string;
  status: string;
}

interface VersionSelectorProps {
  label: string;
  currentDocumentId: string;
  selectedVersionId: string;
  disabledVersionId?: string; // 기준 버전과 동일한 버전 비활성화
  onVersionChange: (versionId: string) => void;
}

export function VersionSelector({
  label,
  currentDocumentId,
  selectedVersionId,
  disabledVersionId,
  onVersionChange,
}: VersionSelectorProps) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchVersions() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/documents/${currentDocumentId}/versions`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setVersions(json.versions ?? []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    if (currentDocumentId) fetchVersions();
  }, [currentDocumentId]);

  // 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-foreground-quaternary uppercase tracking-wide">{label}</span>
      <div ref={ref} className="relative">
        <button
          onClick={() => !error && !loading && setIsOpen((p) => !p)}
          disabled={loading || error}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2.5 rounded-lg border text-[13px] w-full text-left transition-colors',
            error
              ? 'border-red-200 bg-red-50 text-red-600 cursor-not-allowed'
              : 'border-border bg-white hover:border-primary/60 text-foreground',
          )}
        >
          <span className="flex-1 truncate">
            {loading ? '로딩 중...' :
             error ? '버전 목록 조회 실패' :
             selectedVersion
               ? `v${selectedVersion.versionNumber} — ${selectedVersion.createdAt}`
               : '버전 선택'}
          </span>
          <ChevronDown size={14} className={cn('text-foreground-quaternary transition-transform', isOpen && 'rotate-180')} />
        </button>

        {isOpen && versions.length > 0 && (
          <div className="absolute top-full mt-1.5 left-0 right-0 z-10 bg-white border border-border rounded-lg shadow-lg overflow-hidden">
            {versions.map((v) => {
              const isDisabled = v.id === disabledVersionId;
              const isSelected = v.id === selectedVersionId;
              return (
                <button
                  key={v.id}
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) {
                      onVersionChange(v.id);
                      setIsOpen(false);
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3.5 py-3 text-left text-[13px] transition-colors',
                    isDisabled
                      ? 'text-foreground-quaternary cursor-not-allowed bg-surface-tertiary'
                      : isSelected
                        ? 'bg-blue-50 text-primary'
                        : 'hover:bg-surface-secondary text-foreground',
                  )}
                >
                  <span className="w-5 text-center">
                    {isSelected && <Check size={13} className="text-primary" />}
                  </span>
                  <span className="flex-1">
                    <span className="font-medium">v{v.versionNumber}</span>
                    <span className="text-foreground-quaternary ml-1.5">{v.createdAt}</span>
                  </span>
                  <span className="text-[11px] text-foreground-quaternary truncate max-w-[100px]">{v.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
