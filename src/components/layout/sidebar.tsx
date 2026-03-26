'use client';

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
import { Avatar } from '@/components/ui/avatar';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: '대시보드', href: '/', icon: LayoutDashboard },
  { label: 'AI 검색', href: '/search', icon: Search },
  { label: '파일 관리', href: '/files', icon: FolderOpen },
  { label: '문서 생성', href: '/documents', icon: FilePlus },
  { label: '템플릿', href: '/templates', icon: FileText },
  { label: '메시지', href: '/messages', icon: MessageSquare },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-navy text-white transition-all duration-200',
        collapsed ? 'w-[64px]' : 'w-[232px]'
      )}
    >
      {/* Wordmark */}
      <div
        className={cn(
          'flex items-center h-14 px-5 flex-shrink-0 border-b border-white/[0.06]',
          collapsed && 'justify-center px-0'
        )}
      >
        {collapsed ? (
          <span className="font-en text-[17px] font-extrabold tracking-wordmark text-white select-none">
            C
          </span>
        ) : (
          <span className="font-en text-[17px] font-extrabold tracking-wordmark text-white select-none">
            CLIO
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                'hover:bg-white/[0.08]',
                isActive
                  ? 'bg-white/[0.10] text-white'
                  : 'text-white/60',
                collapsed && 'justify-center px-0 gap-0'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2 : 1.5}
                className="flex-shrink-0"
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="flex-shrink-0 border-t border-white/[0.06] p-2">
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-md px-3 py-2',
            collapsed && 'justify-center px-0'
          )}
        >
          <Avatar name="김대장" size="sm" className="bg-white/[0.15] text-white text-[11px]" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white/90 truncate">김대장</p>
              <p className="text-[11px] text-white/40 truncate font-en">총무팀</p>
            </div>
          )}
          {!collapsed && (
            <Link
              href="/settings"
              className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              <Settings size={15} strokeWidth={1.5} />
            </Link>
          )}
        </div>

        <button
          onClick={onToggle}
          className={cn(
            'flex items-center justify-center w-full mt-1 py-1.5 rounded-md',
            'text-white/30 hover:text-white/50 hover:bg-white/[0.06] transition-colors',
            'cursor-pointer'
          )}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}

export { Sidebar };
export type { SidebarProps };
