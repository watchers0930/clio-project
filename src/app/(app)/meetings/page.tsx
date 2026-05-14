'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Mic, Search, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { SttModal } from '@/components/meetings/SttModal';

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
    <div className="space-y-[25px] pb-10">
      <section className="rounded-[28px] border border-[#e5e5e7] bg-white overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <div className="px-4 py-5 sm:px-6 sm:py-6 xl:px-[30px] xl:py-[30px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0071e3]">Meeting Workflow</p>
            <h1 className="text-[24px] font-bold leading-[1.25] text-[#1d1d1f] sm:text-[28px]">회의</h1>
            <p className="max-w-2xl text-[15px] text-[#6e6e73]" style={{ lineHeight: '20px' }}>
              회의록 생성이나 기존 회의록 검토부터 시작하세요.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard label="다가오는 회의" value={events.length} />
              <MetricCard label="최근 회의 문서" value={meetingDocs.length} />
              <MetricCard label="다음 회의 초점" value={nextMeeting ? 1 : 0} />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/documents')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0071e3] transition-colors"
              >
                <Sparkles size={16} />
                회의 기반 문서 작성
              </button>
              <button
                onClick={() => setSttModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#e5e5e7] bg-white px-4 py-2.5 text-sm font-medium text-[#1d1d1f] hover:border-[#2E6FF2] hover:text-[#2E6FF2] transition-colors"
              >
                <Mic size={16} />
                음성으로 회의록
              </button>
              <Link
                href="/schedule"
                className="inline-flex items-center gap-2 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 py-2.5 text-sm font-medium text-[#1d1d1f] hover:border-[#0071e3] hover:text-[#0071e3] transition-colors"
              >
                <CalendarDays size={16} />
                일정/할일 보기
              </Link>
            </div>
            </div>
          </div>
          <div className="border-t border-[#e5e5e7] bg-[#fbfbfc] px-4 py-5 sm:px-6 sm:py-6 xl:border-l xl:border-t-0 xl:px-[28px] xl:py-[28px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8494]">Recommended Flow</p>
              <div className="flex flex-col gap-3">
              <QuickAction
                title="1. 일정 확인"
                description={nextMeeting ? `"${nextMeeting.title}"` : '다가오는 일정 없음'}
                onClick={() => router.push('/schedule')}
              />
              <QuickAction
                title="2. 회의록 생성"
                description="초안 바로 만들기"
                onClick={() => {
                  const focus = nextMeeting?.title ?? '회의';
                  router.push(`/documents?create=true&originContext=meeting_minutes&contextTitle=${encodeURIComponent(focus)}&instructions=${encodeURIComponent(`${focus} 회의 내용을 정리한 회의록 초안을 작성하세요.`)}`);
                }}
              />
              <QuickAction
                title="3. 후속 문서 작성"
                description="보고/실행 문서로 연결"
                onClick={() => router.push('/documents')}
              />
            </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
        <section className="rounded-2xl border border-[#e5e5e7] bg-white p-5">
          <p className="text-[16px] font-semibold text-[#1d1d1f]">다가오는 회의</p>
          <p className="mt-1 text-[12px] text-[#6e6e73]">일정에서 바로 시작</p>
          <div className="mt-4 flex flex-col gap-4">
            {events.length === 0 ? (
              <EmptyCard label="다가오는 회의 일정이 없습니다." />
            ) : events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-[#E2E5EA] bg-[#fbfbfc] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#1d1d1f]">{event.title}</p>
                    <p className="mt-1 text-[12px] text-[#6e6e73]">
                      {event.start_at.split('T')[0]} · {event.location || '장소 미정'} · {event.creator_name || '작성자 미상'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => router.push(`/documents?create=true&originContext=meeting_minutes&contextTitle=${encodeURIComponent(event.title)}&instructions=${encodeURIComponent(`${event.title} 회의 내용을 정리한 회의록 초안을 작성하세요.`)}`)}
                    className="rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#0071e3] transition-colors"
                  >
                    회의록 작성
                  </button>
                  <button
                    onClick={() => router.push(`/search?q=${encodeURIComponent(event.title)}`)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#D7E7FF] px-4 py-2.5 text-[12px] font-medium text-[#2E6FF2] hover:bg-[#eef6ff] transition-colors"
                  >
                    <Search size={14} />
                    관련 문서 검색
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e5e5e7] bg-white p-5">
          <p className="text-[16px] font-semibold text-[#1d1d1f]">최근 회의 문서</p>
          <p className="mt-1 text-[12px] text-[#6e6e73]">바로 열고 이어가기</p>
          <div className="mt-4 flex flex-col gap-4">
            {meetingDocs.length === 0 ? (
              <EmptyCard label="최근 회의 문서가 없습니다." />
            ) : meetingDocs.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-[#E2E5EA] bg-[#fbfbfc] p-5">
                <p className="text-[14px] font-semibold text-[#1d1d1f]">{doc.title}</p>
                <p className="mt-1 text-[12px] text-[#6e6e73]">{doc.createdAt} · {doc.status}</p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#0071e3] transition-colors"
                  >
                    문서 열기
                  </button>
                  <button
                    onClick={() => router.push(`/documents?create=true&originDocumentId=${encodeURIComponent(doc.id)}&originContext=meeting_followup&contextTitle=${encodeURIComponent(doc.title)}&instructions=${encodeURIComponent(`"${doc.title}" 회의 문서를 바탕으로 후속 보고 문서를 작성해줘.`)}`)}
                    className="rounded-xl border border-[#D7EFDE] px-4 py-2.5 text-[12px] font-medium text-[#258A4E] hover:bg-[#F4FBF6] transition-colors"
                  >
                    후속 문서 작성
                  </button>
                  <button
                    onClick={() => router.push(`/documents/${doc.id}#document-comment-panel`)}
                    className="rounded-xl border border-[#E6DBFF] px-4 py-2.5 text-[12px] font-medium text-[#7C3AED] hover:bg-[#FAF5FF] transition-colors"
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E2E5EA] bg-[#f8f8fa] px-4 py-3.5">
      <p className="text-[12px] text-[#6e6e73]">{label}</p>
      <p className="mt-1 text-[20px] font-bold text-[#1d1d1f] font-num">{value}</p>
    </div>
  );
}

function QuickAction({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-[#E2E5EA] bg-white px-4 py-3.5 text-left hover:border-[#0071e3]/35 transition-colors">
      <p className="text-[14px] font-semibold text-[#1d1d1f]">{title}</p>
      <p className="mt-1 text-[12px] leading-5 text-[#6e6e73]">{description}</p>
    </button>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D7E7FF] bg-[#fbfbfc] px-4 py-10 text-center text-[12px] text-[#6e6e73]">
      {label}
    </div>
  );
}
