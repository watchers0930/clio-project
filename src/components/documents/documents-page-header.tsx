import { useRouter } from 'next/navigation';

interface DocumentsPageHeaderProps {
  onOpenStt: () => void;
  onOpenCreate: () => void;
}

export function DocumentsPageHeader({
  onOpenStt,
  onOpenCreate,
}: DocumentsPageHeaderProps) {
  const router = useRouter();

  return (
    <>
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-4 px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[20px] font-bold text-foreground">문서 생성</h1>
              <p className="mt-1.5 text-[13px] text-foreground-secondary">
                템플릿 기반 문서를 생성하거나, 음성으로 회의록을 작성합니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/search')} className="h-9 rounded-xl bg-foreground px-4 text-[13px] font-medium text-white transition-colors hover:bg-primary">AI 검색</button>
              <button onClick={() => router.push('/contract-risk')} className="h-9 rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary">계약 분석</button>
              <button onClick={() => router.push('/files')} className="h-9 rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary">문서허브</button>
            </div>
          </div>
        </div>
      </section>

      <div className="flex w-fit gap-1.5 rounded-xl bg-surface-secondary p-1.5">
        <button
          onClick={onOpenCreate}
          className="flex flex-col items-start rounded-lg px-5 py-3 text-left transition-all bg-white text-foreground shadow-sm"
        >
          <span className="text-[13px] font-semibold text-primary">새문서</span>
          <span className="mt-0.5 text-[11px] text-foreground-quaternary">템플릿 기반 문서 생성</span>
        </button>
        <button
          onClick={onOpenStt}
          className="flex flex-col items-start rounded-lg px-5 py-3 text-left transition-all text-foreground-secondary hover:bg-white hover:text-foreground hover:shadow-sm"
        >
          <span className="text-[13px] font-semibold">음성회의록</span>
          <span className="mt-0.5 text-[11px] text-foreground-quaternary">녹음 · 파일로 회의록 작성</span>
        </button>
      </div>
    </>
  );
}
