'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';
import { DocumentActionRow } from '@/components/documents/document-action-row';
import { buildDocumentCreateHref } from '@/lib/documents/navigation';

interface ReviewQueueItem {
  id: string;
  title: string;
  ownerName: string;
  pendingCount: number;
  heldCount: number;
  latestCommentAt: string | null;
  topStatusLabel: 'pending' | 'held';
  href: string;
}

interface ReviewQueueData {
  total: number;
  pendingTotal: number;
  heldTotal: number;
  items: ReviewQueueItem[];
}

function formatDateLabel(value: string | null) {
  if (!value) return '기록 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getStatusSummary(item: ReviewQueueItem) {
  if (item.topStatusLabel === 'pending') {
    return `미반영 ${item.pendingCount}`;
  }
  return `보류 ${item.heldCount}`;
}

export default function ReviewsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReviewQueueData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/documents/review-queue');
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setData(json?.data ?? null);
          setError(null);
          return;
        }
        setError(json?.error ?? '검토 큐를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="max-w-md rounded-xl border border-border bg-white px-6 py-8 text-center">
          <p className="text-[18px] font-semibold text-foreground">검토 큐를 불러오지 못했습니다.</p>
          <p className="mt-2 text-[13px] leading-6 text-foreground-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-5 px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[20px] font-bold text-foreground">코멘트/검토</h1>
              <p className="mt-1.5 text-[13px] text-foreground-secondary">
                공유된 문서에서 아직 반영되지 않은 코멘트를 한곳에서 확인하고 검토, 반영 작업을 이어갑니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(data?.items[0]?.href ?? '/documents')}
                className="h-9 rounded-xl bg-foreground px-4 text-[13px] font-medium text-white transition-colors hover:bg-primary"
              >
                미반영 코멘트 확인
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">검토 대상 문서</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{data?.total ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">미반영 코멘트</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{data?.pendingTotal ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">보류 코멘트</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{data?.heldTotal ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 sm:p-6">
        <p className="text-[16px] font-semibold text-foreground">검토 대기 문서</p>
        <p className="mt-1 text-[12px] text-foreground-secondary">미반영 코멘트 수가 많은 순서대로 정렬합니다.</p>
        <div className="mt-4 flex flex-col gap-4">
          {(data?.items ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-tint bg-surface-tertiary px-4 py-10 text-center text-[12px] text-foreground-secondary">
              지금 검토 대기 중인 문서가 없습니다.
            </div>
          ) : data?.items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-surface-tertiary p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-[12px] text-foreground-secondary">{item.ownerName}</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <span className="rounded-full bg-primary-tint px-3 py-1 text-[11px] font-semibold text-primary">
                    미반영 {item.pendingCount}
                  </span>
                  {item.heldCount > 0 && (
                    <span className="rounded-full bg-warning/5 px-3 py-1 text-[11px] font-semibold text-warning">
                      보류 {item.heldCount}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-foreground-secondary">
                우선 처리 {getStatusSummary(item)} · 최근 코멘트 {formatDateLabel(item.latestCommentAt)}
              </p>
              <DocumentActionRow
                items={[
                  {
                    label: '코멘트 패널 열기',
                    onClick: () => router.push(item.href),
                    variant: 'primary',
                  },
                  {
                    label: '문서 상세 보기',
                    onClick: () => router.push(item.href.replace('#document-comment-panel', '')),
                    variant: 'secondary',
                  },
                  {
                    label: '새 문서 활용',
                    onClick: () => router.push(buildDocumentCreateHref({
                      originDocumentId: item.id,
                      originContext: 'review_followup',
                      contextTitle: item.title,
                      instructions: `"${item.title}" 문서의 검토 의견을 반영한 후속 문서를 작성해줘.`,
                    })),
                    variant: 'success',
                  },
                ]}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

