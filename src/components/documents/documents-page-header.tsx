interface DocumentsPageHeaderProps {
  onOpenStt: () => void;
  onOpenCreate: () => void;
}

const TABS = [
  { label: '새문서', desc: '템플릿 기반 문서 생성' },
  { label: '음성회의록', desc: '녹음 · 파일로 회의록 작성' },
] as const;

export function DocumentsPageHeader({
  onOpenStt,
  onOpenCreate,
}: DocumentsPageHeaderProps) {
  const handlers = [onOpenCreate, onOpenStt];

  return (
    <section className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-4 px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[20px] font-bold text-foreground">문서 생성</h1>
            <p className="mt-1.5 text-[13px] text-foreground-secondary">시작할 작업을 선택하세요.</p>
          </div>
        </div>

        <div className="flex w-fit gap-1.5 rounded-xl bg-surface-secondary p-1.5">
          {TABS.map((tab, i) => (
            <button
              key={tab.label}
              onClick={handlers[i]}
              className="flex flex-col items-start rounded-lg px-5 py-3 text-left transition-all text-foreground-secondary hover:bg-white hover:text-foreground hover:shadow-sm"
            >
              <span className="text-[13px] font-semibold">{tab.label}</span>
              <span className="mt-0.5 text-[11px] text-foreground-quaternary">{tab.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
