'use client';

import { EmptyState } from '@/components/ui';
import { DocumentActionRow } from '@/components/documents/document-action-row';
import { ArrowRight } from 'lucide-react';
import type { SearchResult } from './types';
import { DuplicateGroup } from './duplicate-group';
import { EyeIcon, SparkleIcon, DownloadIcon } from './search-icons';

interface SearchResultListProps {
  sortedResults: SearchResult[];
  expandedSummary: string | null;
  isElectron?: boolean;
  onOpenPreview: (fileId: string) => void;
  onOpenResult: (result: SearchResult) => void;
  onOpenComments: (result: SearchResult) => void;
  onOpenShare: (result: SearchResult) => void;
  onToggleSummary: (id: string) => void;
  onDownloadOriginal: (result: SearchResult) => void;
  onOpenGmailAttachments?: (result: SearchResult) => void;
  onOpenDocumentsFromResult: (result: SearchResult) => void;
  onOpenContractRiskFromResult: (result: SearchResult) => void;
  onOpenFiles: () => void;
  canAnalyzeContract: (result: SearchResult) => boolean;
  onCopyLocalPath?: (result: SearchResult) => void;
}

/**
 * 파일 검색 결과 목록(결과 없음 안내 포함)과 결과별 액션.
 */
export function SearchResultList({
  sortedResults,
  expandedSummary,
  isElectron,
  onOpenPreview,
  onOpenResult,
  onOpenComments,
  onOpenShare,
  onToggleSummary,
  onDownloadOriginal,
  onOpenGmailAttachments,
  onOpenDocumentsFromResult,
  onOpenContractRiskFromResult,
  onOpenFiles,
  canAnalyzeContract,
  onCopyLocalPath,
}: SearchResultListProps) {
  return sortedResults.length === 0 ? (
    <EmptyState iconType="search" title="검색 결과가 없습니다" description="다른 키워드로 다시 검색해 보세요" />
  ) : (
    <div className="flex flex-col gap-4">
      {sortedResults.map((result) => (
        <div key={result.id} className="rounded-2xl border border-border bg-primary-tint p-5 transition-shadow hover:shadow-md">
          <div className="rounded-2xl border border-border-tint bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {result.dataSource === 'gmail' ? (
                    <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-600">지메일</span>
                  ) : result.dataSource === 'local' ? (
                    <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-800">로컬</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-600">문서허브</span>
                  )}
                </div>
                <h3 className="truncate text-[16px] font-semibold text-foreground">{result.name}</h3>
                <p className="mt-1 text-[12px] text-foreground-secondary">{result.fileType} · {result.department} · {result.date}</p>
                {result.relationLabel ? (
                  <p className="mt-2 text-[11px] text-primary">
                    {result.relationLabel}
                    {result.originDocumentTitle ? ` · 기준 문서 ${result.originDocumentTitle}` : ''}
                  </p>
                ) : result.originDocumentTitle ? (
                  <p className="mt-2 text-[11px] text-foreground-secondary">기준 문서 <span className="font-medium text-foreground">{result.originDocumentTitle}</span></p>
                ) : null}
              </div>
              <span className="rounded-full bg-primary-tint px-2.5 py-1 text-[11px] font-semibold text-primary">{result.relevance}%</span>
            </div>

            <p className="mt-5 text-[12px] leading-5 text-foreground-secondary">{result.excerpt}</p>

            <div aria-hidden="true" style={{ height: 10 }} />
            <DocumentActionRow
              items={
                result.dataSource === 'gmail'
                  ? [
                      {
                        label: '이메일 보기·번역',
                        onClick: () => onOpenResult(result),
                        variant: 'primary' as const,
                        trailing: <ArrowRight size={14} />,
                      },
                      {
                        label: '첨부파일 받기',
                        onClick: () => onOpenGmailAttachments?.(result),
                        variant: 'secondary' as const,
                      },
                      {
                        label: 'AI에게 묻기',
                        onClick: () => onOpenComments(result),
                        variant: 'secondary' as const,
                      },
                      {
                        label: '새 문서 활용',
                        onClick: () => onOpenDocumentsFromResult(result),
                        variant: 'secondary' as const,
                        trailing: <ArrowRight size={14} />,
                      },
                    ]
                  : result.dataSource === 'local'
                  ? [
                      // 로컬 파일: 웹은 직접 열기 불가 → 경로 복사 / 데스크톱 앱은 파일 열기
                      isElectron
                        ? {
                            label: '파일 열기',
                            onClick: () => onOpenResult(result),
                            variant: 'primary' as const,
                            trailing: <ArrowRight size={14} />,
                          }
                        : {
                            label: '폴더 경로 복사',
                            onClick: () => onCopyLocalPath?.(result),
                            variant: 'primary' as const,
                          },
                      {
                        label: 'AI에게 묻기',
                        onClick: () => onOpenComments(result),
                        variant: 'secondary' as const,
                      },
                      {
                        label: '새 문서 활용',
                        onClick: () => onOpenDocumentsFromResult(result),
                        variant: 'secondary' as const,
                        trailing: <ArrowRight size={14} />,
                      },
                    ]
                  : [
                      {
                        label: result.sourceType === 'document' ? '문서 열기' : '파일 열기',
                        onClick: () => onOpenResult(result),
                        variant: 'primary' as const,
                        trailing: <ArrowRight size={14} />,
                      },
                      {
                        label: result.sourceType === 'document' ? '코멘트 보기' : 'AI에게 묻기',
                        onClick: () => onOpenComments(result),
                        variant: 'secondary' as const,
                      },
                      {
                        label: '공유',
                        onClick: () => onOpenShare(result),
                        variant: 'share' as const,
                      },
                      {
                        label: '새 문서 활용',
                        onClick: () => onOpenDocumentsFromResult(result),
                        variant: 'secondary' as const,
                        trailing: <ArrowRight size={14} />,
                      },
                      ...(canAnalyzeContract(result)
                        ? [{
                            label: '계약 리스크 분석',
                            onClick: () => onOpenContractRiskFromResult(result),
                            variant: 'warning' as const,
                          }]
                        : []),
                      {
                        label: '문서허브 보기',
                        onClick: onOpenFiles,
                        variant: 'muted' as const,
                      },
                    ]
              }
            />

            {result.groupItems && result.groupItems.length > 0 ? (
              <DuplicateGroup
                items={result.groupItems}
                onOpen={onOpenResult}
                onOpenAttachments={onOpenGmailAttachments}
              />
            ) : null}

            <div className="mt-8 flex items-center gap-4 border-t border-surface-secondary pt-5">
              {result.dataSource !== 'gmail' && result.dataSource !== 'local' && (
                <button onClick={() => onOpenPreview(result.id)} className="flex items-center gap-1.5 text-sm font-medium text-foreground-secondary transition-colors hover:text-foreground">
                  <EyeIcon />
                  미리보기
                </button>
              )}
              <button onClick={() => onToggleSummary(result.id)} className="flex items-center gap-1.5 text-sm font-medium text-primary transition-colors">
                <SparkleIcon />
                AI 요약 {expandedSummary === result.id ? '접기' : '보기'}
              </button>
              {result.dataSource === 'gmail' ? (
                <button onClick={() => onOpenGmailAttachments?.(result)} className="flex items-center gap-1.5 text-sm font-medium text-foreground-secondary transition-colors hover:text-foreground">
                  <DownloadIcon />
                  첨부파일 받기
                </button>
              ) : result.dataSource === 'local' ? (
                <button onClick={() => onCopyLocalPath?.(result)} className="flex items-center gap-1.5 text-sm font-medium text-foreground-secondary transition-colors hover:text-foreground">
                  폴더 경로 복사
                </button>
              ) : (
                <button onClick={() => onDownloadOriginal(result)} className="flex items-center gap-1.5 text-sm font-medium text-foreground-secondary transition-colors hover:text-foreground">
                  <DownloadIcon />
                  원본 다운로드
                </button>
              )}
            </div>
          </div>

          {expandedSummary === result.id ? <div className="mt-4 rounded-xl bg-surface-secondary p-5 text-sm leading-relaxed text-foreground">{result.aiSummary}</div> : null}
        </div>
      ))}
    </div>
  );
}
