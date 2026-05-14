'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import Link from 'next/link';
import { format, isToday, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ChevronRight,
  FolderOpen,
  Users,
  Sparkles,
  FilePlus,
  StickyNote,
  CalendarDays,
  ShieldAlert,
} from 'lucide-react';
import { DashboardBottomSection, DashboardMidSection } from '@/components/dashboard/dashboard-sections';
import { getCalendarDays, getEventTypeColor, WEEKDAY_LABELS } from '@/lib/schedule-utils';
import { DAILY_QUOTES, PLATFORM_HERO_LABEL } from '@/lib/constants/ui';
import type { CalendarEvent } from '@/lib/supabase/types';

interface DashboardData {
  total_files: number;
  total_documents: number;
  total_users: number;
  total_templates: number;
  role?: string;
  department_name?: string;
  scope_label?: string;
  scope_hint?: string;
  accessible_department_count?: number;
  recent_activity: Array<{
    id: string;
    user_id: string;
    action: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
  file_type_breakdown: Record<string, number>;
  department_breakdown: Record<string, number>;
}

interface RecentFile {
  id: string;
  name: string;
  type: string;
  department: string;
  uploadDate: string;
  status: string;
}

const WEEKDAY_COLORS = ['#ff3b30', '#1B1F2B', '#1B1F2B', '#1B1F2B', '#1B1F2B', '#1B1F2B', '#2E6FF2'];

const quickActions = [
  {
    label: '문서허브',
    href: '/files',
    icon: FolderOpen,
    description: '저장과 공유 시작',
    priority: 'primary' as const,
  },
  {
    label: 'AI 검색',
    href: '/search',
    icon: Sparkles,
    description: '근거 문서 찾기',
    priority: 'primary' as const,
  },
  {
    label: '새 문서 생성',
    href: '/documents?create=true',
    icon: FilePlus,
    description: '초안 바로 작성',
    priority: 'primary' as const,
  },
  {
    label: '계약 리스크',
    href: '/contract-risk',
    icon: ShieldAlert,
    description: '전문 검토 시작',
    priority: 'primary' as const,
  },
  {
    label: '메모',
    href: '/memos',
    icon: StickyNote,
    description: '아이디어 정리',
    priority: 'secondary' as const,
  },
  {
    label: '회의',
    href: '/meetings',
    icon: Users,
    description: '회의 흐름 보기',
    priority: 'secondary' as const,
  },
  {
    label: '일정',
    href: '/schedule',
    icon: CalendarDays,
    description: '일정 확인',
    priority: 'secondary' as const,
  },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '좋은 오후에요';
  return '좋은 저녁이에요';
}

function isEventOnDate(event: CalendarEvent, date: Date) {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return currentDate >= startDate && currentDate <= endDate;
}

function getDailyQuote(date: Date) {
  const key = format(date, 'yyyy-MM-dd');
  const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return DAILY_QUOTES[hash % DAILY_QUOTES.length];
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();

      const [statsRes, filesRes, eventsRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/files?limit=5'),
        fetch(`/api/events?start=${encodeURIComponent(monthStart)}&end=${encodeURIComponent(monthEnd)}`),
      ]);

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.success && statsJson.data) {
          setData(statsJson.data);
        }
      }

      if (filesRes.ok) {
        const filesJson = await filesRes.json();
        if (filesJson.files) {
          setRecentFiles(filesJson.files.slice(0, 5));
        }
      }

      if (eventsRes.ok) {
        const eventsJson = await eventsRes.json();
        if (eventsJson.success && Array.isArray(eventsJson.data)) {
          setEvents(eventsJson.data);
        }
      }
    } catch {
      /* 조용히 실패 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const primaryActions = quickActions.filter((action) => action.priority === 'primary');
  const secondaryActions = quickActions.filter((action) => action.priority === 'secondary');
  const now = new Date();
  const calendarDays = getCalendarDays(now.getFullYear(), now.getMonth());
  const todayEvents = events.filter((event) => isEventOnDate(event, now));
  const upcomingEvents = [...events]
    .filter((event) => new Date(event.end_at) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 4);
  const dailyQuote = getDailyQuote(now);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
      <section className="rounded-[28px] border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
          <div className="px-4 py-5 sm:px-6 sm:py-6 xl:px-[30px] xl:py-[30px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">{PLATFORM_HERO_LABEL}</p>
              <h1 className="text-[24px] font-bold leading-[1.2] text-foreground sm:text-[30px]">
                {getGreeting()}, <span className="text-primary">{user?.name || '관리자'}님</span>
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted">
                <span>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
                <span className="text-[#B2B8C2]">|</span>
                <span className="text-[#6B7280]">{dailyQuote}</span>
              </div>
              <p className="max-w-[720px] text-[14px] leading-6 text-[#6B7280]">
                문서를 저장하고 공유한 뒤, 검색과 생성, 계약 검토까지 오늘의 흐름을 바로 이어갈 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <Link
                  href="/files"
                  className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-4 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#0071e3]"
                >
                  <FolderOpen size={15} strokeWidth={1.8} />
                  문서허브 가기
                </Link>
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 rounded-full border border-[#D7E7FF] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#2E6FF2] transition-colors hover:bg-[#F3F8FF]"
                >
                  <Sparkles size={15} strokeWidth={1.8} />
                  AI 검색 시작
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#F3F8FF] px-2.5 py-1 text-[10px] font-semibold text-[#2E6FF2]">
                    오늘 바로가기
                  </span>
                  <span className="text-[12px] text-[#6B7280]">저장 → 검색 → 생성 → 계약 검토</span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {primaryActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.label}
                        href={action.href}
                        className="group flex h-full min-h-[74px] rounded-[20px] border border-[#D9DEE7] bg-white text-[#1d1d1f] transition-all hover:border-[#0071e3]/35 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                        style={{ padding: '12px 14px' }}
                      >
                        <div className="flex h-full w-full items-center gap-3">
                          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[12px] bg-[#F3F8FF] text-[#2E6FF2] transition-colors group-hover:bg-[#EAF3FF]">
                            <Icon size={16} strokeWidth={1.8} />
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="min-w-0 w-full">
                              <p className="text-[13px] font-semibold leading-4 text-[#1B1F2B]">
                                {action.label}
                              </p>
                              <p className="mt-1 text-[10px] leading-4 text-[#6B7280]">
                                {action.description}
                              </p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="shrink-0 text-[#B2B8C2] transition-colors group-hover:text-[#2E6FF2]" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {secondaryActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.label}
                        href={action.href}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F6F8] px-3 py-1.5 text-[11px] font-medium text-[#596273] hover:bg-[#EEF4FF] hover:text-[#2E6FF2] transition-colors"
                      >
                        <Icon size={13} strokeWidth={1.8} />
                        <span>{action.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <aside className="border-t border-[#e5e5e7] bg-[#fbfbfc] px-4 py-5 sm:px-6 sm:py-6 xl:border-t-0 xl:border-l xl:px-[22px] xl:py-[22px]">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8494]">Schedule View</p>
                  <h2 className="mt-1 text-[18px] font-semibold text-[#1B1F2B]">이번 달 일정</h2>
                </div>
                <Link href="/schedule" className="inline-flex items-center gap-1 text-[12px] font-medium text-[#2E6FF2] hover:text-[#0071e3]">
                  전체 보기
                  <ChevronRight size={14} />
                </Link>
              </div>

              <div className="rounded-[22px] border border-[#E5E7EB] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[#1B1F2B]">{format(now, 'yyyy년 M월', { locale: ko })}</p>
                  <span className="rounded-full bg-[#F3F8FF] px-2.5 py-1 text-[10px] font-semibold text-[#2E6FF2]">
                    오늘 {todayEvents.length}건
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <div key={label} className="pb-1 text-center text-[10px] font-semibold" style={{ color: WEEKDAY_COLORS[index] }}>
                      {label}
                    </div>
                  ))}
                  {calendarDays.map((day) => {
                    const dayEvents = events.filter((event) => isEventOnDate(event, day));
                    const inCurrentMonth = day.getMonth() === now.getMonth();
                    return (
                      <div
                        key={day.toISOString()}
                        className={`relative flex h-10 items-center justify-center rounded-xl border text-[11px] font-medium transition-colors ${
                          isToday(day)
                            ? 'border-[#2E6FF2] bg-[#F3F8FF] text-[#2E6FF2]'
                            : inCurrentMonth
                              ? 'border-transparent bg-[#F8F9FB] text-[#1B1F2B]'
                              : 'border-transparent bg-transparent text-[#B2B8C2]'
                        }`}
                      >
                        <span>{format(day, 'd')}</span>
                        {dayEvents.length > 0 && (
                          <span
                            className="absolute bottom-1 h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: getEventTypeColor(dayEvents[0].event_type) }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[22px] border border-[#E5E7EB] bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[#1B1F2B]">다가오는 일정</p>
                  <span className="text-[11px] text-[#6B7280]">{upcomingEvents.length}개 표시</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {upcomingEvents.length > 0 ? (
                    upcomingEvents.map((event) => {
                      const eventDate = new Date(event.start_at);
                      return (
                        <Link
                          key={event.id}
                          href="/schedule"
                          className="flex items-start gap-3.5 rounded-2xl border border-[#EEF1F5] bg-[#FBFBFC] px-4 py-3.5 transition-colors hover:border-[#D7E7FF] hover:bg-[#F7FBFF]"
                        >
                          <div
                            className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: getEventTypeColor(event.event_type) }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-semibold text-[#1B1F2B]">{event.title}</p>
                            <p className="mt-0.5 text-[11px] text-[#6B7280]">
                              {format(eventDate, 'M월 d일 (EEE) HH:mm', { locale: ko })}
                            </p>
                          </div>
                        </Link>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#D9DEE7] bg-[#FBFBFC] px-4 py-5 text-[12px] text-[#6B7280]">
                      이번 달에 표시할 일정이 없습니다. 일정/할일 화면에서 새 일정을 추가해 보세요.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <DashboardMidSection recentFiles={recentFiles} data={data as never} loading={loading} />
      <DashboardBottomSection data={data as never} loading={loading} />
    </div>
  );
}
