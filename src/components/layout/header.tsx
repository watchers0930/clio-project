'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Bell, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  notificationCount?: number;
  onMenuClick?: () => void;
}

function Header({
  notificationCount = 3,
  onMenuClick,
}: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="h-[64px] bg-white border-b border-border flex-shrink-0">
      <div className="flex items-center h-full" style={{ padding: '0 40px' }}>
        {/* Left — mobile menu only */}
        <div className="flex items-center">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2.5 rounded-xl text-muted hover:bg-page-bg cursor-pointer transition-colors"
          >
            <Menu size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden sm:block">
            <Search size={15} strokeWidth={1.5} className="absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none" style={{ left: 12 }} />
            <input
              type="text"
              placeholder="검색..."
              style={{ paddingLeft: 34, paddingRight: 14, height: 36, width: 200 }}
              className={cn(
                'rounded-xl border border-border bg-page-bg text-[14px]',
                'placeholder:text-muted/60',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'transition-all duration-300'
              )}
            />
          </div>

          {/* Notification */}
          <button className="relative p-2.5 rounded-xl text-muted hover:bg-page-bg transition-colors cursor-pointer">
            <Bell size={20} strokeWidth={1.5} />
            {notificationCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-danger text-white text-[10px] font-bold font-num" style={{ padding: '0 4px' }}>
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>

          {/* User */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-page-bg transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-[13px] font-semibold text-primary">
                김
              </div>
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-white shadow-lg z-50 py-2">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-[14px] font-semibold text-foreground">김관리</p>
                    <p className="text-[12px] text-muted font-en">admin@clio.kr</p>
                  </div>
                  <Link href="/settings" className="block px-4 py-2.5 text-[14px] text-foreground hover:bg-page-bg transition-colors" onClick={() => setUserMenuOpen(false)}>
                    설정
                  </Link>
                  <Link href="/settings" className="block px-4 py-2.5 text-[14px] text-foreground hover:bg-page-bg transition-colors" onClick={() => setUserMenuOpen(false)}>
                    프로필
                  </Link>
                  <hr className="my-1 border-border" />
                  <button
                    className="block w-full text-left px-4 py-2.5 text-[14px] text-danger hover:bg-danger/5 transition-colors cursor-pointer"
                    onClick={() => {
                      localStorage.removeItem('clio_token');
                      localStorage.removeItem('clio_user');
                      window.location.href = '/login';
                    }}
                  >
                    로그아웃
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export { Header };
export type { HeaderProps, BreadcrumbItem };
