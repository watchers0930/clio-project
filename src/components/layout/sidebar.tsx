'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  FolderOpen,
  FileText,
  FilePlus,
  MessageSquare,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: boolean;
}

const navItems: NavItem[] = [
  { label: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { label: 'AI 검색', href: '/search', icon: Search },
  { label: '파일 관리', href: '/files', icon: FolderOpen },
  { label: '문서 생성', href: '/documents', icon: FilePlus },
  { label: '템플릿', href: '/templates', icon: FileText },
  { label: '메시지', href: '/messages', icon: MessageSquare, badge: true },
  { label: '설정', href: '/settings', icon: Settings },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('clio_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  // 안 읽은 메시지 수 폴링 (10초)
  useEffect(() => {
    const fetchUnread = () => {
      fetch('/api/messages/unread')
        .then(r => r.json())
        .then(d => { if (d.success) setUnreadTotal(d.total); })
        .catch(() => {});
    };
    fetchUnread();
    const timer = setInterval(fetchUnread, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-sidebar text-white transition-all duration-300 ease-out',
        collapsed ? 'w-[56px]' : 'w-[182px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-[56px] flex-shrink-0',
        collapsed ? 'justify-center' : ''
      )} style={collapsed ? undefined : { paddingLeft: 20 }}>
        <span className="text-[28px] tracking-[0.3em] text-white select-none" style={{ fontWeight: 300, fontFamily: '"Times New Roman", Times, serif' }}>
          {collapsed ? 'C' : 'CLIO'}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col overflow-y-auto sidebar-scroll" style={{ gap: 6, paddingLeft: 20, paddingRight: 12, paddingTop: 40, paddingBottom: 20 }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 py-2 text-[13px] font-medium transition-all duration-150',
                isActive
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/70',
                collapsed && 'justify-center gap-0'
              )}
              title={collapsed ? item.label : undefined}
            >
              <div className="relative flex-shrink-0">
                <Icon size={17} strokeWidth={1.5} />
                {item.badge && unreadTotal > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center" style={{ padding: '0 3px' }}>
                    {unreadTotal > 99 ? '99+' : unreadTotal}
                  </span>
                )}
              </div>
              {!collapsed && (
                <span className="flex-1">{item.label}</span>
              )}
              {!collapsed && item.badge && unreadTotal > 0 && (
                <span className="min-w-[20px] h-[20px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center" style={{ padding: '0 5px' }}>
                  {unreadTotal > 99 ? '99+' : unreadTotal}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="flex-shrink-0" style={{ marginBottom: 30 }}>
        <div className={cn(
          'flex items-center gap-2.5 py-2.5',
          collapsed ? 'justify-center px-0' : ''
        )} style={collapsed ? undefined : { paddingLeft: 20, paddingRight: 12 }}>
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-semibold text-primary-light flex-shrink-0">
            {user?.name?.charAt(0) ?? '?'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-white truncate">{user?.name ?? '사용자'}</p>
                <p className="text-[10px] text-white/40 truncate">{user?.email ?? ''}</p>
              </div>
              <button
                onClick={onToggle}
                className="text-white/20 hover:text-white/40 transition-colors cursor-pointer p-1"
              >
                <ChevronsLeft size={16} />
              </button>
            </>
          )}
          {collapsed && (
            <button
              onClick={onToggle}
              className="text-white/20 hover:text-white/40 transition-colors cursor-pointer"
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
