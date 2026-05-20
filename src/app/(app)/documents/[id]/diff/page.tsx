'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, GitCompare } from 'lucide-react';
import Link from 'next/link';
import { DiffViewer } from '@/components/document-diff/DiffViewer';

interface DocInfo {
  id: string;
  title: string;
  template_id: string | null;
}

export default function DocumentDiffPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const baseId = params.id as string;
  const compareParam = searchParams.get('compare');

  const [compareId, setCompareId] = useState<string | null>(compareParam);
  const [docInfo, setDocInfo] = useState<DocInfo | null>(null);
  const [initialized, setInitialized] = useState(false);

  // 문서 기본 정보 + 버전 목록 조회 → compareId 초기값 결정
  useEffect(() => {
    async function init() {
      // 문서 정보 조회
      try {
        const res = await fetch(`/api/documents/${baseId}`);
        if (res.ok) {
          const json = await res.json();
          const doc = json.data ?? json;
          if (doc?.id) setDocInfo({ id: doc.id, title: doc.title, template_id: doc.template_id ?? null });
        }
      } catch {
        // 문서 정보 조회 실패는 무시 (제목 없이도 동작)
      }

      // compareId가 없으면 최신 버전 자동 선택
      if (!compareParam) {
        try {
          const res = await fetch(`/api/documents/${baseId}/versions`);
          if (res.ok) {
            const json = await res.json();
            const versions: { id: string; versionNumber: number }[] = json.versions ?? [];
            const latest = versions.reduce(
              (max, v) => v.versionNumber > max.versionNumber ? v : max,
              versions[0],
            );
            if (latest && latest.id !== baseId) {
              setCompareId(latest.id);
            } else if (versions.length >= 2) {
              // 최신이 자기 자신인 경우 두 번째 버전 선택
              const other = versions.find((v) => v.id !== baseId);
              if (other) setCompareId(other.id);
            }
          }
        } catch {
          // 버전 조회 실패 시 compareId는 null 유지
        }
      }

      setInitialized(true);
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseId]);

  const handleCompareChange = useCallback((newCompareId: string) => {
    setCompareId(newCompareId);
    const url = new URL(window.location.href);
    url.searchParams.set('compare', newCompareId);
    router.replace(url.pathname + url.search);
  }, [router]);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg className="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className="mx-auto max-w-screen-xl px-4 py-4 sm:py-6">
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between sm:mb-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/documents"
              className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-border transition-colors"
              aria-label="문서 목록으로"
            >
              <ArrowLeft size={18} className="text-foreground-secondary" />
            </Link>
            <div className="flex items-center gap-2">
              <GitCompare size={18} className="text-primary" />
              <div>
                <h1 className="text-[15px] font-semibold text-foreground">버전 비교</h1>
                {docInfo && (
                  <p className="text-[12px] text-foreground-quaternary truncate max-w-xs">{docInfo.title}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* compareId가 없을 때 (단일 버전) */}
        {!compareId && (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-border rounded-xl">
            <p className="text-[32px] mb-3">📄</p>
            <p className="text-[14px] font-medium text-foreground">비교할 버전이 없습니다</p>
            <p className="text-[12px] text-foreground-quaternary mt-1">이 문서에는 다른 버전이 없습니다.</p>
            <Link
              href="/documents"
              className="mt-4 text-[13px] text-primary hover:underline"
            >
              문서 목록으로 돌아가기
            </Link>
          </div>
        )}

        {/* DiffViewer */}
        {compareId && (
          <DiffViewer
            baseDocumentId={baseId}
            compareDocumentId={compareId}
            documentType={docInfo?.template_id ? undefined : undefined}
            onCompareChange={handleCompareChange}
          />
        )}
      </div>
    </div>
  );
}
