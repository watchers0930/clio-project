'use client';

import { useState } from 'react';
import { SearchInput, Spinner } from '@/components/ui';
import { VoiceInputButton } from '@/components/common/VoiceInputButton';
import type { SearchResult } from './types';
import { DEFAULT_RESUME_CARD_LAYOUTS, type LayoutStore } from './search-layout-config';
import { WorkflowResumeCard } from './workflow-resume-card';
import { SearchResultList } from './search-result-list';
import { SearchIcon } from './search-icons';

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
  isElectron?: boolean;
  onCopyLocalPath?: (result: SearchResult) => void;
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
  isElectron,
  onCopyLocalPath,
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
                primaryActionLabel={topFileResult?.dataSource === 'local' && !isElectron ? '폴더 경로 복사' : '파일 열기'}
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

          <SearchResultList
            sortedResults={sortedResults}
            expandedSummary={expandedSummary}
            isElectron={isElectron}
            onOpenPreview={onOpenPreview}
            onOpenResult={onOpenResult}
            onOpenComments={onOpenComments}
            onOpenShare={onOpenShare}
            onToggleSummary={onToggleSummary}
            onDownloadOriginal={onDownloadOriginal}
            onOpenGmailAttachments={onOpenGmailAttachments}
            onOpenDocumentsFromResult={onOpenDocumentsFromResult}
            onOpenContractRiskFromResult={onOpenContractRiskFromResult}
            onOpenFiles={onOpenFiles}
            canAnalyzeContract={canAnalyzeContract}
            onCopyLocalPath={onCopyLocalPath}
          />
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
