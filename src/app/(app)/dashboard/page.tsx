'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import Link from 'next/link';
import { format, isToday, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Users,
  Sparkles,
  FilePlus,
  StickyNote,
  CalendarDays,
  ShieldAlert,
  FileText,
  LayoutTemplate,
} from 'lucide-react';
import { DashboardBottomSection, DashboardMidSection } from '@/components/dashboard/dashboard-sections';
import { getCalendarDays, getEventTypeColor, WEEKDAY_LABELS } from '@/lib/schedule-utils';
import { DAILY_QUOTES } from '@/lib/constants/ui';
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
  recent_activity: Array<{ id: string; user_id: string; action: string; details: Record<string, unknown>; created_at: string }>;
  file_type_breakdown: Record<string, number>;
  department_breakdown: Record<string, number>;
  flow_window_days?: number;
  flow_kpis?: { upload_count_30d: number; search_usage_rate_30d: number; document_generation_completion_rate_30d: number; shared_document_count: number; comment_reflect_completion_rate_30d: number };
  document_flow_funnel_30d?: { created: number; shared: number; commented: number; reflected: number };
  flow_diagnostics?: { active_user_count: number; search_user_count: number; created_document_count: number; completed_document_count: number; total_comment_count: number; reflected_comment_count: number };
}

interface RecentFile { id: string; name: string; type: string; department: string; uploadDate: string; status: string; }

/* ── 자주 사용하는 메뉴 (위택스 스타일 원형 아이콘) ── */
const QUICK_ACTIONS = [
  { label: '문서허브', href: '/files', icon: FolderOpen, bg: 'bg-blue-50', color: 'text-blue-500', hover: 'hover:bg-blue-100' },
  { label: 'AI 검색', href: '/search', icon: Sparkles, bg: 'bg-violet-50', color: 'text-violet-500', hover: 'hover:bg-violet-100' },
  { label: '새 문서', href: '/documents?create=true', icon: FilePlus, bg: 'bg-emerald-50', color: 'text-emerald-500', hover: 'hover:bg-emerald-100' },
  { label: '계약 리스크', href: '/contract-risk', icon: ShieldAlert, bg: 'bg-amber-50', color: 'text-amber-600', hover: 'hover:bg-amber-100' },
  { label: '메모', href: '/memos', icon: StickyNote, bg: 'bg-rose-50', color: 'text-rose-500', hover: 'hover:bg-rose-100' },
  { label: '회의', href: '/meetings', icon: Users, bg: 'bg-cyan-50', color: 'text-cyan-500', hover: 'hover:bg-cyan-100' },
  { label: '일정', href: '/schedule', icon: CalendarDays, bg: 'bg-indigo-50', color: 'text-indigo-500', hover: 'hover:bg-indigo-100' },
];

const HERO_STATS = [
  { key: 'total_files' as const, label: '전체 파일', icon: FolderOpen },
  { key: 'total_documents' as const, label: '생성 문서', icon: FileText },
  { key: 'total_users' as const, label: '사용자', icon: Users },
  { key: 'total_templates' as const, label: '템플릿', icon: LayoutTemplate },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '좋은 오후에요';
  return '좋은 저녁이에요';
}

function UpcomingEventsSlider({ events }: { events: CalendarEvent[] }) {
  const [idx, setIdx] = useState(0);
  const touchRef = useRef<number | null>(null);
  const count = events.length;

  useEffect(() => { setIdx(0); }, [count]);

  if (count === 0) {
    return (
      <div className="border-t border-border pt-4">
        <p className="mb-3 text-[13px] font-bold text-foreground">다가오는 일정</p>
        <p className="py-3 text-center text-[12px] text-foreground-tertiary">이번 달 일정이 없습니다</p>
      </div>
    );
  }

  const ev = events[idx];
  const prev = () => setIdx((i) => (i - 1 + count) % count);
  const next = () => setIdx((i) => (i + 1) % count);

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-bold text-foreground">다가오는 일정</p>
        {count > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-foreground-tertiary">{idx + 1} / {count}</span>
            <button onClick={prev} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-surface-secondary transition-colors">
              <ChevronLeft size={14} className="text-foreground-secondary" />
            </button>
            <button onClick={next} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-surface-secondary transition-colors">
              <ChevronRight size={14} className="text-foreground-secondary" />
            </button>
          </div>
        )}
      </div>
      <Link
        href="/schedule"
        className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-secondary px-3 py-2.5 transition-colors hover:bg-primary-tint"
        onTouchStart={(e) => { touchRef.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchRef.current === null || count <= 1) return;
          const diff = e.changedTouches[0].clientX - touchRef.current;
          if (diff > 40) prev();
          else if (diff < -40) next();
          touchRef.current = null;
        }}
      >
        <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getEventTypeColor(ev.event_type) }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-foreground">{ev.title}</p>
          <p className="text-[10px] text-foreground-tertiary">{format(new Date(ev.start_at), 'M/d (EEE) HH:mm', { locale: ko })}</p>
        </div>
      </Link>
      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1">
          {events.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-primary' : 'w-1.5 bg-border'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function isEventOnDate(ev: CalendarEvent, date: Date) {
  const s = new Date(ev.start_at), e = new Date(ev.end_at);
  const sd = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const ed = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  const cd = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return cd >= sd && cd <= ed;
}

function getDailyQuote(date: Date) {
  const key = format(date, 'yyyy-MM-dd');
  const hash = key.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
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
      const [statsRes, filesRes, eventsRes] = await Promise.all([
        fetch('/api/dashboard/stats?days=30'),
        fetch('/api/files?limit=5'),
        fetch(`/api/events?start=${encodeURIComponent(startOfMonth(now).toISOString())}&end=${encodeURIComponent(endOfMonth(now).toISOString())}`),
      ]);
      if (statsRes.ok) { const j = await statsRes.json(); if (j.success && j.data) setData(j.data); }
      if (filesRes.ok) { const j = await filesRes.json(); if (j.files) setRecentFiles(j.files.slice(0, 5)); }
      if (eventsRes.ok) { const j = await eventsRes.json(); if (j.success && Array.isArray(j.data)) setEvents(j.data); }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const now = new Date();
  const calendarDays = getCalendarDays(now.getFullYear(), now.getMonth());
  const todayEvents = events.filter((e) => isEventOnDate(e, now));
  const upcomingEvents = [...events]
    .filter((e) => new Date(e.end_at) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-5">
      {/* ═══════════════════════════════════════
          Hero — 날짜 뱃지 + 인사 + 통계
         ═══════════════════════════════════════ */}
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex items-start gap-5">
            {/* 날짜 뱃지 */}
            <div className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-2xl bg-primary text-white shadow-md shadow-primary/20">
              <span className="text-[24px] font-bold leading-none font-num">{now.getDate()}</span>
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider">{format(now, 'MMM')}</span>
            </div>
            <div className="flex-1 pt-0.5">
              <h1 className="text-[22px] font-bold text-foreground sm:text-[26px]">
                {getGreeting()}, <span className="text-primary">{user?.name || '관리자'}</span>님
              </h1>
              <p className="mt-1.5 text-[13px] text-foreground-secondary">
                {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                <span className="mx-2 text-border">|</span>
                <span className="italic text-foreground-tertiary">{getDailyQuote(now)}</span>
              </p>
            </div>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {HERO_STATS.map((stat) => (
              <div key={stat.key} className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                  <stat.icon size={16} className="text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-foreground-tertiary">{stat.label}</p>
                  <p className="text-[18px] font-bold text-foreground font-num leading-tight">{data?.[stat.key] ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          자주 사용하는 메뉴 — 원형 아이콘
         ═══════════════════════════════════════ */}
      <section className="rounded-2xl border border-border bg-white px-6 py-5 shadow-sm sm:px-8">
        <h2 className="text-[15px] font-bold text-foreground">자주 사용하는 메뉴</h2>
        <div className="mt-5 flex flex-wrap items-start gap-x-6 gap-y-4 sm:gap-x-8">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.label} href={action.href} className="group flex w-[60px] flex-col items-center gap-2 text-center">
                <div className={`flex h-[52px] w-[52px] items-center justify-center rounded-full ${action.bg} ${action.hover} transition-all group-hover:shadow-md`}>
                  <Icon size={22} strokeWidth={1.5} className={action.color} />
                </div>
                <span className="break-keep text-[11px] font-medium leading-tight text-foreground-secondary group-hover:text-foreground">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          이번 달 일정 + 최근 파일
         ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(280px,1fr)_minmax(0,2.5fr)]">
        {/* 캘린더 */}
        <section className="rounded-2xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-foreground">이번 달 일정</h2>
              <Link href="/schedule" className="inline-flex items-center gap-0.5 text-[12px] font-medium text-primary hover:underline">
                전체 보기 <ChevronRight size={14} />
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-4 px-5 py-5">
            {/* Mini Calendar */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-bold text-foreground">{format(now, 'yyyy년 M월', { locale: ko })}</p>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                  오늘 {todayEvents.length}건
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_LABELS.map((label, i) => (
                  <div key={label} className={`pb-1 text-center text-[10px] font-bold ${i === 0 ? 'text-danger' : i === 6 ? 'text-primary' : 'text-foreground-tertiary'}`}>
                    {label}
                  </div>
                ))}
                {calendarDays.map((day) => {
                  const dayEv = events.filter((e) => isEventOnDate(e, day));
                  const inMonth = day.getMonth() === now.getMonth();
                  return (
                    <div key={day.toISOString()} className={`relative flex h-8 items-center justify-center rounded-lg text-[11px] font-medium transition-colors ${
                      isToday(day) ? 'bg-primary font-bold text-white shadow-sm' : inMonth ? 'text-foreground hover:bg-surface-secondary' : 'text-foreground-quaternary/50'
                    }`}>
                      {format(day, 'd')}
                      {dayEv.length > 0 && (
                        <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${isToday(day) ? 'bg-white' : ''}`}
                          style={isToday(day) ? undefined : { backgroundColor: getEventTypeColor(dayEv[0].event_type) }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 다가오는 일정 */}
            <UpcomingEventsSlider events={upcomingEvents} />
          </div>
        </section>

        {/* 최근 파일 */}
        <DashboardMidSection recentFiles={recentFiles} data={data as never} loading={loading} />
      </div>

      {/* ═══════════════════════════════════════
          분석 섹션
         ═══════════════════════════════════════ */}
      <DashboardBottomSection data={data as never} loading={loading} />
    </div>
  );
}
