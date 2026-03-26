'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Bell, ChevronRight, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

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
  breadcrumbs = [],
  notificationCount = 0,
  onMenuClick,
}: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-clio-border flex-shrink-0">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-clio-text-secondary hover:bg-clio-bg cursor-pointer"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-sm">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={index} className="flex items-center gap-1.5">
                {index > 0 && (
                  <ChevronRight
                    size={14}
                    className="text-clio-text-secondary/50"
                  />
                )}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="text-clio-text-secondary hover:text-clio-text transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      isLast
                        ? 'font-medium text-clio-text'
                        : 'text-clio-text-secondary'
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      {/* Right: search + notifications + avatar */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-clio-text-secondary/60"
          />
          <input
            type="text"
            placeholder="검색..."
            className={cn(
              'h-9 w-48 rounded-lg border border-clio-border bg-clio-bg pl-9 pr-3 text-sm',
              'placeholder:text-clio-text-secondary/50',
              'focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent',
              'focus:w-64 transition-all'
            )}
          />
        </div>

        {/* Mobile search toggle */}
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="sm:hidden p-2 rounded-lg text-clio-text-secondary hover:bg-clio-bg cursor-pointer"
        >
          <Search size={20} />
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-clio-text-secondary hover:bg-clio-bg transition-colors cursor-pointer">
          <Bell size={20} />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-danger text-white text-[10px] font-bold px-1">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>

        {/* User avatar / dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-clio-bg transition-colors cursor-pointer"
          >
            <Avatar name="사용자" size="sm" />
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-clio-border bg-white shadow-lg z-50 py-1">
                <Link
                  href="/settings"
                  className="block px-4 py-2.5 text-sm text-clio-text hover:bg-clio-bg transition-colors"
                  onClick={() => setUserMenuOpen(false)}
                >
                  설정
                </Link>
                <Link
                  href="/settings/profile"
                  className="block px-4 py-2.5 text-sm text-clio-text hover:bg-clio-bg transition-colors"
                  onClick={() => setUserMenuOpen(false)}
                >
                  프로필
                </Link>
                <hr className="my-1 border-clio-border" />
                <button
                  className="block w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors cursor-pointer"
                  onClick={() => setUserMenuOpen(false)}
                >
                  로그아웃
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export { Header };
export type { HeaderProps, BreadcrumbItem };
