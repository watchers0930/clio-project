'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, ArrowUpRight, MessageSquareText, Share2 } from 'lucide-react';
import { Spinner } from '@/components/ui';

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
        <div className="max-w-md rounded-[28px] border border-[#e5e5e7] bg-white px-6 py-8 text-center">
          <p className="text-[18px] font-semibold text-[#1d1d1f]">공유 문서를 불러오지 못했습니다.</p>
          <p className="mt-2 text-[13px] leading-6 text-[#6e6e73]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-[25px] pb-10">
      <section className="rounded-[28px] border border-[#e5e5e7] bg-white overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <div className="px-4 py-5 sm:px-6 sm:py-6 xl:px-[30px] xl:py-[30px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0071e3]">Shared Workspace</p>
              <h1 className="text-[24px] font-bold leading-[1.2] text-[#1d1d1f] sm:text-[28px]">공유 문서</h1>
              <p className="max-w-2xl text-[14px] text-[#6e6e73] sm:text-[15px]" style={{ lineHeight: '20px' }}>
                부서나 사용자에게 공유받은 문서와, 내가 외부 링크나 내부 공유로 배포 중인 문서를 한곳에서 다시 확인합니다.
                여기서 바로 문서 상세, 코멘트 검토, 새 문서 활용으로 이어집니다.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MetricCard label="나에게 공유됨" value={data?.incomingCount ?? 0} />
                <MetricCard label="내가 공유 중" value={data?.outgoingCount ?? 0} />
              </div>
            </div>
          </div>
          <div className="border-t border-[#e5e5e7] bg-[#fbfbfc] px-4 py-5 sm:px-6 sm:py-6 xl:border-l xl:border-t-0 xl:px-[28px] xl:py-[28px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8494]">Next Flow</p>
              <div className="flex flex-col gap-3">
                <QuickAction
                  icon={<MessageSquareText size={18} />}
                  title="공유된 문서에서 코멘트 확인"
                  description="미반영 코멘트가 있는 문서를 먼저 열어 검토 흐름을 이어갑니다."
                  onClick={() => {
                    const nextDoc = data?.incomingDocuments.find((item) => item.pendingCommentCount > 0) ?? data?.outgoingDocuments.find((item) => item.pendingCommentCount > 0);
                    router.push(nextDoc ? `${nextDoc.href}#document-comment-panel` : '/documents');
                  }}
                />
                <QuickAction
                  icon={<Share2 size={18} />}
                  title="내가 공유 중인 문서 점검"
                  description="최근에 공유한 문서를 열어 권한과 상태를 다시 확인합니다."
                  onClick={() => router.push(data?.outgoingDocuments[0]?.href ?? '/documents')}
                />
                <QuickAction
                  icon={<ArrowRightLeft size={18} />}
                  title="공유 문서로 새 문서 작성"
                  description="공유받은 문서를 기반으로 후속 문서나 업데이트 문서를 작성합니다."
                  onClick={() => {
                    const nextDoc = data?.incomingDocuments[0];
                    router.push(
                      nextDoc
                        ? `/documents?create=true&originDocumentId=${encodeURIComponent(nextDoc.id)}&originContext=shared_followup&contextTitle=${encodeURIComponent(nextDoc.title)}&instructions=${encodeURIComponent(`"${nextDoc.title}" 문서를 바탕으로 후속 문서를 작성해줘.`)}`
                        : '/documents?create=true',
                    );
                  }}
                />
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
          onReuse={(item) => router.push(`/documents?create=true&originDocumentId=${encodeURIComponent(item.id)}&originContext=shared_followup&contextTitle=${encodeURIComponent(item.title)}&instructions=${encodeURIComponent(`"${item.title}" 문서를 참고해 후속 문서를 작성해줘.`)}`)}
        />
        <SharedDocSection
          title="내가 공유 중인 문서"
          description="내부 공유나 링크 공유가 활성화된 문서입니다."
          emptyLabel="현재 내가 공유 중인 문서가 없습니다."
          items={data?.outgoingDocuments ?? []}
          onOpen={(item) => router.push(item.href)}
          onOpenComments={(item) => router.push(`${item.href}#document-comment-panel`)}
          onReuse={(item) => router.push(`/documents?create=true&originDocumentId=${encodeURIComponent(item.id)}&originContext=shared_followup&contextTitle=${encodeURIComponent(item.title)}&instructions=${encodeURIComponent(`"${item.title}" 문서를 바탕으로 새 버전이나 공유용 문서를 작성해줘.`)}`)}
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E2E5EA] bg-[#f8f8fa] p-4">
      <p className="text-[12px] text-[#6e6e73]">{label}</p>
      <p className="mt-1 text-[20px] font-bold text-[#1d1d1f] font-num">{value}</p>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-[#E2E5EA] bg-white p-4 text-left hover:border-[#0071e3]/35 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef6ff] text-[#0071e3]">
          {icon}
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#1d1d1f]">{title}</p>
          <p className="mt-1 text-[12px] leading-5 text-[#6e6e73]">{description}</p>
        </div>
      </div>
    </button>
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
    <section className="rounded-[28px] border border-[#e5e5e7] bg-white px-4 py-5 sm:px-6 sm:py-6 xl:px-[30px] xl:py-[30px]">
      <p className="text-[16px] font-semibold text-[#1d1d1f]">{title}</p>
      <p className="mt-3 text-[13px] leading-6 text-[#6e6e73]">{description}</p>
      <div className="mt-6 flex flex-col gap-4">
        {items.length === 0 ? (
          <div className="flex min-h-[132px] items-center justify-center rounded-[24px] border border-dashed border-[#D7E7FF] bg-[#fbfbfc] px-6 py-10 text-center text-[13px] text-[#6e6e73]">
            {emptyLabel}
          </div>
        ) : items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-[#E2E5EA] bg-[#fbfbfc] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[#1d1d1f]">{item.title}</p>
                <p className="mt-1 text-[12px] text-[#6e6e73]">{item.ownerName}</p>
              </div>
              {item.pendingCommentCount > 0 && (
                <span className="rounded-full bg-[#F6F0FF] px-3 py-1 text-[11px] font-semibold text-[#7C3AED]">
                  미반영 {item.pendingCommentCount}개
                </span>
              )}
            </div>
            <p className="mt-3 text-[12px] leading-5 text-[#6e6e73]">{buildShareMeta(item)}</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button onClick={() => onOpen(item)} className="inline-flex items-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#0071e3] transition-colors">
                문서 열기
                <ArrowUpRight size={14} />
              </button>
              <button onClick={() => onOpenComments(item)} className="rounded-xl border border-[#E6DBFF] px-4 py-2.5 text-[12px] font-medium text-[#7C3AED] hover:bg-[#FAF5FF] transition-colors">
                코멘트 보기
              </button>
              <button onClick={() => onReuse(item)} className="rounded-xl border border-[#D7E7FF] px-4 py-2.5 text-[12px] font-medium text-[#2E6FF2] hover:bg-[#eef6ff] transition-colors">
                새 문서 활용
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
