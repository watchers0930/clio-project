'use client';

import { AutofillModal } from '@/components/common/AutofillModal';
import { ConfirmDialog, Spinner } from '@/components/ui';
import { FILE_TYPE_BADGE } from '@/lib/constants/ui';
import { formatSize, getFileType } from '@/lib/utils/format';
import { CloseIcon, CloseSmallIcon, FileGlyph, SuccessIcon, WarningIcon } from './file-modal-icons';
import type { FileItem, ScrapeResult } from './types';

interface UploadProgress {
  current: number;
  total: number;
  percent: number;
}

export function FilesUploadModal({
  open,
  fileInputRef,
  dragOver,
  selectedFiles,
  uploadProgress,
  uploadScope,
  onClose,
  onFileInputChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onFilePicker,
  onUploadScopeChange,
  onRemoveSelectedFile,
  onClearSelectedFiles,
  onUpload,
}: {
  open: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  dragOver: boolean;
  selectedFiles: File[];
  uploadProgress: UploadProgress | null;
  uploadScope: 'company' | 'department';
  onClose: () => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFilePicker: () => void;
  onUploadScopeChange: (scope: 'company' | 'department') => void;
  onRemoveSelectedFile: (index: number) => void;
  onClearSelectedFiles: () => void;
  onUpload: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-t-[28px] shadow-xl w-full max-w-lg sm:mx-4 sm:rounded-xl">
        <div className="px-5 py-5 border-b border-border flex items-center justify-between sm:px-8 sm:py-6">
          <h2 className="text-lg font-semibold text-foreground">파일 업로드</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-secondary text-foreground-secondary">
            <CloseIcon />
          </button>
        </div>

        <div className="px-5 py-6 flex flex-col gap-6 sm:px-8 sm:py-7">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.dotx,.pptx,.xlsx,.hwp,.hwpx,.md,.txt,.csv"
            multiple
            className="hidden"
            onChange={onFileInputChange}
          />

          <div>
            <label className="block text-sm font-medium text-foreground" style={{ marginBottom: '5px' }}>공개 범위</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-3.5" style={{ marginBottom: '12px' }}>
              <UploadScopeButton active={uploadScope === 'department'} onClick={() => onUploadScopeChange('department')} label="부서 공유" />
              <UploadScopeButton active={uploadScope === 'company'} company onClick={() => onUploadScopeChange('company')} label="전사 공개" />
            </div>
            <p className="text-xs text-foreground-secondary" style={{ padding: '12px 0' }}>
              {uploadScope === 'company' ? '모든 임직원이 이 파일을 볼 수 있습니다.' : '같은 부서 구성원만 이 파일을 볼 수 있습니다.'}
            </p>
          </div>

          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{ marginTop: '24px' }}
            className={`border-2 border-dashed rounded-2xl py-10 px-7 flex flex-col items-center text-center transition-colors ${dragOver ? 'border-primary bg-primary-tint' : 'border-border bg-surface-secondary'}`}
          >
            <svg className="w-10 h-10 text-foreground-secondary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
            <p className="text-sm font-medium text-foreground mb-1">파일을 여기에 끌어다 놓으세요</p>
            <p className="text-xs text-foreground-secondary mb-4">또는</p>
            <button onClick={onFilePicker} style={{ margin: '12px 0' }} className="px-5 py-3 rounded-xl bg-foreground text-white text-[13px] font-medium hover:bg-primary transition-colors">
              파일 선택
            </button>
            <p className="text-xs text-foreground-secondary mt-4">PDF, DOCX, PPTX, XLSX, HWP, MD (최대 50MB)</p>
          </div>

          {selectedFiles.length > 0 && uploadProgress === null && (
            <div className="p-5 bg-surface-secondary rounded-xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-foreground">
                  {selectedFiles.length}개 파일 · {formatSize(selectedFiles.reduce((s, f) => s + f.size, 0))}
                </p>
                <button onClick={onClearSelectedFiles} className="text-xs text-foreground-secondary hover:text-foreground">전체 삭제</button>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {selectedFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-border">
                    <div className={`w-8 h-8 rounded-lg bg-surface-secondary flex items-center justify-center shrink-0 ${FILE_TYPE_BADGE[getFileType(file.name)] ?? 'text-gray-400'}`}>
                      <FileGlyph />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-foreground-secondary">{formatSize(file.size)}</p>
                    </div>
                    <button onClick={() => onRemoveSelectedFile(idx)} className="p-1.5 rounded-lg hover:bg-surface-secondary text-foreground-secondary shrink-0">
                      <CloseSmallIcon />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={onUpload} className="mt-4 w-full py-3 rounded-xl bg-foreground text-white text-[13px] font-medium hover:bg-primary transition-colors">
                {selectedFiles.length}개 파일 업로드
              </button>
            </div>
          )}

          {uploadProgress !== null && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">{uploadProgress.percent >= 100 ? '업로드 완료!' : `업로드 중... (${uploadProgress.current}/${uploadProgress.total})`}</span>
                <span className="text-primary font-medium font-num">{uploadProgress.percent}%</span>
              </div>
              <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${uploadProgress.percent >= 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${uploadProgress.percent}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScrapeModal({
  open,
  scrapeUrl,
  scrapeLoading,
  scrapeResult,
  onClose,
  onUrlChange,
  onScrape,
}: {
  open: boolean;
  scrapeUrl: string;
  scrapeLoading: boolean;
  scrapeResult: ScrapeResult | null;
  onClose: () => void;
  onUrlChange: (value: string) => void;
  onScrape: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && !scrapeLoading) onClose(); }}>
      <div className="bg-white rounded-t-[28px] shadow-xl w-full max-w-lg sm:mx-4 sm:rounded-xl">
        <div className="px-5 py-5 border-b border-border flex items-center justify-between sm:px-6 sm:py-6">
          <h2 className="text-[15px] font-semibold text-foreground">URL 상품 링크 수집</h2>
          {!scrapeLoading && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-secondary">
              <CloseIcon />
            </button>
          )}
        </div>

        <div className="px-5 py-5 flex flex-col gap-5 sm:px-6 sm:py-6 sm:gap-6">
          <p className="text-sm text-foreground-secondary">쇼핑몰 카테고리 페이지 URL을 입력하면 상품 링크를 자동으로 수집합니다.</p>

          <input
            type="url"
            value={scrapeUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com/category/..."
            disabled={scrapeLoading}
            className="w-full px-4 py-3 rounded-xl border border-border text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && scrapeUrl.trim() && !scrapeLoading) onScrape();
            }}
          />

          {scrapeLoading && (
            <div className="flex items-center gap-3 mt-4 p-4 rounded-xl bg-surface-secondary">
              <Spinner size="sm" />
              <span className="text-sm text-foreground-secondary">상품 링크를 수집하고 있습니다...</span>
            </div>
          )}

          {scrapeResult && !scrapeLoading && (
            <div className={`flex items-start gap-3 mt-4 p-4 rounded-xl ${scrapeResult.success ? 'bg-success/5' : 'bg-danger/5'}`}>
              {scrapeResult.success ? <SuccessIcon /> : <WarningIcon />}
              <span className="text-sm text-foreground">{scrapeResult.message}</span>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <button onClick={onClose} disabled={scrapeLoading} className="flex-1 py-2 rounded-xl border border-border text-[13px] font-medium text-foreground-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50">
              {scrapeResult?.success && scrapeResult.linkCount ? '닫기' : '취소'}
            </button>
            {!(scrapeResult?.success && scrapeResult.linkCount) && (
              <button onClick={onScrape} disabled={!scrapeUrl.trim() || scrapeLoading} className="flex-1 py-2 rounded-xl bg-foreground text-white text-[13px] font-medium hover:bg-primary transition-colors disabled:opacity-50">
                수집 시작
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FilesPageDialogs({
  deleteConfirm,
  bulkConfirmOpen,
  showAutofill,
  autofillFile,
  downloadToast,
  onCloseDeleteConfirm,
  onConfirmDelete,
  onBulkConfirm,
  onBulkCancel,
  onCloseAutofill,
}: {
  deleteConfirm: FileItem | null;
  bulkConfirmOpen: boolean;
  showAutofill: boolean;
  autofillFile: File | null;
  downloadToast: string | null;
  onCloseDeleteConfirm: () => void;
  onConfirmDelete: () => void;
  onBulkConfirm: () => void;
  onBulkCancel: () => void;
  onCloseAutofill: () => void;
}) {
  return (
    <>
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onCloseDeleteConfirm(); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 px-5 py-5 text-center sm:px-6 sm:py-6">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <WarningIcon />
            </div>
            <h3 className="text-[15px] font-semibold text-foreground mb-1.5">파일 삭제</h3>
            <p className="text-sm text-foreground-secondary mb-5">
              &quot;{deleteConfirm.name}&quot;을(를) 삭제하시겠습니까?<br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button onClick={onCloseDeleteConfirm} className="flex-1 py-2 rounded-xl border border-border text-[13px] font-medium text-foreground-secondary hover:bg-surface-secondary transition-colors">
                취소
              </button>
              <button onClick={onConfirmDelete} className="flex-1 py-2 rounded-xl bg-foreground text-white text-[13px] font-medium hover:bg-primary transition-colors">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={bulkConfirmOpen}
        title="선택한 파일을 삭제하시겠습니까?"
        description="삭제된 파일은 복구할 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        onConfirm={onBulkConfirm}
        onCancel={onBulkCancel}
      />

      <AutofillModal open={showAutofill} onClose={onCloseAutofill} initialFile={autofillFile} />

      {downloadToast && (
        <div className="fixed bottom-20 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-foreground text-white rounded-xl shadow-lg animate-[slideUp_0.3s_ease-out] sm:left-auto sm:right-6 sm:bottom-6 sm:px-5">
          <SuccessIcon />
          <span className="text-sm">&quot;{downloadToast}&quot; 다운로드를 시작합니다.</span>
        </div>
      )}
    </>
  );
}

function UploadScopeButton({
  active,
  company = false,
  label,
  onClick,
}: {
  active: boolean;
  company?: boolean;
  label: string;
  onClick: () => void;
}) {
  const activeClass = company
    ? 'border-primary bg-primary text-white'
    : 'border-foreground bg-foreground text-white';

  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3.5 rounded-xl border text-sm font-medium transition-colors ${active ? activeClass : 'border-border text-foreground-secondary hover:bg-surface-secondary'}`}
    >
      {label}
    </button>
  );
}
