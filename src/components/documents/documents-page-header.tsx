interface DocumentsPageHeaderProps {
  onOpenStt: () => void;
  onOpenCreate: () => void;
}

export function DocumentsPageHeader({
  onOpenStt,
  onOpenCreate,
}: DocumentsPageHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 className="text-2xl font-bold text-[#1d1d1f]">문서 생성</h1>
        <p className="text-[#6e6e73] mt-1" style={{ marginBottom: 10 }}>
          AI를 활용하여 문서를 자동으로 생성하세요
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenStt}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#e5e5e7] bg-white text-[#1d1d1f] text-sm font-medium hover:border-[#2E6FF2] hover:text-[#2E6FF2] transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
          음성으로 회의록
        </button>
        <button
          onClick={onOpenCreate}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          새 문서 생성
        </button>
      </div>
    </div>
  );
}
