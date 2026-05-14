import Link from 'next/link';
import { FilePlus, FolderOpen, Mic, Sparkles, ScrollText } from 'lucide-react';
import {
  PLATFORM_LABEL,
} from '@/lib/constants/ui';
import { buildReportDraftHref } from '@/lib/documents/navigation';

interface DocumentsPageHeaderProps {
  onOpenStt: () => void;
  onOpenCreate: () => void;
}

export function DocumentsPageHeader({
  onOpenStt,
  onOpenCreate,
}: DocumentsPageHeaderProps) {
  const actionCards = [
    {
      label: '새 문서 생성',
      description: '초안 시작',
      icon: FilePlus,
      kind: 'button' as const,
      onClick: onOpenCreate,
    },
    {
      label: '음성회의록',
      description: '회의록 생성',
      icon: Mic,
      kind: 'button' as const,
      onClick: onOpenStt,
    },
    {
      label: '문서허브 보기',
      description: '파일 확인',
      icon: FolderOpen,
      kind: 'link' as const,
      href: '/files',
    },
    {
      label: 'AI 검색 연결',
      description: '근거 찾기',
      icon: Sparkles,
      kind: 'link' as const,
      href: '/search',
    },
    {
      label: '보고서 흐름',
      description: '보고서 작성',
      icon: ScrollText,
      kind: 'link' as const,
      href: buildReportDraftHref(),
    },
  ];

  return (
    <section className="rounded-[28px] border border-[#e5e5e7] bg-white overflow-hidden">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-[30px] lg:py-[30px]">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0071e3]">{PLATFORM_LABEL}</p>
            <h1 className="text-[24px] font-bold leading-[1.2] text-[#1d1d1f] sm:text-[28px]">문서 생성</h1>
            <p className="max-w-2xl text-[14px] text-[#6e6e73] sm:text-[15px]" style={{ lineHeight: '20px' }}>
              시작할 작업을 선택하세요.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-5" style={{ gap: 16 }}>
              {actionCards.map((card) => {
                const Icon = card.icon;
                const baseClassName =
                  'flex h-full flex-col rounded-2xl border border-[#E2E5EA] bg-white text-left text-[#1d1d1f] hover:border-[#0071e3]/35 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] transition-all';

                const content = (
                  <>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F3F8FF] text-[#2E6FF2]">
                      <Icon size={20} strokeWidth={1.8} />
                    </div>
                    <p className="mt-4 text-[14px] font-semibold text-[#1B1F2B]">{card.label}</p>
                    <p className="mt-2 text-[12px] leading-5 text-[#6B7280]">{card.description}</p>
                    <div className="mt-auto pt-4">
                      <span className="inline-flex items-center rounded-full border border-[#D7E7FF] bg-[#F3F8FF] px-3 py-1.5 text-[12px] font-semibold text-[#2E6FF2]">
                        바로가기
                      </span>
                    </div>
                  </>
                );

                if (card.kind === 'button') {
                  return (
                    <button
                      key={card.label}
                      type="button"
                      onClick={card.onClick}
                      className={baseClassName}
                      style={{ padding: '16px 14px', minHeight: 152 }}
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <Link
                    key={card.label}
                    href={card.href}
                    className={baseClassName}
                    style={{ padding: '16px 14px', minHeight: 152 }}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-[#e5e5e7] bg-[#fbfbfc] px-4 py-5 sm:px-6 sm:py-6 xl:border-l xl:border-t-0 xl:px-[28px] xl:py-[28px]">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6e6e73]">Recommended Flow</p>
            <h2 className="text-[18px] font-semibold text-[#1d1d1f]">추천 순서</h2>
            <div className="flex flex-col" style={{ gap: 12 }}>
              <div className="rounded-2xl border border-[#e5e5e7] bg-white" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p className="text-[14px] font-semibold text-[#1d1d1f]">1. 초안 생성</p>
                  <p className="text-[12px] leading-5 text-[#6e6e73]">첫 문서 만들기</p>
                </div>
              </div>
              <div className="rounded-2xl border border-[#e5e5e7] bg-white" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p className="text-[14px] font-semibold text-[#1d1d1f]">2. 검토/반영</p>
                  <p className="text-[12px] leading-5 text-[#6e6e73]">댓글과 수정 처리</p>
                </div>
              </div>
              <div className="rounded-2xl border border-[#e5e5e7] bg-white" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p className="text-[14px] font-semibold text-[#1d1d1f]">3. 공유/재활용</p>
                  <p className="text-[12px] leading-5 text-[#6e6e73]">배포와 후속 작성</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
