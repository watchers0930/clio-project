'use client';

import { useState } from 'react';
import { SearchInput, EmptyState, Spinner } from '@/components/ui';
import { VoiceInputButton } from '@/components/common/VoiceInputButton';
import { DocumentActionRow } from '@/components/documents/document-action-row';
import { ArrowRight } from 'lucide-react';
import type { SearchResult } from './types';

interface ResumeCardSpacingConfig {
  descriptionMarginTop: number;
  descriptionMarginBottom: number;
  excerptMarginTop: number;
  actionsMarginTop: number;
}

interface SearchContextCardLayoutConfig {
  outerPaddingX: number;
  outerPaddingY: number;
  chipGap: number;
  descriptionMarginTop: number;
  descriptionSecondaryMarginTop: number;
  helperBoxMarginTop: number;
  helperBoxPaddingX: number;
  helperBoxPaddingY: number;
}

interface RelatedDocsCardLayoutConfig {
  outerPadding: number;
  contentMarginTop: number;
  listGap: number;
  itemPaddingX: number;
  itemPaddingY: number;
}

interface RecentFlowCardLayoutConfig {
  outerPadding: number;
  contentMarginTop: number;
  chipGap: number;
}

type LayoutStore = {
  resumeDocument: ResumeCardSpacingConfig;
  resumeFile: ResumeCardSpacingConfig;
  searchContext: SearchContextCardLayoutConfig;
  relatedDocs: RelatedDocsCardLayoutConfig;
  recentFlow: RecentFlowCardLayoutConfig;
};

const DEFAULT_RESUME_CARD_SPACING: ResumeCardSpacingConfig = {
  descriptionMarginTop: 12,
  descriptionMarginBottom: 14,
  excerptMarginTop: 20,
  actionsMarginTop: 20,
};

const DEFAULT_SEARCH_CONTEXT_LAYOUT: SearchContextCardLayoutConfig = {
  outerPaddingX: 20,
  outerPaddingY: 16,
  chipGap: 8,
  descriptionMarginTop: 12,
  descriptionSecondaryMarginTop: 4,
  helperBoxMarginTop: 12,
  helperBoxPaddingX: 16,
  helperBoxPaddingY: 12,
};

const DEFAULT_RELATED_DOCS_LAYOUT: RelatedDocsCardLayoutConfig = {
  outerPadding: 20,
  contentMarginTop: 16,
  listGap: 12,
  itemPaddingX: 16,
  itemPaddingY: 12,
};

const DEFAULT_RECENT_FLOW_LAYOUT: RecentFlowCardLayoutConfig = {
  outerPadding: 20,
  contentMarginTop: 16,
  chipGap: 8,
};

const DEFAULT_RESUME_CARD_LAYOUTS: LayoutStore = {
  resumeDocument: { ...DEFAULT_RESUME_CARD_SPACING },
  resumeFile: { ...DEFAULT_RESUME_CARD_SPACING },
  searchContext: { ...DEFAULT_SEARCH_CONTEXT_LAYOUT },
  relatedDocs: { ...DEFAULT_RELATED_DOCS_LAYOUT },
  recentFlow: { ...DEFAULT_RECENT_FLOW_LAYOUT },
};

interface FileTabProps {
  query: string;
  searched: boolean;
  loading: boolean;
  departments: string[];
  department: string;
  fileType: string;
  sort: string;
  suggestions: string[];
  recentQueries: string[];
  searchContext: {
    role: string;
    departmentName: string;
    documentScopeLabel: string;
    departmentFilterLabel: string;
    availableDepartments: string[];
  } | null;
  sortedResults: SearchResult[];
  relatedResults: SearchResult[];
  expandedSummary: string | null;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onDepartmentChange: (value: string) => void;
  onFileTypeChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onSuggestionClick: (value: string) => void;
  onVoiceTranscript: (value: string) => void;
  onOpenPreview: (fileId: string) => void;
  onOpenResult: (result: SearchResult) => void;
  onOpenComments: (result: SearchResult) => void;
  onOpenShare: (result: SearchResult) => void;
  onToggleSummary: (id: string) => void;
  onDownloadOriginal: (result: SearchResult) => void;
  onOpenGmailAttachments?: (result: SearchResult) => void;
  onStartChat?: (result: SearchResult) => void;
  onOpenDocumentsFromResult: (result: SearchResult) => void;
  onOpenContractRiskFromResult: (result: SearchResult) => void;
  onOpenFiles: () => void;
  canAnalyzeContract: (result: SearchResult) => boolean;
}

export function FileSearchTab({
  query,
  searched,
  loading,
  departments,
  department,
  fileType,
  sort,
  suggestions,
  recentQueries,
  searchContext,
  sortedResults,
  relatedResults,
  expandedSummary,
  onQueryChange,
  onSearch,
  onDepartmentChange,
  onFileTypeChange,
  onSortChange,
  onSuggestionClick,
  onVoiceTranscript,
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
}: FileTabProps) {
  const [resumeCardLayouts] = useState<LayoutStore>(DEFAULT_RESUME_CARD_LAYOUTS);
  const topDocumentResult = sortedResults.find((result) => result.sourceType === 'document') ?? null;
  const topFileResult = sortedResults.find((result) => result.sourceType !== 'document') ?? null;

  return (
    <>
      <div className="rounded-2xl border border-border bg-white" style={{ padding: '32px' }}>
        <div className="relative flex items-center gap-2">
          <div className="flex-1">
            <SearchInput
              value={query}
              onChange={onQueryChange}
              onSearch={onSearch}
              placeholder="파일명이나 내용으로 검색하세요..."
              showButton
              buttonLabel={loading ? '검색 중...' : '검색'}
              loading={loading}
              buttonDisabled={loading || !query.trim()}
              size="lg"
            />
          </div>
          <VoiceInputButton onTranscript={onVoiceTranscript} disabled={loading} className="shrink-0" />
        </div>
      </div>

      <div className="flex flex-col" style={{ gap: 8 }}>
        <div className="flex flex-wrap items-center" style={{ gap: 22 }}>
          <select value={department} onChange={(e) => onDepartmentChange(e.target.value)} className="rounded-xl border border-border bg-white text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary" style={{ padding: '10px 18px 10px 18px', paddingRight: 36 }}>
            {departments.map((item) => <option key={item} value={item}>{item === '전체' ? '부서' : item}</option>)}
          </select>
          <select value={fileType} onChange={(e) => onFileTypeChange(e.target.value)} className="rounded-xl border border-border bg-white text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary" style={{ padding: '10px 18px 10px 18px', paddingRight: 36 }}>
            {['전체', 'PDF', 'DOCX', 'PPTX', 'XLSX', 'MD', 'M4A'].map((item) => <option key={item} value={item}>{item === '전체' ? '파일형식' : item}</option>)}
          </select>
        </div>

        {searchContext ? (
          <div
            className="relative rounded-2xl border border-border-tint bg-primary-tint"
            style={{
              paddingLeft: resumeCardLayouts.searchContext.outerPaddingX,
              paddingRight: resumeCardLayouts.searchContext.outerPaddingX,
              paddingTop: resumeCardLayouts.searchContext.outerPaddingY,
              paddingBottom: resumeCardLayouts.searchContext.outerPaddingY,
            }}
          >
            <div className="flex flex-wrap items-center" style={{ gap: resumeCardLayouts.searchContext.chipGap }}>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-primary">검색 권한 범위</span>
              <span className="rounded-full border border-border-tint bg-white px-3 py-1 text-[11px] text-foreground-secondary">역할: {searchContext.role}</span>
              <span className="rounded-full border border-border-tint bg-white px-3 py-1 text-[11px] text-foreground-secondary">기본 부서: {searchContext.departmentName}</span>
              <span className="rounded-full border border-border-tint bg-white px-3 py-1 text-[11px] text-foreground-secondary">조회 가능 부서: {Math.max(searchContext.availableDepartments.length - 1, 0)}개</span>
              <span className="rounded-full border border-primary/30 bg-primary-tint px-3 py-1 text-[11px] font-medium text-primary">현재 부서 필터: {department}</span>
              <span className="rounded-full border border-primary/30 bg-primary-tint px-3 py-1 text-[11px] font-medium text-primary">현재 파일 형식: {fileType}</span>
            </div>
            <p className="text-[12px] leading-5 text-foreground-secondary" style={{ marginTop: resumeCardLayouts.searchContext.descriptionMarginTop }}>{searchContext.documentScopeLabel}</p>
            <p className="text-[12px] leading-5 text-foreground-secondary" style={{ marginTop: resumeCardLayouts.searchContext.descriptionSecondaryMarginTop }}>{searchContext.departmentFilterLabel}</p>
            <div
              className="rounded-xl border border-border-tint bg-white"
              style={{
                marginTop: resumeCardLayouts.searchContext.helperBoxMarginTop,
                paddingLeft: resumeCardLayouts.searchContext.helperBoxPaddingX,
                paddingRight: resumeCardLayouts.searchContext.helperBoxPaddingX,
                paddingTop: resumeCardLayouts.searchContext.helperBoxPaddingY,
                paddingBottom: resumeCardLayouts.searchContext.helperBoxPaddingY,
              }}
            >
              <p className="text-[12px] font-semibold text-foreground">지금 검색에 적용되는 기준</p>
              <p className="mt-1 text-[12px] leading-5 text-foreground-secondary">결과는 현재 계정이 접근 가능한 문서 범위 안에서만 계산되며, 위 필터는 그 범위를 다시 좁히는 용도로만 동작합니다.</p>
            </div>
          </div>
        ) : null}

        {searched ? <p className="text-[12px] text-foreground-secondary">이번 검색 필터에는 접근 가능한 부서만 표시되며, 선택한 파일 형식은 결과 목록과 후속 액션 제안에 함께 반영됩니다.</p> : null}

        {searched ? (
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onSuggestionClick(suggestion)}
                className="rounded-full border border-border bg-surface-secondary text-[14px] text-foreground transition-colors hover:border-primary hover:bg-white"
                style={{ padding: '10px 18px' }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Spinner size="lg" />
          <p className="text-sm text-foreground-secondary">파일을 검색하고 있습니다...</p>
        </div>
      ) : null}

      {searched && !loading ? (
        <>
          {sortedResults.length > 0 ? (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <WorkflowResumeCard
                spacing={resumeCardLayouts.resumeDocument}
                eyebrow="Resume Document"
                title="검색 후 바로 이어볼 문서 작업"
                description={topDocumentResult ? '가장 먼저 확인할 문서 결과를 열고 코멘트, 공유, 새 문서 활용으로 바로 넘깁니다.' : '아직 문서 결과가 없어서 파일 기준 후속 작업을 먼저 제안합니다.'}
                result={topDocumentResult}
                emptyLabel="이번 검색에서 바로 이어볼 문서 결과가 아직 없습니다."
                primaryActionLabel="문서 열기"
                secondaryActionLabel="코멘트 보기"
                tertiaryActionLabel="새 문서 활용"
                onOpenResult={onOpenResult}
                onSecondaryAction={onOpenComments}
                onTertiaryAction={onOpenDocumentsFromResult}
                onShare={onOpenShare}
              />
              <WorkflowResumeCard
                spacing={resumeCardLayouts.resumeFile}
                eyebrow="Resume File"
                title="검색 후 바로 이어볼 파일 작업"
                description={topFileResult ? '파일을 다시 열고 공유하거나 검토용 문서로 넘겨서 다음 흐름을 바로 시작합니다.' : '이번 검색에는 파일 결과가 없어서 문서 중심으로 작업을 이어가면 됩니다.'}
                result={topFileResult}
                emptyLabel="이번 검색에서 바로 이어볼 파일 결과가 아직 없습니다."
                primaryActionLabel="파일 열기"
                secondaryActionLabel="공유"
                tertiaryActionLabel="새 문서 활용"
                onOpenResult={onOpenResult}
                onSecondaryAction={onOpenShare}
                onTertiaryAction={onOpenDocumentsFromResult}
                onShare={onOpenShare}
              />
            </section>
          ) : null}

          {(relatedResults.length > 0 || recentQueries.length > 0) ? (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="relative rounded-2xl border border-border bg-white" style={{ padding: resumeCardLayouts.relatedDocs.outerPadding }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-secondary">Related Docs</p>
                <p className="mt-2 text-[14px] font-semibold text-foreground">이번 검색에서 같이 볼 문서</p>
                <div className="flex flex-col" style={{ marginTop: resumeCardLayouts.relatedDocs.contentMarginTop, gap: resumeCardLayouts.relatedDocs.listGap }}>
                  {relatedResults.slice(0, 3).map((result) => (
                    <button
                      key={result.id}
                      onClick={() => onOpenResult(result)}
                      className="rounded-xl border border-border bg-surface-tertiary text-left transition-colors hover:border-primary/40 hover:bg-white"
                      style={{
                        paddingLeft: resumeCardLayouts.relatedDocs.itemPaddingX,
                        paddingRight: resumeCardLayouts.relatedDocs.itemPaddingX,
                        paddingTop: resumeCardLayouts.relatedDocs.itemPaddingY,
                        paddingBottom: resumeCardLayouts.relatedDocs.itemPaddingY,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-[13px] font-semibold text-foreground">{result.name}</p>
                        <div className="flex items-center gap-2">
                          {result.relationLabel ? <span className="rounded-full bg-primary-tint px-2.5 py-1 text-[10px] font-medium text-primary">{result.relationLabel}</span> : null}
                          <span className="text-[10px] font-medium text-foreground-secondary">{result.department}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-foreground-secondary">
                        {result.fileType} · {result.date}
                        {result.originDocumentTitle ? ` · 기준 문서 ${result.originDocumentTitle}` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative rounded-2xl border border-border bg-white" style={{ padding: resumeCardLayouts.recentFlow.outerPadding }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-secondary">Recent Flow</p>
                <p className="mt-2 text-[14px] font-semibold text-foreground">최근 자주 이어본 검색 흐름</p>
                <div className="mt-4 flex flex-wrap" style={{ marginTop: resumeCardLayouts.recentFlow.contentMarginTop, gap: resumeCardLayouts.recentFlow.chipGap }}>
                  {recentQueries.length === 0 ? (
                    <p className="text-[12px] leading-5 text-foreground-secondary">최근 검색 흐름이 아직 없습니다. 몇 번 검색하면 여기에서 바로 다시 이어갈 수 있습니다.</p>
                  ) : (
                    recentQueries.map((recentQuery) => (
                      <button key={recentQuery} onClick={() => onSuggestionClick(recentQuery)} className="rounded-full border border-primary/30 bg-primary-tint px-3 py-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary-tint">
                        {recentQuery}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </section>
          ) : null}

          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground-secondary"><span className="font-semibold text-foreground">{sortedResults.length}개</span> 결과</p>
            <select value={sort} onChange={(e) => onSortChange(e.target.value)} className="rounded-lg border border-border bg-white px-3.5 py-2 text-sm text-foreground focus:outline-none">
              {['관련도순', '최신순', '오래된순', '이름순'].map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>

          {sortedResults.length === 0 ? (
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
                                label: '이메일 열기',
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

                    <div className="mt-8 flex items-center gap-4 border-t border-surface-secondary pt-5">
                      {result.dataSource !== 'gmail' && (
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
          )}
        </>
      ) : null}

      {!searched && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-secondary" style={{ marginBottom: 16 }}>
            <SearchIcon />
          </div>
          <h3 className="text-lg font-semibold text-foreground" style={{ marginBottom: 8 }}>파일 검색</h3>
          <p className="max-w-sm text-sm text-foreground-secondary">파일명이나 내용으로 업로드된 문서를 검색합니다.</p>
        </div>
      ) : null}
    </>
  );
}

function WorkflowResumeCard({
  spacing,
  eyebrow,
  title,
  description,
  result,
  emptyLabel,
  primaryActionLabel,
  secondaryActionLabel,
  tertiaryActionLabel,
  onOpenResult,
  onSecondaryAction,
  onTertiaryAction,
  onShare,
}: {
  spacing: ResumeCardSpacingConfig;
  eyebrow: string;
  title: string;
  description: string;
  result: SearchResult | null;
  emptyLabel: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  tertiaryActionLabel: string;
  onOpenResult: (result: SearchResult) => void;
  onSecondaryAction: (result: SearchResult) => void;
  onTertiaryAction: (result: SearchResult) => void;
  onShare: (result: SearchResult) => void;
}) {
  return (
    <div className="relative rounded-2xl border border-border bg-primary-tint p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-secondary">{eyebrow}</p>
      <p className="mt-2 text-[15px] font-semibold text-foreground">{title}</p>
      <p className="text-[12px] leading-5 text-foreground-secondary" style={{ marginTop: spacing.descriptionMarginTop, marginBottom: spacing.descriptionMarginBottom }}>{description}</p>

      {result ? (
        <div className="mt-4 rounded-2xl border border-border-tint bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-foreground">{result.name}</p>
              <p className="mt-1 text-[12px] text-foreground-secondary">{result.fileType} · {result.department} · {result.date}</p>
              {result.relationLabel ? <p className="mt-2 text-[11px] text-primary">{result.relationLabel}{result.originDocumentTitle ? ` · 기준 문서 ${result.originDocumentTitle}` : ''}</p> : null}
            </div>
            <span className="rounded-full bg-primary-tint px-2.5 py-1 text-[11px] font-semibold text-primary">{result.relevance}%</span>
          </div>
          <p className="line-clamp-2 text-[12px] leading-5 text-foreground-secondary" style={{ marginTop: spacing.excerptMarginTop }}>{result.excerpt}</p>
          <div aria-hidden="true" style={{ height: 10 }} />
          <div style={{ marginTop: spacing.actionsMarginTop }}>
            <DocumentActionRow
              items={[
                {
                  label: primaryActionLabel,
                  onClick: () => onOpenResult(result),
                  variant: 'primary',
                  trailing: <ArrowRight size={14} />,
                },
                {
                  label: secondaryActionLabel,
                  onClick: () => onSecondaryAction(result),
                  variant: 'secondary',
                },
                {
                  label: '공유',
                  onClick: () => onShare(result),
                  variant: 'share',
                },
                {
                  label: tertiaryActionLabel,
                  onClick: () => onTertiaryAction(result),
                  variant: 'secondary',
                },
              ]}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border-tint bg-white px-4 py-5 text-[12px] leading-5 text-foreground-secondary">{emptyLabel}</div>
      )}
    </div>
  );
}

function SearchIcon() {
  return <svg className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>;
}

function EyeIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}

function SparkleIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>;
}

function DownloadIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
}
