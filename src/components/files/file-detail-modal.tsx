'use client';

// 파일 상세 모달 (메타 정보·공개 범위 변경·후속 작업 바로가기)
import { useRouter } from 'next/navigation';
import { buildDocumentCreateHref } from '@/lib/documents/navigation';
import { DocumentActionStack } from '@/components/documents/document-action-row';
import { FILE_STATUS_COLOR, FILE_TYPE_BADGE } from '@/lib/constants/ui';
import { isContractTemplate } from '@/lib/contract-fields';
import { CloseIcon } from './file-modal-icons';
import type { FileItem } from './types';

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
      <div className="bg-white rounded-t-[28px] shadow-xl w-full max-w-md max-h-[calc(100vh-40px)] overflow-hidden sm:rounded-xl">
        <div className="px-5 py-5 border-b border-border flex items-center justify-between sm:px-6 sm:py-6">
          <h2 className="text-[15px] font-semibold text-foreground">파일 상세</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-secondary text-foreground-secondary">
            <CloseIcon />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 flex max-h-[calc(100vh-112px)] flex-col gap-5 sm:px-6 sm:py-6 sm:gap-6 sm:max-h-[calc(100vh-128px)]">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl bg-surface-secondary flex items-center justify-center ${FILE_TYPE_BADGE[file.type] ?? 'text-gray-400'}`}>
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{file.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${FILE_TYPE_BADGE[file.type] ?? 'bg-gray-100 text-gray-600'}`}>{file.type}</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${FILE_STATUS_COLOR[file.status]}`}>{file.status}</span>
              </div>
            </div>
          </div>
          <dl className="text-sm flex flex-col gap-2.5">
            <div className="flex justify-between"><dt className="text-foreground-secondary">부서</dt><dd className="text-foreground font-medium">{file.department}</dd></div>
            <div className="flex justify-between items-center">
              <dt className="text-foreground-secondary">공개 범위</dt>
              <dd className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${file.scope === 'company' ? 'bg-primary-tint text-primary' : 'bg-surface-secondary text-foreground-secondary'}`}>
                  {file.scope === 'company' ? '전사' : '부서'}
                </span>
                {file.isOwner && (
                  <button onClick={() => void onScopeToggle(file)} className="text-xs text-primary hover:underline">
                    {file.scope === 'company' ? '부서로 변경' : '전사로 변경'}
                  </button>
                )}
              </dd>
            </div>
            <div className="flex justify-between"><dt className="text-foreground-secondary">크기</dt><dd className="text-foreground font-medium">{file.size}</dd></div>
            <div className="flex justify-between"><dt className="text-foreground-secondary">업로드일</dt><dd className="text-foreground font-medium">{file.uploadDate}</dd></div>
            <div className="flex justify-between"><dt className="text-foreground-secondary">상태</dt><dd className="text-foreground font-medium">{file.status}</dd></div>
          </dl>
          <div className="rounded-xl border border-border bg-surface-secondary px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-secondary">Document Flow</p>
            <p className="text-[13px] font-semibold text-foreground" style={{ marginTop: 10 }}>저장된 파일을 공유, 검토, 재작성 흐름으로 연결합니다.</p>
            <p className="text-[12px] leading-5 text-foreground-secondary" style={{ marginTop: 10 }}>
              공개 범위를 정한 뒤 AI 검색, 문서 생성, 전문 분석으로 이어가고, 이후 코멘트 반영과 버전 관리의 기준 자료로 사용합니다.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {file.sourceType === 'document' ? (
            <button onClick={() => { router.push(`/documents/${file.id}`); onClose(); }} className="flex-1 py-3 rounded-xl bg-primary text-white text-[13px] font-medium hover:bg-primary-dark transition-colors">
                문서 보기
              </button>
            ) : (
              <button onClick={() => { onDownload(file); onClose(); }} className="flex-1 py-3 rounded-xl bg-foreground text-white text-[13px] font-medium hover:bg-primary transition-colors">
                다운로드
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-[13px] font-medium text-foreground-secondary hover:bg-surface-secondary transition-colors">
              닫기
            </button>
          </div>
          {showRecommendedActions && (
            <div className="flex flex-col gap-[20px]">
              <p className="text-[11px] text-foreground-quaternary font-medium">문서 운영 다음 작업</p>
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
