'use client';

import { FILE_STATUS_COLOR, FILE_TYPE_BADGE } from '@/lib/constants/ui';
import type { FileItem } from './types';

interface HeaderActionsProps {
  layoutConfig?: unknown;
}

interface BulkActionsBarProps {
  selectedCount: number;
  reprocessableSelectedCount: number;
  onCompanyScope: () => void;
  onDepartmentScope: () => void;
  onBulkReprocess: () => void;
  onBulkDownload: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

interface FilterBarProps {
  search: string;
  resourceFilter: '전체' | 'file' | 'document' | 'linked';
  onOpenUpload: () => void;
  onReprocessErrors: () => void;
  onOpenScrape: () => void;
  onSearchChange: (value: string) => void;
  onResourceFilterChange: (value: '전체' | 'file' | 'document' | 'linked') => void;
  mode?: 'full' | 'actions-only' | 'search-only';
}

interface FilesContentProps {
  paged: FileItem[];
  selectedIds: Set<string>;
  onToggleAll: () => void;
  onToggleSelect: (id: string) => void;
  onOpenFile: (file: FileItem) => void;
  onOpenCommentsFromFile: (file: FileItem) => void;
  onOpenSearchFromFile: (file: FileItem) => void;
  onOpenDocumentsFromFile: (file: FileItem) => void;
  onOpenContractRiskFromFile: (file: FileItem) => void;
  onOpenShare: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onReprocess: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
}

interface PaginationProps {
  safePage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function FilesHeaderActions(_props: HeaderActionsProps) {
  return (
    <section className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[20px] font-bold text-foreground">문서허브</h1>
            <p className="mt-1.5 text-[13px] text-foreground-secondary">
              업로드된 문서와 생성 문서를 관리하고 검색, 생성, 검토 흐름으로 이어갑니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BulkActionsBar({
  selectedCount,
  reprocessableSelectedCount,
  onCompanyScope,
  onDepartmentScope,
  onBulkReprocess,
  onBulkDownload,
  onBulkDelete,
  onClearSelection,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-surface-secondary px-4 py-4 sm:px-6 sm:py-5">
      <span className="text-sm font-medium text-foreground">
        <span className="font-num">{selectedCount}</span>개 선택됨
      </span>
      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <button onClick={onCompanyScope} className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-tint">
          전사로 변경
        </button>
        <button onClick={onDepartmentScope} className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary">
          부서로 변경
        </button>
        <button
          onClick={onBulkDownload}
          className="rounded-lg border border-primary bg-white px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-tint"
        >
          선택 다운로드
        </button>
        <button
          onClick={onBulkReprocess}
          disabled={reprocessableSelectedCount === 0}
          className="rounded-lg border border-warning bg-white px-4 py-2 text-sm font-medium text-warning transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          선택 재처리
        </button>
        <button onClick={onBulkDelete} className="rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary sm:ml-auto">
          선택 삭제
        </button>
        <button onClick={onClearSelection} className="rounded-lg border border-border bg-white px-5 py-2 text-sm text-foreground-secondary transition-colors hover:bg-surface-secondary">
          선택 해제
        </button>
      </div>
    </div>
  );
}

export function FilesFilterBar({
  search,
  resourceFilter,
  onOpenUpload,
  onReprocessErrors,
  onOpenScrape,
  onSearchChange,
  onResourceFilterChange,
  mode = 'full',
}: FilterBarProps) {
  const resourceOptions = [
    { value: '전체', label: '자산' },
    { value: 'file', label: '원본 파일' },
    { value: 'document', label: '생성 문서' },
    { value: 'linked', label: '연결 문서 있음' },
  ] as const;

  return (
    <>
      <div className="flex flex-col gap-4 sm:gap-5 lg:gap-6">
        {mode !== 'search-only' && (
          <>
            <button
              onClick={onOpenUpload}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              문서 업로드
            </button>
            {mode === 'full' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onReprocessErrors}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-warning/30 bg-warning/5 px-3 py-2.5 text-[11px] font-medium text-warning transition-colors hover:bg-warning/5 sm:px-3.5 sm:text-[12px]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  오류 파일 재처리
                </button>
                <button
                  onClick={onOpenScrape}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-border bg-white px-3 py-2.5 text-[11px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary sm:px-3.5 sm:text-[12px]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.07a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364l1.757 1.757" />
                  </svg>
                  URL 상품 링크 수집
                </button>
              </div>
            )}
          </>
        )}
        {mode !== 'actions-only' && (
          <div className="grid grid-cols-[minmax(0,116px)_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)]">
            <select value={resourceFilter} onChange={(e) => onResourceFilterChange(e.target.value as '전체' | 'file' | 'document' | 'linked')} className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {resourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <div className="relative min-w-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="파일 검색..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function FilesListView({
  paged,
  selectedIds,
  onToggleAll,
  onToggleSelect,
  onOpenFile,
  onOpenCommentsFromFile,
  onOpenSearchFromFile,
  onOpenDocumentsFromFile,
  // onOpenContractRiskFromFile — reserved for future use
}: FilesContentProps) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-white shadow-sm">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-secondary text-left text-foreground-secondary">
              <th className="w-10 px-6 py-5.5">
                <input type="checkbox" checked={selectedIds.size === paged.length && paged.length > 0} onChange={onToggleAll} className="rounded border-border text-primary focus:ring-primary" />
              </th>
              <th className="px-6 py-5.5 font-medium">파일명</th>
              <th className="hidden px-6 py-5.5 font-medium sm:table-cell">부서</th>
              <th className="hidden px-6 py-5.5 font-medium md:table-cell">크기</th>
              <th className="hidden px-6 py-5.5 font-medium md:table-cell">업로드일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paged.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-14 text-center text-foreground-secondary">검색 결과가 없습니다.</td>
              </tr>
            )}
            {paged.map((file) => (
              <tr key={file.id} className="hover:bg-surface-secondary transition-colors">
                <td className="px-6 py-6">
                  <input type="checkbox" checked={selectedIds.has(file.id)} onChange={() => onToggleSelect(file.id)} className="rounded border-border text-primary focus:ring-primary" />
                </td>
                <td className="px-6 py-6">
                  <button onClick={() => onOpenFile(file)} className="flex items-center gap-2.5 text-left group">
                    <FileIcon type={file.type} />
                    <span className="font-medium text-foreground truncate max-w-[630px] group-hover:text-primary transition-colors">{file.name}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${file.sourceType === 'document' ? 'bg-purple-100 text-purple-700' : (FILE_TYPE_BADGE[file.type] ?? 'bg-gray-100 text-gray-600')}`}>{file.sourceType === 'document' ? 'AI문서' : file.type}</span>
                  </button>
                </td>
                <td className="hidden px-6 py-6 leading-6 text-foreground-secondary sm:table-cell">{file.department}</td>
                <td className="hidden px-6 py-6 leading-6 text-foreground-secondary md:table-cell">{file.size}</td>
                <td className="hidden px-6 py-6 leading-6 text-foreground-secondary md:table-cell">{file.uploadDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-border md:hidden">
        {paged.length === 0 && (
          <div className="px-5 py-14 text-center text-foreground-secondary">검색 결과가 없습니다.</div>
        )}
        {paged.map((file) => (
          <div key={file.id} className="px-4 py-5">
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selectedIds.has(file.id)} onChange={() => onToggleSelect(file.id)} className="mt-1 rounded border-border text-primary focus:ring-primary" />
              <div className="min-w-0 flex-1">
                <button onClick={() => onOpenFile(file)} className="flex w-full items-start gap-2 text-left">
                  <FileIcon type={file.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 pb-[7px]">
                      <span className="truncate text-[14px] font-medium text-foreground">{file.name}</span>
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${file.sourceType === 'document' ? 'bg-purple-100 text-purple-700' : (FILE_TYPE_BADGE[file.type] ?? 'bg-gray-100 text-gray-600')}`}>{file.sourceType === 'document' ? 'AI문서' : file.type}</span>
                    </div>
                    <div className="mt-[30px] flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] leading-5 text-foreground-secondary">
                      <span>{file.department}</span>
                      <span>·</span>
                      <span>{file.uploadDate}</span>
                      <span>·</span>
                      <span>{file.size}</span>
                      <div className="ml-[18px] flex items-center gap-[10px]">
                        <ScopeBadge scope={file.scope} compact />
                        <span className={`inline-flex min-h-[20px] items-center rounded-full px-2 py-0 text-[10px] font-medium leading-none ${FILE_STATUS_COLOR[file.status]}`}>{file.status}</span>
                      </div>
                    </div>
                  </div>
                </button>
                <div className="sr-only">
                  <ScopeBadge scope={file.scope} />
                  <span className={`inline-flex min-h-[24px] items-center rounded-full px-2.5 py-0 text-xs font-medium leading-none ${FILE_STATUS_COLOR[file.status]}`}>{file.status}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => onOpenSearchFromFile(file)} className="rounded-lg border border-border-tint px-3 py-2 text-[11px] font-medium text-primary hover:bg-primary-tint transition-colors">
                    관련 문서 검색
                  </button>
                  <button onClick={() => onOpenDocumentsFromFile(file)} className="rounded-lg border border-success/30 px-3 py-2 text-[11px] font-medium text-success hover:bg-success/5 transition-colors">
                    후속 문서 작성
                  </button>
                  <button onClick={() => onOpenCommentsFromFile(file)} className="rounded-lg border border-purple-200 px-3 py-2 text-[11px] font-medium text-purple-600 hover:bg-purple-50 transition-colors">
                    검토 문서 열기
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FilesPagination({ safePage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const maxVisiblePages = 5;
  const windowStart = Math.max(1, Math.min(safePage - Math.floor(maxVisiblePages / 2), totalPages - maxVisiblePages + 1));
  const windowEnd = Math.min(totalPages, windowStart + maxVisiblePages - 1);
  const visiblePages = Array.from({ length: windowEnd - windowStart + 1 }, (_, index) => windowStart + index);

  return (
    <div className="mt-5 flex items-center justify-center gap-2">
      <button disabled={safePage <= 1} onClick={() => onPageChange(1)} className="px-3 py-1.5 rounded-lg border border-border text-sm text-foreground-secondary hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">처음</button>
      <button disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} className="px-3 py-1.5 rounded-lg border border-border text-sm text-foreground-secondary hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">이전</button>
      {visiblePages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`w-8 h-8 rounded-lg text-sm font-medium font-num transition-colors ${safePage === page ? 'bg-foreground text-white' : 'text-foreground-secondary hover:bg-surface-secondary'}`}
        >
          {page}
        </button>
      ))}
      <button disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} className="px-3 py-1.5 rounded-lg border border-border text-sm text-foreground-secondary hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">다음</button>
      <button disabled={safePage >= totalPages} onClick={() => onPageChange(totalPages)} className="px-3 py-1.5 rounded-lg border border-border text-sm text-foreground-secondary hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">맨끝</button>
    </div>
  );
}

function ScopeBadge({ scope, compact = false }: { scope: 'company' | 'department'; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full font-medium leading-none ${compact ? 'min-h-[20px] px-2 py-0 text-[10px]' : 'min-h-[24px] px-2.5 py-0 text-xs'} ${scope === 'company' ? 'bg-primary-tint text-primary' : 'bg-surface-secondary text-foreground-secondary'}`}>
      {scope === 'company' ? '전사' : '부서'}
    </span>
  );
}

function FileIcon({ type }: { type: string }) {
  return (
    <svg className={`w-5 h-5 shrink-0 ${FILE_TYPE_BADGE[type] ?? 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
