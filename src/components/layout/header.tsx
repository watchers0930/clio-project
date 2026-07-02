'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  onMenuClick?: () => void;
}

function Header({
  onMenuClick,
}: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const pageTitle = (() => {
    if (!pathname) return 'CLIO';
    if (pathname.startsWith('/dashboard')) return '대시보드';
    if (pathname.startsWith('/files')) return '파일 등록';
    if (pathname.startsWith('/documents')) return '문서 생성';
    if (pathname.startsWith('/shared-documents')) return '공유 문서';
    if (pathname.startsWith('/messages')) return '메시지';
    if (pathname.startsWith('/memos')) return '메모';
    if (pathname.startsWith('/search')) return 'AI 검색';
    if (pathname.startsWith('/meetings')) return '회의';
    if (pathname.startsWith('/schedule')) return '일정/할일';
    if (pathname.startsWith('/reviews')) return '코멘트/검토';
    if (pathname.startsWith('/settings')) return '설정';
    return 'CLIO';
  })();

  return (
    <header className="h-[68px] border-b border-border bg-white/92 backdrop-blur-md flex-shrink-0 lg:h-[72px]">
      <div className="flex h-full items-center px-4 sm:px-6 lg:px-10">
        {/* Left — mobile menu only */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-3 rounded-xl text-muted hover:bg-page-bg cursor-pointer transition-colors"
          >
            <Menu size={20} strokeWidth={1.5} />
          </button>
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-[15px] font-semibold text-foreground">{pageTitle}</p>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search size={15} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="검색..."
              style={{ paddingLeft: '2.5rem' }}
              className={cn(
                'w-[220px] h-[42px] pr-4',
                'rounded-md border border-border bg-page-bg text-sm',
                'placeholder:text-muted/60',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'transition-all duration-300'
              )}
            />
          </div>


          {/* User */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors cursor-pointer hover:bg-page-bg"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary">
                {user?.name?.charAt(0) ?? '?'}
              </div>
              <div className="hidden text-left lg:block">
                <p className="max-w-[120px] truncate text-[12px] font-semibold text-foreground">{user?.name ?? '사용자'}</p>
              </div>
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-3 w-56 rounded-2xl border border-border bg-white shadow-lg z-50 py-3">
                  <div className="border-b border-border px-5 py-4">
                    <p className="text-[14px] font-semibold text-foreground">{user?.name ?? '사용자'}</p>
                    <p className="text-[12px] text-muted font-en">{user?.email ?? ''}</p>
                  </div>
                  <Link href="/settings" className="block px-5 py-3 text-[14px] text-foreground hover:bg-page-bg transition-colors" onClick={() => setUserMenuOpen(false)}>
                    설정
                  </Link>
                  <button
                    className="block w-full text-left px-5 py-3 text-[14px] text-foreground hover:bg-page-bg transition-colors cursor-pointer"
                    onClick={async () => {
                      setUserMenuOpen(false);
                      const newPw = prompt('새 비밀번호를 입력하세요 (6자 이상)');
                      if (!newPw || newPw.length < 6) { if (newPw !== null) alert('비밀번호는 6자 이상이어야 합니다.'); return; }
                      const res = await fetch('/api/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword: newPw }) });
                      const json = await res.json();
                      alert(json.success ? '비밀번호가 변경되었습니다.' : (json.error ?? '비밀번호 변경에 실패했습니다.'));
                    }}
                  >
                    비밀번호 변경
                  </button>
                  <hr className="my-1 border-border" />
                  <button
                    className="block w-full text-left px-5 py-3 text-[14px] text-danger hover:bg-danger/5 transition-colors cursor-pointer"
                    onClick={async () => {
                      setUserMenuOpen(false);
                      await logout();
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
