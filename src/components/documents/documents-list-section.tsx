import { EmptyState } from '@/components/ui';
import type { DocumentItem } from '@/components/documents/page-types';

interface DocumentsListSectionProps {
  docs: DocumentItem[];
  selectedDocIds: Set<string>;
  statusDot: Record<string, string>;
  onToggleSelectAll: () => void;
  onBulkDelete: () => void;
  onDeleteAll: () => void;
  onToggleDocSelect: (id: string) => void;
  onOpenDocument: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
  onOpenShare: (doc: DocumentItem) => void;
  onOpenVersionPanel: (docId: string) => void;
  onDelete: (id: string) => void;
  onOpenCreate: () => void;
}

export function DocumentsListSection({
  docs,
  selectedDocIds,
  statusDot,
  onToggleSelectAll,
  onBulkDelete,
  onDeleteAll,
  onToggleDocSelect,
  onOpenDocument,
  onDownload,
  onOpenShare,
  onOpenVersionPanel,
  onDelete,
  onOpenCreate,
}: DocumentsListSectionProps) {
  if (docs.length === 0) {
    return (
      <EmptyState
        iconType="file"
        title="생성된 문서가 없습니다"
        description="새 문서 생성 버튼을 눌러 첫 문서를 만들어 보세요"
        action={{ label: '새 문서 생성', onClick: onOpenCreate }}
      />
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-white px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[14px] font-semibold text-foreground">문서 목록</p>
            <p className="mt-1 text-[12px] text-foreground-secondary">열기, 공유, 버전 확인</p>
          </div>
          <div className="flex w-full items-center gap-2.5 flex-wrap sm:w-auto sm:justify-end">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground-secondary">
              <input
                type="checkbox"
                checked={docs.length > 0 && selectedDocIds.size === docs.length}
                onChange={onToggleSelectAll}
                className="w-4 h-4 rounded border-border accent-[#0071e3]"
              />
              전체 선택
            </label>
            {selectedDocIds.size > 0 && (
              <button onClick={onBulkDelete} className="px-4 py-2.5 rounded-xl text-sm text-danger border border-danger hover:bg-red-50 transition-colors">
                선택 삭제 ({selectedDocIds.size})
              </button>
            )}
            <button onClick={onDeleteAll} className="px-4 py-2.5 rounded-xl text-sm text-foreground-secondary border border-border hover:bg-surface-secondary transition-colors">
              전체 삭제
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" style={{ marginTop: 18 }}>
        {docs.map((doc) => {
          const dotColor = statusDot[doc.status] ?? '#7C8494';
          const isSelected = selectedDocIds.has(doc.id);

          return (
            <div
              key={doc.id}
              className="bg-white rounded-xl border overflow-hidden transition-all hover:shadow-lg group"
              style={{
                borderColor: isSelected ? '#2E6FF2' : '#E2E5EA',
                boxShadow: isSelected ? '0 0 0 1px #2E6FF2' : '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ height: 3, backgroundColor: dotColor }} />

              <div className="px-5 py-5 sm:px-6 sm:py-6" style={{ paddingBottom: 20 }}>
                <div className="flex items-center justify-between gap-3" style={{ marginBottom: 16 }}>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleDocSelect(doc.id)}
                      className="w-[15px] h-[15px] rounded border-border accent-[#2E6FF2] shrink-0 cursor-pointer"
                    />
                    <span
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-md inline-flex items-center gap-1.5"
                      style={{ backgroundColor: dotColor + '12', color: dotColor }}
                    >
                      <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: dotColor }} />
                      {doc.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-foreground-secondary font-num">{doc.createdAt}</span>
                </div>

                <h3 className="text-[14px] font-semibold text-foreground truncate" style={{ marginBottom: 14 }}>
                  {doc.title}
                </h3>

                <div className="flex flex-wrap items-center gap-3.5 text-[11px] text-foreground-secondary" style={{ marginBottom: 18 }}>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" /></svg>
                    {doc.template}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                    소스 {doc.sourceCount}개
                  </span>
                  {(doc.versionNumber ?? 1) > 1 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      v{doc.versionNumber}
                    </span>
                  )}
                </div>

                <div className="rounded-xl bg-surface-secondary border border-border/60" style={{ padding: '14px 15px' }}>
                  <p className="text-[11px] font-semibold text-foreground">
                    {doc.status === '초안' ? '다음: 검토와 반영' : '다음: 공유와 재활용'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 border-t border-border/60 sm:flex">
                <button
                  onClick={() => onOpenDocument(doc)}
                  className="min-h-[48px] flex-1 border-r border-b border-border/60 px-3 py-3 text-[12px] font-medium text-foreground transition-colors hover:bg-surface-secondary sm:border-b-0"
                >
                  {doc.status === '초안' ? '검토 열기' : '운영 열기'}
                </button>
                <button
                  onClick={() => onDownload(doc)}
                  className="min-h-[48px] flex-1 border-b border-border/60 px-3 py-3 text-[12px] font-medium text-foreground transition-colors hover:bg-surface-secondary sm:border-r sm:border-b-0 sm:border-border/60"
                >
                  다운로드
                </button>
                <button
                  onClick={() => onOpenShare(doc)}
                  className="min-h-[48px] flex-1 border-r border-border/60 px-3 py-3 text-[12px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary"
                  title="공유 링크 생성"
                >
                  공유
                </button>
                <button
                  onClick={() => onOpenVersionPanel(doc.id)}
                  className="min-h-[48px] flex-1 px-3 py-3 text-[12px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary sm:border-r sm:border-border/60"
                  title="버전 이력"
                >
                  버전
                </button>
                <button
                  onClick={() => onDelete(doc.id)}
                  className="col-span-2 min-h-[48px] flex-1 border-t border-border/60 px-3 py-3 text-[12px] font-medium text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground sm:col-span-1 sm:border-t-0"
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
