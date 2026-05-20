'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { DocumentActionRow } from '@/components/documents/document-action-row';
import { buildDocumentCreateHref } from '@/lib/documents/navigation';

interface SharedDocCard {
  id: string;
  title: string;
  ownerName: string;
  latestSharedAt: string | null;
  shareScopeLabel: string | null;
  permissionCount: number;
  linkCount: number;
  pendingCommentCount: number;
  href: string;
}

interface SharedDocsData {
  incomingCount: number;
  outgoingCount: number;
  incomingDocuments: SharedDocCard[];
  outgoingDocuments: SharedDocCard[];
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return '날짜 정보 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function buildShareMeta(item: SharedDocCard) {
  const parts = [formatDateLabel(item.latestSharedAt)];
  if (item.shareScopeLabel) parts.push(item.shareScopeLabel);
  if (item.permissionCount > 0) parts.push(`내부 공유 ${item.permissionCount}건`);
  if (item.linkCount > 0) parts.push(`링크 ${item.linkCount}건`);
  return parts.join(' · ');
}

export default function SharedDocumentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SharedDocsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/documents/shared');
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setData(json?.data ?? null);
          setError(null);
          return;
        }
        setError(json?.error ?? '공유 문서 목록을 불러오지 못했습니다.');
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
          <p className="text-[18px] font-semibold text-foreground">공유 문서를 불러오지 못했습니다.</p>
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
              <h1 className="text-[20px] font-bold text-foreground">공유 문서</h1>
              <p className="mt-1.5 text-[13px] text-foreground-secondary">
                공유받은 문서와 내가 배포 중인 문서를 확인하고, 코멘트 검토나 후속 문서 작성으로 이어갑니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/documents')}
                className="h-9 rounded-xl bg-foreground px-4 text-[13px] font-medium text-white transition-colors hover:bg-primary"
              >
                문서 목록
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">나에게 공유됨</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{data?.incomingCount ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">내가 공유 중</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{data?.outgoingCount ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
        <SharedDocSection
          title="나에게 공유된 문서"
          description="부서 공유나 사용자 직접 공유로 접근 가능한 문서입니다."
          emptyLabel="현재 나에게 공유된 문서가 없습니다."
          items={data?.incomingDocuments ?? []}
          onOpen={(item) => router.push(item.href)}
          onOpenComments={(item) => router.push(`${item.href}#document-comment-panel`)}
          onReuse={(item) => router.push(buildDocumentCreateHref({
            originDocumentId: item.id,
            originContext: 'shared_followup',
            contextTitle: item.title,
            instructions: `"${item.title}" 문서를 참고해 후속 문서를 작성해줘.`,
          }))}
        />
        <SharedDocSection
          title="내가 공유 중인 문서"
          description="내부 공유나 링크 공유가 활성화된 문서입니다."
          emptyLabel="현재 내가 공유 중인 문서가 없습니다."
          items={data?.outgoingDocuments ?? []}
          onOpen={(item) => router.push(item.href)}
          onOpenComments={(item) => router.push(`${item.href}#document-comment-panel`)}
          onReuse={(item) => router.push(buildDocumentCreateHref({
            originDocumentId: item.id,
            originContext: 'shared_followup',
            contextTitle: item.title,
            instructions: `"${item.title}" 문서를 바탕으로 새 버전이나 공유용 문서를 작성해줘.`,
          }))}
        />
      </div>
    </div>
  );
}

function SharedDocSection({
  title,
  description,
  emptyLabel,
  items,
  onOpen,
  onOpenComments,
  onReuse,
}: {
  title: string;
  description: string;
  emptyLabel: string;
  items: SharedDocCard[];
  onOpen: (item: SharedDocCard) => void;
  onOpenComments: (item: SharedDocCard) => void;
  onReuse: (item: SharedDocCard) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-white shadow-sm px-6 py-5 sm:px-8 sm:py-6">
      <p className="text-[16px] font-semibold text-foreground">{title}</p>
      <p className="mt-3 text-[13px] leading-6 text-foreground-secondary">{description}</p>
      <div className="mt-6 flex flex-col gap-4">
        {items.length === 0 ? (
          <div className="flex min-h-[132px] items-center justify-center rounded-xl border border-dashed border-border-tint bg-surface-tertiary px-6 py-10 text-center text-[13px] text-foreground-secondary">
            {emptyLabel}
          </div>
        ) : items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-border bg-surface-tertiary p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-[12px] text-foreground-secondary">{item.ownerName}</p>
              </div>
              {item.pendingCommentCount > 0 && (
                <span className="rounded-full bg-purple-50 px-3 py-1 text-[11px] font-semibold text-purple-600">
                  미반영 {item.pendingCommentCount}개
                </span>
              )}
            </div>
            <p className="mt-3 text-[12px] leading-5 text-foreground-secondary">{buildShareMeta(item)}</p>
            <DocumentActionRow
              items={[
                {
                  label: '문서 열기',
                  onClick: () => onOpen(item),
                  variant: 'primary',
                  trailing: <ArrowUpRight size={14} />,
                },
                {
                  label: '코멘트 보기',
                  onClick: () => onOpenComments(item),
                  variant: 'review',
                },
                {
                  label: '새 문서 활용',
                  onClick: () => onReuse(item),
                  variant: 'secondary',
                },
              ]}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
