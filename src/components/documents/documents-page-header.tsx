import Link from 'next/link';
import { FilePlus, FolderOpen, Mic, Sparkles, ScrollText } from 'lucide-react';
import { buildReportDraftHref } from '@/lib/documents/navigation';

interface DocumentsPageHeaderProps {
  onOpenStt: () => void;
  onOpenCreate: () => void;
}

const ACTION_CARDS = [
  { label: '새 문서', icon: FilePlus, bg: 'bg-blue-50', color: 'text-blue-500', hover: 'hover:bg-blue-100' },
  { label: '음성회의록', icon: Mic, bg: 'bg-violet-50', color: 'text-violet-500', hover: 'hover:bg-violet-100' },
  { label: '문서허브', icon: FolderOpen, bg: 'bg-emerald-50', color: 'text-emerald-500', hover: 'hover:bg-emerald-100' },
  { label: 'AI 검색', icon: Sparkles, bg: 'bg-amber-50', color: 'text-amber-500', hover: 'hover:bg-amber-100' },
  { label: '보고서', icon: ScrollText, bg: 'bg-rose-50', color: 'text-rose-500', hover: 'hover:bg-rose-100' },
] as const;

export function DocumentsPageHeader({
  onOpenStt,
  onOpenCreate,
}: DocumentsPageHeaderProps) {
  const actions: Array<{ label: string; icon: typeof FilePlus; bg: string; color: string; hover: string; href?: string; onClick?: () => void }> = [
    { ...ACTION_CARDS[0], onClick: onOpenCreate },
    { ...ACTION_CARDS[1], onClick: onOpenStt },
    { ...ACTION_CARDS[2], href: '/files' },
    { ...ACTION_CARDS[3], href: '/search' },
    { ...ACTION_CARDS[4], href: buildReportDraftHref() },
  ];

  return (
    <section className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-5 px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[20px] font-bold text-foreground">문서 생성</h1>
            <p className="mt-1.5 text-[13px] text-foreground-secondary">시작할 작업을 선택하세요.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-x-6 gap-y-4 sm:gap-x-8">
          {actions.map((action) => {
            const Icon = action.icon;
            const inner = (
              <div className="group flex w-[60px] flex-col items-center gap-2 text-center">
                <div className={`flex h-[52px] w-[52px] items-center justify-center rounded-full ${action.bg} ${action.hover} transition-all group-hover:shadow-md`}>
                  <Icon size={22} strokeWidth={1.5} className={action.color} />
                </div>
                <span className="break-keep text-[11px] font-medium leading-tight text-foreground-secondary group-hover:text-foreground">
                  {action.label}
                </span>
              </div>
            );

            if (action.href) {
              return (
                <Link key={action.label} href={action.href} className="group">
                  {inner}
                </Link>
              );
            }

            return (
              <button key={action.label} type="button" onClick={action.onClick} className="group">
                {inner}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
