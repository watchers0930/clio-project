'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import {
  LayoutDashboard,
  Search,
  FolderOpen,
  ArrowRightLeft,
  FilePlus,
  CalendarDays,
  Users,
  MessageSquare,
  MessageSquareText,
  ShieldAlert,
  StickyNote,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLATFORM_CORE_FLOW, PLATFORM_LABEL, PLATFORM_SHORT_GUIDE } from '@/lib/constants/ui';

interface NavItem {
  group: 'core' | 'collab' | 'support';
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: boolean;
  description?: string;
}

const navItems: NavItem[] = [
  { group: 'core', label: '대시보드', href: '/dashboard', icon: LayoutDashboard, description: '문서 운영 현황과 우선순위' },
  { group: 'core', label: '문서허브', href: '/files', icon: FolderOpen, description: '저장, 공유, 반영의 시작점' },
  { group: 'core', label: 'AI 검색', href: '/search', icon: Search, description: '문서 탐색과 재활용 진입점' },
  { group: 'core', label: '문서 생성', href: '/documents', icon: FilePlus, description: '초안, 검토, 공유까지 연결' },
  { group: 'core', label: '코멘트/검토', href: '/reviews', icon: MessageSquareText, description: '미반영 의견과 검토 대기 문서' },
  { group: 'core', label: '공유 문서', href: '/shared-documents', icon: ArrowRightLeft, description: '공유받은 문서와 배포 중 문서' },
  { group: 'collab', label: '메시지', href: '/messages', icon: MessageSquare, badge: true, description: '문서 기반 대화와 공유' },
  { group: 'collab', label: '회의', href: '/meetings', icon: Users, description: '회의 일정에서 회의록과 후속 문서로 연결' },
  { group: 'collab', label: '일정/할일', href: '/schedule', icon: CalendarDays, description: '회의와 실행 일정 정리' },
  { group: 'collab', label: '메모', href: '/memos', icon: StickyNote, description: '문서와 연결되는 메모' },
  { group: 'support', label: '계약 리스크', href: '/contract-risk', icon: ShieldAlert, description: '특정 문서용 전문 분석 기능' },
  { group: 'support', label: '설정', href: '/settings', icon: Settings, description: '사용자, 부서, 템플릿, 서명 설정' },
];

const navGroups: Array<{ key: NavItem['group']; label: string; accent: string; helper: string }> = [
  { key: 'core', label: '문서 운영', accent: 'text-white/65', helper: PLATFORM_CORE_FLOW },
  { key: 'collab', label: '기타 메뉴', accent: 'text-white/58', helper: '메시지 · 회의 · 일정/할일 · 메모' },
  { key: 'support', label: '업무 지원', accent: 'text-white/58', helper: '전문 기능 · 설정' },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobile?: boolean;
}

const SIDEBAR_SPACING = {
  brandX: 24,
  navGap: 18,
  navX: 20,
  navTop: 24,
  navBottom: 22,
  platformCardPadding: '18px 18px 16px',
  groupGap: 10,
  footerX: 20,
  footerBottom: 24,
} as const;

const UNREAD_POLL_INTERVAL_MS = 60_000;

function Sidebar({ collapsed = false, onToggle, mobile = false }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [openGroups, setOpenGroups] = useState<Record<'collab' | 'support', boolean>>({
    collab: false,
    support: false,
  });

  // 안 읽은 메시지 수 폴링
  useEffect(() => {
    if (pathname.startsWith('/messages')) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchUnread = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetch('/api/messages/unread')
        .then(r => r.json())
        .then(d => { if (d.success) setUnreadTotal(d.total); })
        .catch(() => {});
    };

    const startPolling = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(fetchUnread, UNREAD_POLL_INTERVAL_MS);
    };

    fetchUnread();
    startPolling();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnread();
        startPolling();
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    window.addEventListener('focus', fetchUnread);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', fetchUnread);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pathname]);

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-sidebar text-white transition-all duration-300 ease-out',
        mobile ? 'w-[86vw] max-w-[320px] shadow-2xl' : collapsed ? 'w-[72px]' : 'w-[280px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-[56px] flex-shrink-0',
        collapsed && !mobile ? 'justify-center' : ''
      )} style={collapsed ? undefined : { paddingLeft: SIDEBAR_SPACING.brandX, paddingRight: SIDEBAR_SPACING.brandX }}>
        <span className="text-[28px] tracking-[0.3em] text-white select-none" style={{ fontWeight: 300, fontFamily: '"Times New Roman", Times, serif' }}>
          {collapsed && !mobile ? 'C' : 'CLIO'}
        </span>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 flex flex-col overflow-y-auto sidebar-scroll"
        style={{
          gap: SIDEBAR_SPACING.navGap,
          paddingLeft: SIDEBAR_SPACING.navX,
          paddingRight: SIDEBAR_SPACING.navX,
          paddingTop: SIDEBAR_SPACING.navTop,
          paddingBottom: SIDEBAR_SPACING.navBottom,
        }}
      >
        {!collapsed && (
          <div className="rounded-2xl border border-white/14 bg-white/[0.07]" style={{ padding: SIDEBAR_SPACING.platformCardPadding }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">Platform</p>
            <p className="mt-2 text-[13px] font-medium text-white">{PLATFORM_LABEL}</p>
            <p className="mt-1 text-[11px] leading-5 text-white/70">{PLATFORM_SHORT_GUIDE}</p>
          </div>
        )}

        {navGroups.map((group) => (
          <div key={group.key} className="flex flex-col" style={{ gap: SIDEBAR_SPACING.groupGap }}>
            {(() => {
              const groupHasActiveItem = navItems
                .filter((item) => item.group === group.key)
                .some((item) => pathname === item.href || (item.href !== '/dashboard' && item.href !== '/settings' && pathname.startsWith(item.href)));
              const collapsibleGroupKey = group.key === 'core' ? null : group.key;
              const isGroupOpen = group.key === 'core' || collapsed || mobile || groupHasActiveItem || (collapsibleGroupKey ? openGroups[collapsibleGroupKey] : false);

              return (
                <>
            {!collapsed && (
              group.key === 'core' ? (
                <div className="px-2">
                  <p className={cn('text-[10px] font-semibold uppercase tracking-[0.2em]', group.accent)}>
                    {group.label}
                  </p>
                  <p className="mt-1 text-[10px] text-white/46">{group.helper}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!collapsibleGroupKey) return;
                    setOpenGroups((prev) => ({ ...prev, [collapsibleGroupKey]: !prev[collapsibleGroupKey] }));
                  }}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-left text-white/72 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <div>
                    <p className={cn('text-[10px] font-semibold uppercase tracking-[0.2em]', group.accent)}>
                      {group.label}
                    </p>
                    <p className="mt-1 text-[10px] text-white/46">{group.helper}</p>
                  </div>
                  {isGroupOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )
            )}
            {isGroupOpen && navItems.filter((item) => item.group === group.key).map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && item.href !== '/settings' && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-xl transition-all duration-150 border',
                    isActive
                      ? 'border-white/12 bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                      : 'border-transparent text-white/78 hover:bg-white/[0.07] hover:text-white',
                    collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2.5'
                  )}
                  title={collapsed && !mobile ? item.label : undefined}
                >
                  <div className="relative flex-shrink-0">
                    <Icon size={17} strokeWidth={1.5} />
                    {item.badge && (() => {
                      return unreadTotal > 0 ? (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center" style={{ padding: '0 3px' }}>
                          {unreadTotal > 99 ? '99+' : unreadTotal}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  {(!collapsed || mobile) && (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium">{item.label}</span>
                        {item.badge && unreadTotal > 0 ? (
                          <span className="min-w-[20px] h-[20px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center" style={{ padding: '0 5px' }}>
                            {unreadTotal > 99 ? '99+' : unreadTotal}
                          </span>
                        ) : null}
                      </div>
                      {item.description ? (
                        <p className={cn('mt-0.5 truncate text-[10px]', isActive ? 'text-white/82' : 'text-white/56')}>
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  )}
                </Link>
              );
            })}
                </>
              );
            })()}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="flex-shrink-0" style={{ marginBottom: SIDEBAR_SPACING.footerBottom }}>
        <div className={cn(
          'flex items-center gap-2.5 py-2.5',
          collapsed && !mobile ? 'justify-center px-0' : ''
        )} style={collapsed && !mobile ? undefined : { paddingLeft: SIDEBAR_SPACING.footerX, paddingRight: SIDEBAR_SPACING.footerX }}>
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-semibold text-primary-light flex-shrink-0">
            {user?.name?.charAt(0) ?? '?'}
          </div>
          {(!collapsed || mobile) && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-white truncate">{user?.name ?? '사용자'}</p>
                <p className="text-[10px] text-white/65 truncate">{user?.email ?? ''}</p>
              </div>
              {!mobile && (
                <button
                  onClick={onToggle}
                  className="text-white/50 hover:text-white/85 transition-colors cursor-pointer p-1"
                >
                  <ChevronsLeft size={16} />
                </button>
              )}
            </>
          )}
          {collapsed && !mobile && (
            <button
              onClick={onToggle}
              className="text-white/50 hover:text-white/85 transition-colors cursor-pointer"
            >
              <ChevronsRight size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export { Sidebar };
export type { SidebarProps };
