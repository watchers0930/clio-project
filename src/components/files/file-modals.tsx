'use client';

import { useRouter } from 'next/navigation';
import { buildDocumentCreateHref } from '@/lib/documents/navigation';
import { AutofillModal } from '@/components/common/AutofillModal';
import { DocumentActionStack } from '@/components/documents/document-action-row';
import { ConfirmDialog, Spinner } from '@/components/ui';
import { FILE_STATUS_COLOR, FILE_TYPE_BADGE } from '@/lib/constants/ui';
import { formatSize, getFileType } from '@/lib/utils/format';
import { isContractTemplate } from '@/lib/contract-fields';
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
      <div className="bg-white rounded-t-[28px] shadow-xl w-full max-w-lg sm:mx-4 sm:rounded-[24px]">
        <div className="px-5 py-5 border-b border-[#e5e5e7] flex items-center justify-between sm:px-8 sm:py-6">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">파일 업로드</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
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
            <label className="block text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: '5px' }}>공개 범위</label>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-3.5" style={{ marginBottom: '12px' }}>
              <UploadScopeButton active={uploadScope === 'department'} onClick={() => onUploadScopeChange('department')} label="부서 공유" />
              <UploadScopeButton active={uploadScope === 'company'} company onClick={() => onUploadScopeChange('company')} label="전사 공개" />
            </div>
            <p className="text-xs text-[#6e6e73]" style={{ padding: '12px 0' }}>
              {uploadScope === 'company' ? '모든 임직원이 이 파일을 볼 수 있습니다.' : '같은 부서 구성원만 이 파일을 볼 수 있습니다.'}
            </p>
          </div>

          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{ marginTop: '24px' }}
            className={`border-2 border-dashed rounded-2xl py-10 px-7 flex flex-col items-center text-center transition-colors ${dragOver ? 'border-[#0071e3] bg-[#eef4ff]' : 'border-[#e5e5e7] bg-[#f5f5f7]'}`}
          >
            <svg className="w-10 h-10 text-[#6e6e73] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
            <p className="text-sm font-medium text-[#1d1d1f] mb-1">파일을 여기에 끌어다 놓으세요</p>
            <p className="text-xs text-[#6e6e73] mb-4">또는</p>
            <button onClick={onFilePicker} style={{ margin: '12px 0' }} className="px-5 py-3 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors">
              파일 선택
            </button>
            <p className="text-xs text-[#6e6e73] mt-4">PDF, DOCX, PPTX, XLSX, HWP, MD (최대 50MB)</p>
          </div>

          {selectedFiles.length > 0 && uploadProgress === null && (
            <div className="p-5 bg-[#f5f5f7] rounded-xl border border-[#e5e5e7]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-[#1d1d1f]">
                  {selectedFiles.length}개 파일 · {formatSize(selectedFiles.reduce((s, f) => s + f.size, 0))}
                </p>
                <button onClick={onClearSelectedFiles} className="text-xs text-[#6e6e73] hover:text-[#1d1d1f]">전체 삭제</button>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {selectedFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#e5e5e7]">
                    <div className={`w-8 h-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center shrink-0 ${FILE_TYPE_BADGE[getFileType(file.name)] ?? 'text-gray-400'}`}>
                      <FileGlyph />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1d1d1f] truncate">{file.name}</p>
                      <p className="text-xs text-[#6e6e73]">{formatSize(file.size)}</p>
                    </div>
                    <button onClick={() => onRemoveSelectedFile(idx)} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] shrink-0">
                      <CloseSmallIcon />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={onUpload} className="mt-4 w-full py-3 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors">
                {selectedFiles.length}개 파일 업로드
              </button>
            </div>
          )}

          {uploadProgress !== null && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[#1d1d1f]">{uploadProgress.percent >= 100 ? '업로드 완료!' : `업로드 중... (${uploadProgress.current}/${uploadProgress.total})`}</span>
                <span className="text-[#0071e3] font-medium font-num">{uploadProgress.percent}%</span>
              </div>
              <div className="h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${uploadProgress.percent >= 100 ? 'bg-[#30d158]' : 'bg-[#0071e3]'}`} style={{ width: `${uploadProgress.percent}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FileDetailModal({
  file,
  onClose,
  onDownload,
  onAutofill,
  onScopeToggle,
}: {
  file: FileItem | null;
  onClose: () => void;
  onDownload: (file: FileItem) => void;
  onAutofill: (file: FileItem) => void;
  onScopeToggle: (file: FileItem) => Promise<void>;
}) {
  const router = useRouter();

  if (!file) return null;

  const ext = (file.type ?? '').toUpperCase();
  const name = file.name ?? '';
  const isDocForm = ['DOCX', 'HWPX', 'HWP'].includes(ext);
  const isContract = isContractTemplate(name);
  const isMeeting = /회의|minutes|meeting/i.test(name);
  const showRecommendedActions = isDocForm || ext === 'PDF';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-0 py-[20px] backdrop-blur-sm sm:px-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-t-[28px] shadow-xl w-full max-w-md max-h-[calc(100vh-40px)] overflow-hidden sm:rounded-[24px]">
        <div className="px-5 py-5 border-b border-[#e5e5e7] flex items-center justify-between sm:px-6 sm:py-6">
          <h2 className="text-[15px] font-semibold text-[#1B1F2B]">파일 상세</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
            <CloseIcon />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 flex max-h-[calc(100vh-112px)] flex-col gap-5 sm:px-6 sm:py-6 sm:gap-6 sm:max-h-[calc(100vh-128px)]">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl bg-[#f5f5f7] flex items-center justify-center ${FILE_TYPE_BADGE[file.type] ?? 'text-gray-400'}`}>
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-[#1d1d1f] truncate">{file.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${FILE_TYPE_BADGE[file.type] ?? 'bg-gray-100 text-gray-600'}`}>{file.type}</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${FILE_STATUS_COLOR[file.status]}`}>{file.status}</span>
              </div>
            </div>
          </div>
          <dl className="text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="flex justify-between"><dt className="text-[#6e6e73]">부서</dt><dd className="text-[#1d1d1f] font-medium">{file.department}</dd></div>
            <div className="flex justify-between items-center">
              <dt className="text-[#6e6e73]">공개 범위</dt>
              <dd className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${file.scope === 'company' ? 'bg-[#e0f0ff] text-[#0071e3]' : 'bg-[#f5f5f7] text-[#6e6e73]'}`}>
                  {file.scope === 'company' ? '전사' : '부서'}
                </span>
                {file.isOwner && (
                  <button onClick={() => void onScopeToggle(file)} className="text-xs text-[#0071e3] hover:underline">
                    {file.scope === 'company' ? '부서로 변경' : '전사로 변경'}
                  </button>
                )}
              </dd>
            </div>
            <div className="flex justify-between"><dt className="text-[#6e6e73]">크기</dt><dd className="text-[#1d1d1f] font-medium">{file.size}</dd></div>
            <div className="flex justify-between"><dt className="text-[#6e6e73]">업로드일</dt><dd className="text-[#1d1d1f] font-medium">{file.uploadDate}</dd></div>
            <div className="flex justify-between"><dt className="text-[#6e6e73]">상태</dt><dd className="text-[#1d1d1f] font-medium">{file.status}</dd></div>
          </dl>
          <div className="rounded-xl border border-[#E2E5EA] bg-[#F7F8FA] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7C8494]">Document Flow</p>
            <p className="text-[13px] font-semibold text-[#1B1F2B]" style={{ marginTop: 10 }}>저장된 파일을 공유, 검토, 재작성 흐름으로 연결합니다.</p>
            <p className="text-[12px] leading-5 text-[#667085]" style={{ marginTop: 10 }}>
              공개 범위를 정한 뒤 AI 검색, 문서 생성, 전문 분석으로 이어가고, 이후 코멘트 반영과 버전 관리의 기준 자료로 사용합니다.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {file.sourceType === 'document' ? (
            <button onClick={() => { router.push(`/documents/${file.id}`); onClose(); }} className="flex-1 py-3 rounded-xl bg-[#0071e3] text-white text-[13px] font-medium hover:bg-[#005bb5] transition-colors">
                문서 보기
              </button>
            ) : (
              <button onClick={() => { onDownload(file); onClose(); }} className="flex-1 py-3 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors">
                다운로드
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#e5e5e7] text-[13px] font-medium text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">
              닫기
            </button>
          </div>
          {showRecommendedActions && (
            <div className="flex flex-col gap-[20px]">
              <p className="text-[11px] text-[#9CA3AF] font-medium">문서 운영 다음 작업</p>
              <DocumentActionStack
                items={[
                  ...(isDocForm
                    ? [{
                        label: '자동채우기',
                        onClick: () => onAutofill(file),
                        variant: 'secondary' as const,
                      }]
                    : []),
                  {
                    label: '이 파일로 후속 문서 작성',
                    onClick: () => {
                      router.push(buildDocumentCreateHref({
                        fileIds: [file.id],
                        instructions: `"${file.name}" 파일을 참고 자료로 사용해 후속 문서를 작성하세요.`,
                      }));
                      onClose();
                    },
                    variant: 'success' as const,
                  },
                  ...((isContract || ['DOCX', 'HWPX', 'HWP', 'PDF'].includes(ext))
                    ? [{
                        label: '계약 리스크 분석',
                        onClick: () => {
                          router.push(`/contract-risk?source=${encodeURIComponent(file.name)}`);
                          onClose();
                        },
                        variant: 'warning' as const,
                      }]
                    : []),
                  {
                    label: 'AI 검색에 활용',
                    onClick: () => {
                      router.push(`/search?q=${encodeURIComponent(file.name)}`);
                      onClose();
                    },
                    variant: 'secondary' as const,
                  },
                  ...(isMeeting
                    ? [{
                        label: '할일 추출',
                        onClick: () => {
                          router.push(buildDocumentCreateHref({
                            fileIds: [file.id],
                            instructions: `"${file.name}" 파일을 중심으로 문서를 작성해줘.`,
                          }));
                          onClose();
                        },
                        variant: 'success' as const,
                      }]
                    : []),
                  {
                    label: '문서 생성으로 이동',
                    onClick: () => {
                      router.push(buildDocumentCreateHref());
                      onClose();
                    },
                    variant: 'muted' as const,
                  },
                ]}
              />
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
      <div className="bg-white rounded-t-[28px] shadow-xl w-full max-w-lg sm:mx-4 sm:rounded-[24px]">
        <div className="px-5 py-5 border-b border-[#e5e5e7] flex items-center justify-between sm:px-6 sm:py-6">
          <h2 className="text-[15px] font-semibold text-[#1B1F2B]">URL 상품 링크 수집</h2>
          {!scrapeLoading && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f5f5f7]">
              <CloseIcon />
            </button>
          )}
        </div>

        <div className="px-5 py-5 flex flex-col gap-5 sm:px-6 sm:py-6 sm:gap-6">
          <p className="text-sm text-[#6e6e73]">쇼핑몰 카테고리 페이지 URL을 입력하면 상품 링크를 자동으로 수집합니다.</p>

          <input
            type="url"
            value={scrapeUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com/category/..."
            disabled={scrapeLoading}
            className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && scrapeUrl.trim() && !scrapeLoading) onScrape();
            }}
          />

          {scrapeLoading && (
            <div className="flex items-center gap-3 mt-4 p-4 rounded-xl bg-[#f5f5f7]">
              <Spinner size="sm" />
              <span className="text-sm text-[#6e6e73]">상품 링크를 수집하고 있습니다...</span>
            </div>
          )}

          {scrapeResult && !scrapeLoading && (
            <div className={`flex items-start gap-3 mt-4 p-4 rounded-xl ${scrapeResult.success ? 'bg-[#f0fdf4]' : 'bg-[#fef2f2]'}`}>
              {scrapeResult.success ? <SuccessIcon /> : <WarningIcon />}
              <span className="text-sm text-[#1d1d1f]">{scrapeResult.message}</span>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <button onClick={onClose} disabled={scrapeLoading} className="flex-1 py-2 rounded-xl border border-[#e5e5e7] text-[13px] font-medium text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50">
              {scrapeResult?.success && scrapeResult.linkCount ? '닫기' : '취소'}
            </button>
            {!(scrapeResult?.success && scrapeResult.linkCount) && (
              <button onClick={onScrape} disabled={!scrapeUrl.trim() || scrapeLoading} className="flex-1 py-2 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-50">
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
            <div className="w-12 h-12 rounded-full bg-[#fff1f0] flex items-center justify-center mx-auto mb-4">
              <WarningIcon />
            </div>
            <h3 className="text-[15px] font-semibold text-[#1B1F2B] mb-1.5">파일 삭제</h3>
            <p className="text-sm text-[#6e6e73] mb-5">
              &quot;{deleteConfirm.name}&quot;을(를) 삭제하시겠습니까?<br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button onClick={onCloseDeleteConfirm} className="flex-1 py-2 rounded-xl border border-[#e5e5e7] text-[13px] font-medium text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">
                취소
              </button>
              <button onClick={onConfirmDelete} className="flex-1 py-2 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors">
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
        <div className="fixed bottom-20 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-[#1d1d1f] text-white rounded-xl shadow-lg animate-[slideUp_0.3s_ease-out] sm:left-auto sm:right-6 sm:bottom-6 sm:px-5">
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
    ? 'border-[#0071e3] bg-[#0071e3] text-white'
    : 'border-[#1d1d1f] bg-[#1d1d1f] text-white';

  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3.5 rounded-xl border text-sm font-medium transition-colors ${active ? activeClass : 'border-[#e5e5e7] text-[#6e6e73] hover:bg-[#f5f5f7]'}`}
    >
      {label}
    </button>
  );
}

function FileGlyph() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function CloseIcon() {
  return <svg className="w-5 h-5 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}

function CloseSmallIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}

function SuccessIcon() {
  return <svg className="w-5 h-5 text-[#30d158] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}

function WarningIcon() {
  return <svg className="w-5 h-5 text-[#ff3b30] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;
}
