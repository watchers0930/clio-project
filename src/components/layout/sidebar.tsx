'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import {
  Search,
  FolderOpen,
  ArrowRightLeft,
  FilePlus,
  CalendarDays,
  Users,
  MessageSquare,
  ShieldAlert,
  StickyNote,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: boolean;
  description?: string;
}

// 항상 표시되는 핵심 메뉴
const CORE_ITEMS: NavItem[] = [
  { key: 'search', label: 'AI 검색', href: '/search', icon: Search, description: '검색 · AI 상담' },
  { key: 'documents', label: '새 문서 생성', href: '/documents', icon: FilePlus, description: '초안 작성 · 다운로드' },
  { key: 'files', label: '파일 등록', href: '/files', icon: FolderOpen, description: '문서 저장 · 관리' },
];

// 설정에서 ON/OFF 가능한 선택 메뉴
const OPTIONAL_ITEMS: NavItem[] = [
  { key: 'shared-documents', label: '공유 문서', href: '/shared-documents', icon: ArrowRightLeft, description: '공유받은 문서' },
  { key: 'messages', label: '메시지', href: '/messages', icon: MessageSquare, badge: true, description: '채널 · DM' },
  { key: 'meetings', label: '회의', href: '/meetings', icon: Users, description: '회의록 · 일정' },
  { key: 'schedule', label: '일정/할일', href: '/schedule', icon: CalendarDays, description: '캘린더 · 할일' },
  { key: 'memos', label: '메모', href: '/memos', icon: StickyNote, description: '메모 · 인사이트' },
  { key: 'contract-risk', label: '계약 리스크', href: '/contract-risk', icon: ShieldAlert, description: 'AI 계약 분석' },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobile?: boolean;
}

const UNREAD_POLL_INTERVAL_MS = 60_000;

function Sidebar({ collapsed = false, onToggle, mobile = false }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const enabledOptional = (user?.sidebar_menus ?? []) as string[];
  const visibleOptional = OPTIONAL_ITEMS.filter((item) => enabledOptional.includes(item.key));

  // 안 읽은 메시지 수 폴링
  useEffect(() => {
    if (!enabledOptional.includes('messages')) return;
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
  }, [pathname, enabledOptional]);

  const renderItem = (item: NavItem) => {
    const isActive = pathname === item.href ||
      (item.href !== '/settings' && pathname.startsWith(item.href));
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center rounded-md transition-all duration-150 border',
          isActive
            ? 'border-white/12 bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
            : 'border-transparent text-white/78 hover:bg-white/[0.07] hover:text-white',
          collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2.5'
        )}
        title={collapsed && !mobile ? item.label : undefined}
      >
        <div className="relative flex-shrink-0">
          <Icon size={17} strokeWidth={1.5} />
          {item.badge && unreadTotal > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center px-0.5">
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </span>
          )}
        </div>
        {(!collapsed || mobile) && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium">{item.label}</span>
              {item.badge && unreadTotal > 0 && (
                <span className="min-w-5 h-5 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadTotal > 99 ? '99+' : unreadTotal}
                </span>
              )}
            </div>
            {item.description && (
              <p className={cn('mt-0.5 truncate text-[10px]', isActive ? 'text-white/82' : 'text-white/56')}>
                {item.description}
              </p>
            )}
          </div>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-sidebar text-white transition-all duration-300 ease-out',
        mobile ? 'w-[86vw] max-w-[320px] shadow-2xl' : collapsed ? 'w-[72px]' : 'w-[280px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-14 flex-shrink-0',
        collapsed && !mobile ? 'justify-center' : 'px-6'
      )}>
        <Link href="/dashboard" className="text-[28px] font-light tracking-[0.3em] text-white select-none font-serif hover:text-white/80 transition-colors">
          {collapsed && !mobile ? 'C' : 'CLIO'}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col overflow-y-auto sidebar-scroll px-4 py-4 gap-1">
        {/* 핵심 메뉴 */}
        {CORE_ITEMS.map(renderItem)}

        {/* 선택 메뉴 구분선 */}
        {visibleOptional.length > 0 && (
          <div className={cn('my-2', collapsed && !mobile ? 'mx-2' : 'mx-1')}>
            <div className="border-t border-white/10" />
          </div>
        )}

        {/* 선택 메뉴 */}
        {visibleOptional.map(renderItem)}

        {/* 설정 구분선 */}
        <div className={cn('mt-auto pt-2', collapsed && !mobile ? 'mx-2' : 'mx-1')}>
          <div className="border-t border-white/10 mb-2" />
        </div>

        {/* 설정 */}
        {renderItem({ key: 'settings', label: '설정', href: '/settings', icon: Settings, description: '메뉴 · 부서 · 사용자' })}
      </nav>

      {/* Bottom — 사용자 정보 */}
      <div className="flex-shrink-0 mb-5">
        <div className={cn(
          'flex items-center gap-2.5 py-2.5',
          collapsed && !mobile ? 'justify-center px-0' : 'px-5'
        )}>
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
