'use client';

import { Suspense, useState } from 'react';
import { EmptyState } from '@/components/ui';
import { ShareLinkModal } from '@/components/documents/ShareLinkModal';
import { buildDocumentCreateHref } from '@/lib/documents/navigation';
import {
  BulkActionsBar,
  FilesFilterBar,
  FilesHeaderActions,
  FilesListView,
  FilesPagination,
} from '@/components/files/files-sections';
import {
  FileDetailModal,
  FilesPageDialogs,
  FilesUploadModal,
  ScrapeModal,
} from '@/components/files/file-modals';
import { useFilesPage } from '@/components/files/use-files-page';

export default function FilesPageWrapper() {
  return (
    <Suspense fallback={<FilesPageSkeleton />}>
      <FilesPage />
    </Suspense>
  );
}

function FilesPage() {
  const {
    router,
    fileInputRef,
    loading,
    search,
    resourceFilter,
    showUpload,
    uploadProgress,
    selectedIds,
    dragOver,
    selectedFiles,
    detailFile,
    deleteConfirm,
    bulkConfirmOpen,
    downloadToast,
    uploadScope,
    showScrape,
    autofillFile,
    showAutofill,
    scrapeUrl,
    scrapeLoading,
    scrapeResult,
    filtered,
    safePage,
    totalPages,
    paged,
    reprocessableSelectedCount,
    setSearch,
    setResourceFilter,
    setPage,
    setShowUpload,
    setSelectedIds,
    setDragOver,
    setSelectedFiles,
    setDetailFile,
    setDeleteConfirm,
    setBulkConfirmOpen,
    setUploadScope,
    setShowScrape,
    setShowAutofill,
    setScrapeUrl,
    setScrapeResult,
    toggleSelect,
    toggleAll,
    handleFileInputChange,
    handleDrop,
    handleUpload,
    confirmDelete,
    doBulkDelete,
    bulkChangeScope,
    handleAutofill,
    handleReprocess,
    handleBulkReprocess,
    handleReprocessAllErrors,
    handleReprocessAllUnprocessed,
    handleReprocessIndexedNoChunks,
    bulkProgress,
    handleDownload,
    handleBulkDownload,
    handleScrape,
    closeUploadModal,
    handleOpenFile,
    handleDetailScopeToggle,
  } = useFilesPage();
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string; type: 'document' | 'file' } | null>(null);

  const openCommentsFromFile = (file: { id: string; name: string; sourceType?: 'document' | 'file'; linkedDocumentId?: string | null }) => {
    if (file.sourceType === 'document') {
      router.push(`/documents/${file.id}#document-comment-panel`);
      return;
    }

    if (file.linkedDocumentId) {
      router.push(`/documents/${file.linkedDocumentId}#document-comment-panel`);
      return;
    }

    router.push(buildDocumentCreateHref({
      fileIds: [file.id],
      instructions: `"${file.name}" 파일을 검토용 문서로 정리하고 코멘트를 받을 수 있게 초안을 작성하세요.`,
    }));
  };

  if (loading) return <FilesPageSkeleton />;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <FilesHeaderActions />

      <FilesFilterBar
        search={search}
        resourceFilter={resourceFilter}
        onOpenUpload={() => setShowUpload(true)}
        onReprocessErrors={() => { void handleReprocessAllErrors(); }}
        onReprocessIndexedNoChunks={() => { void handleReprocessIndexedNoChunks(); }}
        onOpenScrape={() => { setShowScrape(true); setScrapeUrl(''); setScrapeResult(null); }}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        onResourceFilterChange={(value) => { setResourceFilter(value); setPage(1); }}
        mode="actions-only"
      />

      <div className="flex items-center justify-between gap-3 py-[12px]">
        <p className="text-sm text-foreground-secondary">
          총 <span className="font-num font-medium text-foreground">{filtered.length}</span>개 파일
        </p>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { void handleReprocessAllErrors(); }}
            className="inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-full border border-warning/30 bg-warning/5 px-3 text-[10px] font-medium text-warning transition-colors hover:bg-warning/5 sm:min-h-[34px] sm:px-3.5 sm:text-[11px]"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            오류파일재처리
          </button>
          <button
            onClick={() => { void handleReprocessAllUnprocessed(); }}
            className="inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10 sm:min-h-[34px] sm:px-3.5 sm:text-[11px]"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            미처리파일재처리
          </button>
          <button
            onClick={() => { setShowScrape(true); setScrapeUrl(''); setScrapeResult(null); }}
            className="inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-full border border-border bg-white px-3 text-[10px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary sm:min-h-[34px] sm:px-3.5 sm:text-[11px]"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.07a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364l1.757 1.757" />
            </svg>
            상품링크
          </button>
        </div>
      </div>

      <BulkActionsBar
        selectedCount={selectedIds.size}
        reprocessableSelectedCount={reprocessableSelectedCount}
        onCompanyScope={() => { void bulkChangeScope('company'); }}
        onDepartmentScope={() => { void bulkChangeScope('department'); }}
        onBulkReprocess={() => { void handleBulkReprocess(); }}
        onBulkDownload={() => { void handleBulkDownload(); }}
        onBulkDelete={() => setBulkConfirmOpen(true)}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {filtered.length === 0 ? (
        <EmptyState title="검색 결과가 없습니다." description="필터를 조정하거나 새 파일을 업로드해보세요." />
      ) : (
        <FilesListView
          paged={paged}
          selectedIds={selectedIds}
          onToggleAll={toggleAll}
          onToggleSelect={toggleSelect}
          onOpenFile={handleOpenFile}
          onOpenCommentsFromFile={openCommentsFromFile}
          onOpenSearchFromFile={(file) => router.push(`/search?q=${encodeURIComponent(file.name)}`)}
          onOpenDocumentsFromFile={(file) => router.push(buildDocumentCreateHref({
            fileIds: [file.id],
            instructions: `"${file.name}" 파일을 참고 자료로 사용해 후속 문서를 작성하세요.`,
          }))}
          onOpenContractRiskFromFile={(file) => router.push(`/contract-risk?source=${encodeURIComponent(file.name)}`)}
          onOpenShare={(file) => setShareTarget({ id: file.id, title: file.name, type: file.sourceType === 'document' ? 'document' : 'file' })}
          onDownload={handleDownload}
          onReprocess={handleReprocess}
          onDelete={(file) => setDeleteConfirm(file)}
        />
      )}

      <FilesPagination safePage={safePage} totalPages={totalPages} onPageChange={setPage} />

      <FilesFilterBar
        search={search}
        resourceFilter={resourceFilter}
        onOpenUpload={() => setShowUpload(true)}
        onReprocessErrors={() => { void handleReprocessAllErrors(); }}
        onReprocessIndexedNoChunks={() => { void handleReprocessIndexedNoChunks(); }}
        onOpenScrape={() => { setShowScrape(true); setScrapeUrl(''); setScrapeResult(null); }}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        onResourceFilterChange={(value) => { setResourceFilter(value); setPage(1); }}
        mode="search-only"
      />

      <FilesUploadModal
        open={showUpload}
        fileInputRef={fileInputRef}
        dragOver={dragOver}
        selectedFiles={selectedFiles}
        uploadProgress={uploadProgress}
        uploadScope={uploadScope}
        onClose={closeUploadModal}
        onFileInputChange={handleFileInputChange}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onFilePicker={() => fileInputRef.current?.click()}
        onUploadScopeChange={setUploadScope}
        onRemoveSelectedFile={(index) => setSelectedFiles((prev) => prev.filter((_, i) => i !== index))}
        onClearSelectedFiles={() => {
          setSelectedFiles([]);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
        onUpload={() => { void handleUpload(); }}
      />

      <FileDetailModal
        file={detailFile}
        onClose={() => setDetailFile(null)}
        onDownload={handleDownload}
        onAutofill={(file) => { void handleAutofill(file); }}
        onScopeToggle={handleDetailScopeToggle}
      />

      <ScrapeModal
        open={showScrape}
        scrapeUrl={scrapeUrl}
        scrapeLoading={scrapeLoading}
        scrapeResult={scrapeResult}
        onClose={() => setShowScrape(false)}
        onUrlChange={setScrapeUrl}
        onScrape={() => { void handleScrape(); }}
      />

      <FilesPageDialogs
        deleteConfirm={deleteConfirm}
        bulkConfirmOpen={bulkConfirmOpen}
        showAutofill={showAutofill}
        autofillFile={autofillFile}
        downloadToast={downloadToast}
        onCloseDeleteConfirm={() => setDeleteConfirm(null)}
        onConfirmDelete={() => { void confirmDelete(); }}
        onBulkConfirm={() => { void doBulkDelete(); }}
        onBulkCancel={() => setBulkConfirmOpen(false)}
        onCloseAutofill={() => setShowAutofill(false)}
      />

      {shareTarget && (
        <ShareLinkModal
          resourceId={shareTarget.id}
          resourceTitle={shareTarget.title}
          resourceType={shareTarget.type}
          onClose={() => setShareTarget(null)}
        />
      )}

      {bulkProgress && (
        <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl border border-border bg-white shadow-xl">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              {bulkProgress.done + bulkProgress.failed < bulkProgress.total ? (
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              ) : (
                <span className="inline-block h-2 w-2 rounded-full bg-success" />
              )}
              <p className="text-sm font-medium text-foreground">파일 재처리 진행 중</p>
            </div>
            <span className="font-num text-xs text-foreground-secondary">
              {bulkProgress.done + bulkProgress.failed}/{bulkProgress.total}
            </span>
          </div>
          <div className="px-4 pb-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${Math.round(((bulkProgress.done + bulkProgress.failed) / bulkProgress.total) * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex gap-4 px-4 pb-4 pt-2 text-[11px]">
            <span className="text-success">완료 {bulkProgress.done}</span>
            {bulkProgress.failed > 0 && <span className="text-error">오류 {bulkProgress.failed}</span>}
            <span className="text-foreground-secondary">대기 {bulkProgress.total - bulkProgress.done - bulkProgress.failed}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FilesPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-border rounded-lg" />
      <div className="h-12 bg-white rounded-2xl border border-border" />
      <div className="h-96 bg-white rounded-2xl border border-border" />
    </div>
  );
}
