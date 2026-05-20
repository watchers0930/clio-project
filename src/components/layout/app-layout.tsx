'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { MobileBottomNav } from './mobile-bottom-nav';
import { ToastRenderer } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth-store';
import { ExpiryAlertProvider } from '@/components/expiry/ExpiryAlertProvider';
import { OnboardingModal } from '@/components/common/OnboardingModal';

interface AppLayoutProps {
  children: ReactNode;
}

function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const initAuthListener = useAuthStore((s) => s.initAuthListener);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const token = useAuthStore((s) => s.token);
  const pathname = usePathname();
  // 전용 뷰어 페이지: 패딩·푸터 없이 풀스크린
  const isViewer = /^\/documents\/[^/]+$/.test(pathname ?? '');

  // 앱 마운트 시 Supabase auth 구독 시작
  useEffect(() => {
    const unsubscribe = initAuthListener();
    return unsubscribe;
  }, [initAuthListener]);

  // token은 있으나 user가 null인 경우(새로고침 등) → 프로필 복원
  useEffect(() => {
    if (token) fetchMe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ExpiryAlertProvider>
    <div className="flex h-screen overflow-hidden bg-page-bg">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile sidebar */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar mobile onToggle={() => setMobileMenuOpen(false)} />
          </div>
        </>
      )}

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
        {isViewer ? (
          /* 문서 뷰어: 풀스크린, 패딩·푸터 없음 */
          <main className="flex-1 overflow-y-auto pb-[88px] lg:pb-0">
            {children}
          </main>
        ) : (
          /* 일반 페이지: 스크롤 가능, 푸터는 콘텐츠 하단에 위치 */
          <main className="flex-1 overflow-y-auto pb-24 lg:pb-0">
            <div className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:px-10 xl:py-12">
              {children}
            </div>
          </main>
        )}
      </div>
      <MobileBottomNav />
      <ToastRenderer />
      <OnboardingModal />
    </div>
    </ExpiryAlertProvider>
  );
}

export { AppLayout };
export type { AppLayoutProps };
