'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { SttModal } from '@/components/meetings/SttModal';
import { buildDocumentCreateHref } from '@/lib/documents/navigation';

interface MeetingEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start_at: string;
  end_at: string;
  creator_name?: string;
}

interface MeetingDocument {
  id: string;
  title: string;
  createdAt: string;
  status: string;
}

export default function MeetingsPage() {
  return (
    <Suspense fallback={<MeetingsPageFallback />}>
      <MeetingsPageContent />
    </Suspense>
  );
}

function MeetingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<MeetingEvent[]>([]);
  const [meetingDocs, setMeetingDocs] = useState<MeetingDocument[]>([]);
  const [sttModalOpen, setSttModalOpen] = useState(false);

  useEffect(() => {
    setSttModalOpen(searchParams.get('record') === 'true');
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date();
        const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const params = new URLSearchParams({
          start: now.toISOString(),
          end: thirtyDaysLater.toISOString(),
        });

        const [eventsRes, docsRes] = await Promise.all([
          fetch(`/api/events?${params.toString()}`),
          fetch('/api/documents'),
        ]);

        if (eventsRes.ok) {
          const json = await eventsRes.json();
          const meetingEvents = (json.data ?? []).filter((event: { event_type: string }) => event.event_type === 'meeting');
          setEvents(meetingEvents.slice(0, 8));
        }

        if (docsRes.ok) {
          const json = await docsRes.json();
          const docs = (json.documents ?? []).filter((doc: { title: string }) => /회의|회의록|meeting/i.test(doc.title ?? ''));
          setMeetingDocs(docs.slice(0, 8));
        }
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

  const nextMeeting = events[0] ?? null;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-5 px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[20px] font-bold text-foreground">회의</h1>
              <p className="mt-1.5 text-[13px] text-foreground-secondary">
                회의록 생성과 기존 회의록 검토부터 시작한 뒤 문서 운영 흐름으로 넘기세요.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/documents')}
                className="h-9 rounded-xl bg-foreground px-4 text-[13px] font-medium text-white transition-colors hover:bg-primary"
              >
                회의 기반 문서 작성
              </button>
              <button
                onClick={() => setSttModalOpen(true)}
                className="h-9 rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary"
              >
                음성 회의록
              </button>
              <Link
                href="/schedule"
                className="h-9 inline-flex items-center rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary"
              >
                일정 보기
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">다가오는 회의</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{events.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">최근 회의 문서</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{meetingDocs.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">다음 회의</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{nextMeeting ? 1 : 0}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
        <section className="rounded-2xl border border-border bg-white p-5">
          <p className="text-[16px] font-semibold text-foreground">다가오는 회의</p>
          <p className="mt-1 text-[12px] text-foreground-secondary">일정에서 바로 시작</p>
          <div className="mt-4 flex flex-col gap-4">
            {events.length === 0 ? (
              <EmptyCard label="다가오는 회의 일정이 없습니다." />
            ) : events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-foreground">{event.title}</p>
                    <p className="mt-1 text-[12px] text-foreground-secondary">
                      {event.start_at.split('T')[0]} · {event.location || '장소 미정'} · {event.creator_name || '작성자 미상'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => router.push(buildDocumentCreateHref({
                      originContext: 'meeting_minutes',
                      contextTitle: event.title,
                      instructions: `${event.title} 회의 내용을 정리한 회의록 초안을 작성하세요.`,
                    }))}
                    className="rounded-xl bg-foreground px-4 py-2.5 text-[12px] font-medium text-white hover:bg-primary transition-colors"
                  >
                    회의록 작성
                  </button>
                  <button
                    onClick={() => router.push(`/search?q=${encodeURIComponent(event.title)}`)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border-tint px-4 py-2.5 text-[12px] font-medium text-primary hover:bg-primary-tint transition-colors"
                  >
                    <Search size={14} />
                    관련 문서 검색
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5">
          <p className="text-[16px] font-semibold text-foreground">최근 회의 문서</p>
          <p className="mt-1 text-[12px] text-foreground-secondary">바로 열고 이어가기</p>
          <div className="mt-4 flex flex-col gap-4">
            {meetingDocs.length === 0 ? (
              <EmptyCard label="최근 회의 문서가 없습니다." />
            ) : meetingDocs.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <p className="text-[14px] font-semibold text-foreground">{doc.title}</p>
                <p className="mt-1 text-[12px] text-foreground-secondary">{doc.createdAt} · {doc.status}</p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="rounded-xl bg-foreground px-4 py-2.5 text-[12px] font-medium text-white hover:bg-primary transition-colors"
                  >
                    문서 열기
                  </button>
                  <button
                    onClick={() => router.push(buildDocumentCreateHref({
                      originDocumentId: doc.id,
                      originContext: 'meeting_followup',
                      contextTitle: doc.title,
                      instructions: `"${doc.title}" 회의 문서를 바탕으로 후속 보고 문서를 작성해줘.`,
                    }))}
                    className="rounded-xl border border-success/30 px-4 py-2.5 text-[12px] font-medium text-success hover:bg-success/5 transition-colors"
                  >
                    후속 문서 작성
                  </button>
                  <button
                    onClick={() => router.push(`/documents/${doc.id}#document-comment-panel`)}
                    className="rounded-xl border border-purple-200 px-4 py-2.5 text-[12px] font-medium text-purple-600 hover:bg-purple-50 transition-colors"
                  >
                    코멘트 보기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <SttModal
        isOpen={sttModalOpen}
        onClose={() => {
          setSttModalOpen(false);
          if (searchParams.get('record') === 'true') {
            router.replace('/meetings');
          }
        }}
        onDocumentCreated={(docId) => {
          setSttModalOpen(false);
          router.push(`/documents?openDoc=${encodeURIComponent(docId)}`);
        }}
      />
    </div>
  );
}

function MeetingsPageFallback() {
  return (
    <div className="flex min-h-[360px] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-tint bg-surface-tertiary px-4 py-10 text-center text-[12px] text-foreground-secondary">
      {label}
    </div>
  );
}
