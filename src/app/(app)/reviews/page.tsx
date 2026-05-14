'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck, Clock3, MessageSquareText } from 'lucide-react';
import { Spinner } from '@/components/ui';

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
        <div className="max-w-md rounded-[28px] border border-[#e5e5e7] bg-white px-6 py-8 text-center">
          <p className="text-[18px] font-semibold text-[#1d1d1f]">검토 큐를 불러오지 못했습니다.</p>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0071e3]">Review Queue</p>
            <h1 className="text-[24px] font-bold leading-[1.25] text-[#1d1d1f] sm:text-[28px]">코멘트/검토</h1>
            <p className="max-w-2xl text-[15px] text-[#6e6e73]" style={{ lineHeight: '20px' }}>
              공유된 문서와 운영 중인 문서에서 아직 반영되지 않은 코멘트를 한곳에 모아 봅니다.
              여기서 바로 댓글 패널로 들어가 검토, 보류 해제, 반영 작업을 이어갈 수 있습니다.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard label="검토 대상 문서" value={data?.total ?? 0} />
              <MetricCard label="미반영 코멘트" value={data?.pendingTotal ?? 0} />
              <MetricCard label="보류 코멘트" value={data?.heldTotal ?? 0} />
            </div>
            </div>
          </div>
          <div className="border-t border-[#e5e5e7] bg-[#fbfbfc] px-4 py-5 sm:px-6 sm:py-6 xl:border-l xl:border-t-0 xl:px-[28px] xl:py-[28px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8494]">Priority Flow</p>
              <div className="flex flex-col gap-3">
              <QuickAction
                icon={<MessageSquareText size={18} />}
                title="미반영 코멘트부터 확인"
                description="가장 코멘트가 많이 쌓인 문서의 댓글 패널로 바로 이동합니다."
                onClick={() => router.push(data?.items[0]?.href ?? '/documents')}
              />
              <QuickAction
                icon={<Clock3 size={18} />}
                title="보류 코멘트 다시 검토"
                description="보류 코멘트가 남아 있는 문서를 먼저 찾아 다시 반영 흐름에 올립니다."
                onClick={() => {
                  const heldDoc = data?.items.find((item) => item.heldCount > 0);
                  router.push(heldDoc?.href ?? '/documents');
                }}
              />
              <QuickAction
                icon={<CheckCheck size={18} />}
                title="반영 후 새 버전으로 이어가기"
                description="검토를 끝낸 문서를 열어 반영과 새 문서 활용 작업을 이어갑니다."
                onClick={() => {
                  const nextDoc = data?.items[0];
                  router.push(
                    nextDoc
                      ? `/documents?create=true&originDocumentId=${encodeURIComponent(nextDoc.id)}&originContext=review_followup&contextTitle=${encodeURIComponent(nextDoc.title)}&instructions=${encodeURIComponent(`"${nextDoc.title}" 문서의 검토 의견을 반영한 후속 문서를 작성해줘.`)}`
                      : '/documents?create=true',
                  );
                }}
              />
            </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5e5e7] bg-white p-5 sm:p-6">
        <p className="text-[16px] font-semibold text-[#1d1d1f]">검토 대기 문서</p>
        <p className="mt-1 text-[12px] text-[#6e6e73]">미반영 코멘트 수가 많은 순서대로 정렬합니다.</p>
        <div className="mt-4 flex flex-col gap-4">
          {(data?.items ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D7E7FF] bg-[#fbfbfc] px-4 py-10 text-center text-[12px] text-[#6e6e73]">
              지금 검토 대기 중인 문서가 없습니다.
            </div>
          ) : data?.items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[#E2E5EA] bg-[#fbfbfc] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[#1d1d1f]">{item.title}</p>
                  <p className="mt-1 text-[12px] text-[#6e6e73]">{item.ownerName}</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <span className="rounded-full bg-[#EEF6FF] px-3 py-1 text-[11px] font-semibold text-[#2E6FF2]">
                    미반영 {item.pendingCount}
                  </span>
                  {item.heldCount > 0 && (
                    <span className="rounded-full bg-[#FFF8ED] px-3 py-1 text-[11px] font-semibold text-[#B06D00]">
                      보류 {item.heldCount}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-[#6e6e73]">
                우선 처리 {getStatusSummary(item)} · 최근 코멘트 {formatDateLabel(item.latestCommentAt)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button onClick={() => router.push(item.href)} className="inline-flex items-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#0071e3] transition-colors">
                  코멘트 패널 열기
                </button>
                <button onClick={() => router.push(item.href.replace('#document-comment-panel', ''))} className="rounded-xl border border-[#D7E7FF] px-4 py-2.5 text-[12px] font-medium text-[#2E6FF2] hover:bg-[#eef6ff] transition-colors">
                  문서 상세 보기
                </button>
                <button
                  onClick={() => router.push(`/documents?create=true&originDocumentId=${encodeURIComponent(item.id)}&originContext=review_followup&contextTitle=${encodeURIComponent(item.title)}&instructions=${encodeURIComponent(`"${item.title}" 문서의 검토 의견을 반영한 후속 문서를 작성해줘.`)}`)}
                  className="rounded-xl border border-[#D7EFDE] px-4 py-2.5 text-[12px] font-medium text-[#258A4E] hover:bg-[#F4FBF6] transition-colors"
                >
                  새 문서 활용
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E2E5EA] bg-[#f8f8fa] px-5 py-4.5">
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
    <button onClick={onClick} className="rounded-2xl border border-[#E2E5EA] bg-white px-5 py-4.5 text-left hover:border-[#0071e3]/35 transition-colors">
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
