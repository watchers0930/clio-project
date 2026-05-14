'use client';

interface DocumentOpsSummaryProps {
  documentTitle: string;
  isDraft: boolean;
  isMeetingDoc?: boolean;
  versionLabel?: string | null;
  commentMode?: 'panel' | 'open';
  onOpenComments: () => void;
  onOpenShare: () => void;
  onOpenVersions: () => void;
  onReuse: () => void;
  onExtractTodos?: () => void;
  onSearchRelated?: () => void;
  onOpenMemo?: () => void;
}

interface SummaryCard {
  label: string;
  value: string;
  accentClass: string;
}

export function DocumentOpsSummary({
  documentTitle,
  isDraft,
  isMeetingDoc = false,
  versionLabel,
  commentMode = 'open',
  onOpenComments,
  onOpenShare,
  onOpenVersions,
  onReuse,
  onExtractTodos,
  onSearchRelated,
  onOpenMemo,
}: DocumentOpsSummaryProps) {
  const cards: SummaryCard[] = [
    {
      label: '공유',
      value: isDraft ? '검토 공유 준비' : '공유 가능',
      accentClass: 'bg-[#F3F8FF] border-[#D7E7FF]',
    },
    {
      label: '코멘트',
      value: isDraft ? '반영 대기' : '수정 관리',
      accentClass: 'bg-[#F6F3FF] border-[#E6DBFF]',
    },
    {
      label: '버전',
      value: versionLabel ?? '이력 확인',
      accentClass: 'bg-[#F4FBF6] border-[#D7EFDE]',
    },
    {
      label: '재활용',
      value: isMeetingDoc ? '할일/후속 문서' : '후속 문서 연결',
      accentClass: 'bg-[#FFF8ED] border-[#F6E2BB]',
    },
  ];

  return (
    <section className="rounded-2xl border border-[#e5e5e7] bg-[#fbfbfc] px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-5 sm:gap-6">
        <div className="flex flex-wrap items-center justify-between gap-[20px]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8494]">Document Ops</p>
            <p className="mt-[10px] text-[14px] font-semibold text-[#1B1F2B]">
              {isMeetingDoc
                ? '먼저 검토하고, 그다음 할일과 후속 문서로 이어가세요.'
                : '먼저 검토하고 필요한 작업으로 바로 이동하세요.'}
            </p>
            <p className="mt-2 text-[12px] text-[#7C8494] break-words">{documentTitle}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={onOpenComments}
              className="rounded-lg border border-[#E6DBFF] bg-white px-3.5 py-2.5 text-[12px] font-medium text-[#7B61FF] hover:bg-[#F6F3FF] transition-colors"
            >
              {isMeetingDoc ? '1. 댓글/반영 확인' : commentMode === 'panel' ? '댓글 패널 보기' : '댓글 열기'}
            </button>
            {onExtractTodos && (
              <button
                onClick={onExtractTodos}
                className="rounded-lg border border-[#D7E7FF] bg-[#F3F8FF] px-3.5 py-2.5 text-[12px] font-medium text-[#2E6FF2] hover:bg-[#EAF3FF] transition-colors"
              >
                2. 할일 추출
              </button>
            )}
            <button
              onClick={onReuse}
              className="rounded-lg border border-[#F6E2BB] bg-white px-3.5 py-2.5 text-[12px] font-medium text-[#B06D00] hover:bg-[#FFF8ED] transition-colors"
            >
              {isMeetingDoc ? '3. 후속 문서 작성' : '후속 문서 작성'}
            </button>
            <button
              onClick={onOpenShare}
              className="rounded-lg border border-[#D7E7FF] bg-white px-3.5 py-2.5 text-[12px] font-medium text-[#2E6FF2] hover:bg-[#F3F8FF] transition-colors"
            >
              공유 열기
            </button>
            <button
              onClick={onOpenVersions}
              className="rounded-lg border border-[#D7EFDE] bg-white px-3.5 py-2.5 text-[12px] font-medium text-[#258A4E] hover:bg-[#F4FBF6] transition-colors"
            >
              버전 보기
            </button>
            {onOpenMemo && (
              <button
                onClick={onOpenMemo}
                className="rounded-lg border border-[#E2E5EA] bg-white px-3.5 py-2.5 text-[12px] font-medium text-[#4B5563] hover:bg-[#f5f5f7] transition-colors"
              >
                메모 연결
              </button>
            )}
            {onSearchRelated && (
              <button
                onClick={onSearchRelated}
                className="rounded-lg border border-[#e5e5e7] bg-white px-3.5 py-2.5 text-[12px] font-medium text-[#4B5563] hover:bg-[#f5f5f7] transition-colors"
              >
                관련 문서 찾기
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3.5 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className={`rounded-xl border px-4 py-3.5 sm:px-4.5 sm:py-4 ${card.accentClass}`}>
              <p className="text-[11px] font-semibold text-[#7C8494]">{card.label}</p>
              <p className="mt-3 text-[15px] font-semibold text-[#1B1F2B]">{card.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
