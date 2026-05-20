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
  onOpenContractRisk?: () => void;
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
  onOpenContractRisk,
  onExtractTodos,
  onSearchRelated,
  onOpenMemo,
}: DocumentOpsSummaryProps) {
  const cards: SummaryCard[] = [
    {
      label: '공유',
      value: isDraft ? '검토 공유 준비' : '공유 가능',
      accentClass: 'bg-primary-tint border-border-tint',
    },
    {
      label: '코멘트',
      value: isDraft ? '반영 대기' : '수정 관리',
      accentClass: 'bg-purple-50 border-purple-200',
    },
    {
      label: '버전',
      value: versionLabel ?? '이력 확인',
      accentClass: 'bg-success/5 border-success/30',
    },
    {
      label: '재활용',
      value: isMeetingDoc ? '할일/후속 문서' : '후속 문서 연결',
      accentClass: 'bg-warning/5 border-warning/30',
    },
  ];

  return (
    <section className="rounded-2xl border border-border bg-surface-tertiary px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-5 sm:gap-6">
        <div className="flex flex-wrap items-center justify-between gap-[20px]">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-secondary">Document Ops</p>
            <p className="mt-[10px] text-[14px] font-semibold text-foreground">
              {isMeetingDoc
                ? '먼저 검토하고, 그다음 할일과 후속 문서로 이어가세요.'
                : '먼저 검토하고 필요한 작업으로 바로 이동하세요.'}
            </p>
            <p className="mt-2 text-[12px] text-foreground-secondary break-words">{documentTitle}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={onOpenComments}
              className="rounded-lg border border-purple-200 bg-white px-3.5 py-2.5 text-[12px] font-medium text-purple-500 hover:bg-purple-50 transition-colors"
            >
              {isMeetingDoc ? '1. 댓글/반영 확인' : commentMode === 'panel' ? '댓글 패널 보기' : '댓글 열기'}
            </button>
            {onExtractTodos && (
              <button
                onClick={onExtractTodos}
                className="rounded-lg border border-border-tint bg-primary-tint px-3.5 py-2.5 text-[12px] font-medium text-primary hover:bg-primary-tint transition-colors"
              >
                2. 할일 추출
              </button>
            )}
            <button
              onClick={onReuse}
              className="rounded-lg border border-warning/30 bg-white px-3.5 py-2.5 text-[12px] font-medium text-warning hover:bg-warning/5 transition-colors"
            >
              {isMeetingDoc ? '3. 후속 문서 작성' : '후속 문서 작성'}
            </button>
            {onOpenContractRisk && (
              <button
                onClick={onOpenContractRisk}
                className="rounded-lg border border-danger/30 bg-white px-3.5 py-2.5 text-[12px] font-medium text-danger hover:bg-danger/5 transition-colors"
              >
                계약 리스크 검토
              </button>
            )}
            <button
              onClick={onOpenShare}
              className="rounded-lg border border-border-tint bg-white px-3.5 py-2.5 text-[12px] font-medium text-primary hover:bg-primary-tint transition-colors"
            >
              공유 열기
            </button>
            <button
              onClick={onOpenVersions}
              className="rounded-lg border border-success/30 bg-white px-3.5 py-2.5 text-[12px] font-medium text-success hover:bg-success/5 transition-colors"
            >
              버전 보기
            </button>
            {onOpenMemo && (
              <button
                onClick={onOpenMemo}
                className="rounded-lg border border-border bg-white px-3.5 py-2.5 text-[12px] font-medium text-foreground-secondary hover:bg-surface-secondary transition-colors"
              >
                메모 연결
              </button>
            )}
            {onSearchRelated && (
              <button
                onClick={onSearchRelated}
                className="rounded-lg border border-border bg-white px-3.5 py-2.5 text-[12px] font-medium text-foreground-secondary hover:bg-surface-secondary transition-colors"
              >
                관련 문서 찾기
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3.5 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className={`rounded-xl border px-4 py-3.5 sm:px-4.5 sm:py-4 ${card.accentClass}`}>
              <p className="text-[11px] font-semibold text-foreground-secondary">{card.label}</p>
              <p className="mt-3 text-[15px] font-semibold text-foreground">{card.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
