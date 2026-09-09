import { useMemo, useState } from 'react';
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

const ALL_TAB = '전체';

function downloadLabel(doc: DocumentItem) {
  if (doc.outputFormat === 'pdf') return 'PDF';
  if (doc.outputFormat) return doc.outputFormat.toUpperCase();
  if (doc.template === '업무협약서(MOU)') return 'PDF';
  return '다운로드';
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
  const [activeType, setActiveType] = useState<string>(ALL_TAB);

  // 문서 종류(템플릿)별 개수 집계
  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of docs) {
      const key = d.template || '기타';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [docs]);

  const filteredDocs = useMemo(
    () => (activeType === ALL_TAB ? docs : docs.filter((d) => (d.template || '기타') === activeType)),
    [docs, activeType],
  );

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[14px] font-semibold text-foreground">문서 목록</p>
          <p className="mt-1 text-[12px] text-foreground-secondary">열기, 공유, 버전 확인</p>
        </div>
        <div className="flex items-center gap-[10px]">
          <label className="flex items-center gap-2.5 whitespace-nowrap text-[12px] text-foreground-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={docs.length > 0 && selectedDocIds.size === docs.length}
              onChange={onToggleSelectAll}
              className="m-0 h-4 w-4 shrink-0 rounded border-border accent-[#0071e3] cursor-pointer"
              style={{ width: 16, height: 16 }}
            />
            전체 선택
          </label>
          {selectedDocIds.size > 0 && (
            <button onClick={onBulkDelete} className="px-3.5 py-2 rounded-xl text-[13px] text-danger border border-danger hover:bg-red-50 transition-colors">
              선택 삭제 ({selectedDocIds.size})
            </button>
          )}
          <button onClick={onDeleteAll} className="px-3.5 py-2 rounded-xl text-[13px] text-foreground-secondary border border-border hover:bg-surface-secondary transition-colors">
            전체 삭제
          </button>
        </div>
      </div>

      {/* 종류별 탭 */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
        <TypeTab label={ALL_TAB} count={docs.length} active={activeType === ALL_TAB} onClick={() => setActiveType(ALL_TAB)} />
        {typeCounts.map(([type, count]) => (
          <TypeTab key={type} label={type} count={count} active={activeType === type} onClick={() => setActiveType(type)} />
        ))}
      </div>

      {/* 리스트 */}
      <div className="mt-3 flex flex-col gap-2">
        {filteredDocs.map((doc) => {
          const dotColor = statusDot[doc.status] ?? '#7C8494';
          const isSelected = selectedDocIds.has(doc.id);

          return (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition-all hover:shadow-md"
              style={{
                borderColor: isSelected ? '#2E6FF2' : '#E2E5EA',
                boxShadow: isSelected ? '0 0 0 1px #2E6FF2' : undefined,
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleDocSelect(doc.id)}
                className="w-[15px] h-[15px] rounded border-border accent-[#2E6FF2] shrink-0 cursor-pointer"
              />
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} title={doc.status} />

              {/* 제목 + 메타 (클릭 시 열기) */}
              <button onClick={() => onOpenDocument(doc)} className="flex-1 min-w-0 text-left">
                <p className="truncate text-[13.5px] font-semibold text-foreground">{doc.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-foreground-secondary">
                  <span style={{ color: dotColor }}>{doc.status}</span>
                  {' · '}{doc.template}
                  {' · '}{doc.createdAt}
                  {doc.sourceCount > 0 ? ` · 소스 ${doc.sourceCount}개` : ''}
                  {(doc.versionNumber ?? 1) > 1 ? ` · v${doc.versionNumber}` : ''}
                </p>
              </button>

              {/* 액션 */}
              <div className="flex items-center gap-1 shrink-0">
                <RowAction onClick={() => onOpenDocument(doc)} primary>{doc.status === '초안' ? '검토' : '열기'}</RowAction>
                <RowAction onClick={() => onDownload(doc)}>{downloadLabel(doc)}</RowAction>
                <RowAction onClick={() => onOpenShare(doc)}>공유</RowAction>
                <RowAction onClick={() => onOpenVersionPanel(doc.id)}>버전</RowAction>
                <RowAction onClick={() => onDelete(doc.id)} danger>삭제</RowAction>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function TypeTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
        active ? 'bg-[#2E6FF2] text-white' : 'bg-surface-secondary text-foreground-secondary hover:bg-border/50'
      }`}
    >
      {label}
      <span className={`ml-1.5 ${active ? 'text-white/80' : 'text-foreground-secondary/70'}`}>{count}</span>
    </button>
  );
}

function RowAction({ children, onClick, primary, danger }: { children: React.ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) {
  const base = 'rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors whitespace-nowrap';
  const style = primary
    ? 'text-[#2E6FF2] hover:bg-primary/10'
    : danger
    ? 'text-foreground/60 hover:bg-red-50 hover:text-danger'
    : 'text-foreground-secondary hover:bg-surface-secondary';
  return (
    <button onClick={onClick} className={`${base} ${style}`}>
      {children}
    </button>
  );
}
