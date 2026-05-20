'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderOpen,
  ArrowRightLeft,
  Search,
  MessageSquareText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { label: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { label: '문서허브', href: '/files', icon: FolderOpen },
  { label: '검색', href: '/search', icon: Search },
  { label: '검토', href: '/reviews', icon: MessageSquareText },
  { label: '공유', href: '/shared-documents', icon: ArrowRightLeft },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const isViewer = /^\/documents\/[^/]+$/.test(pathname ?? '');

  if (isViewer) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/92 backdrop-blur-xl lg:hidden">
      <nav className="mx-auto flex h-[78px] max-w-xl items-center justify-around px-2.5 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-lg px-2.5 py-2.5 text-center transition-colors',
                isActive ? 'text-primary' : 'text-foreground-secondary',
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                  isActive ? 'bg-primary-tint text-primary' : 'bg-transparent text-inherit',
                )}
              >
                <Icon size={18} strokeWidth={1.9} />
              </div>
              <span className="text-[10px] font-semibold tracking-[0.01em] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
