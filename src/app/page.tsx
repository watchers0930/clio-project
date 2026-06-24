'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { CalendarDays, FilePlus, FolderOpen, Mic, Search, StickyNote, Users } from 'lucide-react';
import { PLATFORM_LABEL } from '@/lib/constants/ui';

const entryOptions = [
  {
    title: '새 문서 생성',
    description: '초안 작성이나 후속 문서 작성을 바로 시작합니다.',
    href: '/documents?create=true',
    icon: FilePlus,
  },
  {
    title: 'AI 검색',
    description: '기존 문서를 찾고 근거를 확인한 뒤 작업을 이어갑니다.',
    href: '/search',
    icon: Search,
  },
  {
    title: '파일 관리',
    description: '문서를 업로드하고 저장된 파일을 관리합니다.',
    href: '/files',
    icon: FolderOpen,
  },
  {
    title: '회의',
    description: '회의 일정에서 회의록과 후속 문서 흐름으로 이어갑니다.',
    href: '/meetings',
    icon: Users,
  },
  {
    title: '메모',
    description: '문서와 연결된 아이디어와 근거를 빠르게 남깁니다.',
    href: '/memos',
    icon: StickyNote,
  },
  {
    title: '일정 / 할일',
    description: '일정을 확인하고 해야 할 일을 함께 관리합니다.',
    href: '/schedule',
    icon: CalendarDays,
  },
] as const;

export default function RootPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const fetchMe = useAuthStore((state) => state.fetchMe);

  useEffect(() => {
    if (hasHydrated && !token) {
      router.replace('/login');
    }
  }, [hasHydrated, router, token]);

  useEffect(() => {
    if (hasHydrated && token) {
      void fetchMe();
    }
  }, [fetchMe, hasHydrated, token]);

  if (!hasHydrated || !token) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-navy border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-start justify-center px-5 pb-8 pt-9">
      <div className="mx-auto w-full max-w-[740px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="text-[44px] font-light tracking-[0.3em] text-foreground font-serif">
            CLIO
          </h1>
          <p className="mt-3 text-[15px] text-foreground-secondary">
            {PLATFORM_LABEL}
          </p>
          <p className="mt-2.5 mb-5 max-w-[520px] text-center text-[13px] leading-5 text-foreground-tertiary">
            CLIO는 기업 문서를 한곳에 저장한 뒤, 공유하고, 코멘트를 반영하고,
            <br className="hidden md:block" />
            다시 검색해 재활용하는 문서 운영 플랫폼입니다.
          </p>
          <div className="h-3 w-full" aria-hidden="true" />
        </div>

        <section className="mt-[12px] rounded-2xl border border-border bg-white px-5 py-7 md:px-[64px] md:pt-7 md:pb-9">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-primary">Quick Start</p>
          <h2 className="mt-3 text-[28px] font-semibold leading-[1.2] text-foreground">
            무엇부터 시작할까요?
          </h2>
          <div className="mt-2 flex flex-col gap-4">
            <p className="text-[13px] leading-6 text-foreground-secondary">
              로그인 후 첫 진입점은 문서허브입니다. 가장 자주 쓰는 작업부터 바로 이어서 시작할 수 있습니다.
            </p>

            <div className="h-5" aria-hidden="true" />
            <div className="grid grid-cols-2 gap-3">
              {entryOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <Link
                    key={option.title}
                    href={option.href}
                    className="group h-full rounded-xl border border-border bg-surface-secondary px-4 py-4 transition-colors hover:border-primary hover:bg-white"
                  >
                    <div className="flex h-full items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary transition-colors group-hover:bg-primary-tint">
                        <Icon size={19} strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[17px] font-semibold text-foreground">{option.title}</div>
                        <p className="mt-1.5 text-[13px] leading-5 text-foreground-secondary">{option.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-0.5 rounded-2xl border border-border-tint bg-primary-tint px-4 py-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Quick Capture</p>
                  <p className="mt-1 text-[14px] font-semibold text-foreground">회의 녹음으로 바로 회의록을 시작합니다</p>
                  <p className="mt-0.5 text-[12px] leading-5 text-foreground-secondary md:truncate">
                    마이크로 바로 녹음하거나 음성 파일을 올려 회의록과 할일 추출까지 바로 이어갑니다.
                  </p>
                </div>
                <Link
                  href="/meetings?record=true"
                  className="inline-flex items-center justify-center gap-2 self-start whitespace-nowrap rounded-xl bg-foreground px-4 py-2.5 text-[12px] font-medium text-white hover:bg-primary transition-colors md:self-auto"
                >
                  <Mic size={15} />
                  회의 녹음 시작
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-3 rounded-xl border border-border bg-white px-5 py-3 text-center">
          <p className="text-[12px] text-foreground-secondary">
            문서 생성, 검색, 파일 운영뿐 아니라 회의, 메모, 일정과 할일, 음성 회의록 시작까지 첫 화면에서 바로 들어갈 수 있습니다.
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-foreground-secondary font-en">
          &copy; 2026 CLIO. All rights reserved.
        </p>
      </div>
    </div>
  );
}
