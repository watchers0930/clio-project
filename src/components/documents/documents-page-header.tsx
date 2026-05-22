import { FilePlus, Mic } from 'lucide-react';

interface DocumentsPageHeaderProps {
  onOpenStt: () => void;
  onOpenCreate: () => void;
}

const ACTION_CARDS = [
  { label: '새 문서', icon: FilePlus, bg: 'bg-blue-50', color: 'text-blue-500', hover: 'hover:bg-blue-100' },
  { label: '음성회의록', icon: Mic, bg: 'bg-violet-50', color: 'text-violet-500', hover: 'hover:bg-violet-100' },
] as const;

export function DocumentsPageHeader({
  onOpenStt,
  onOpenCreate,
}: DocumentsPageHeaderProps) {
  const actions: Array<{ label: string; icon: typeof FilePlus; bg: string; color: string; hover: string; onClick?: () => void }> = [
    { ...ACTION_CARDS[0], onClick: onOpenCreate },
    { ...ACTION_CARDS[1], onClick: onOpenStt },
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
            return (
              <button key={action.label} type="button" onClick={action.onClick} className="group">
                <div className="flex w-[60px] flex-col items-center gap-2 text-center">
                  <div className={`flex h-[52px] w-[52px] items-center justify-center rounded-full ${action.bg} ${action.hover} transition-all group-hover:shadow-md`}>
                    <Icon size={22} strokeWidth={1.5} className={action.color} />
                  </div>
                  <span className="break-keep text-[11px] font-medium leading-tight text-foreground-secondary group-hover:text-foreground">
                    {action.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
