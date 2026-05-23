import { useState } from 'react';
import { DocumentCommentPanel } from '@/components/documents/DocumentCommentPanel';
import { DocumentOpsSummary } from '@/components/documents/document-ops-summary';
import { HtmlPreviewFrame } from '@/components/documents/html-preview-frame';
import type { DocumentItem } from '@/components/documents/page-types';
import { renderProposalDocumentHtml } from '@/lib/templates/proposal-render';

interface DocumentViewerModalProps {
  viewDoc: DocumentItem | null;
  editTitle: string;
  editContent: string;
  saving: boolean;
  isEdited: boolean;
  isDraft: boolean;
  showViewerComments: boolean;
  statusColor: Record<string, string>;
  selectedFont: string;
  downloadFormat: string;
  fontOptions: string[];
  downloadFormatOptions: readonly string[];
  designPrompt: string | null;
  designPromptLang: 'ko' | 'en';
  loadingDesignPrompt: boolean;
  copiedDesignPrompt: boolean;
  onChangeTitle: (value: string) => void;
  onChangeContent: (value: string) => void;
  onToggleComments: () => void;
  onRequestClose: () => void;
  onOpenShare: (doc: DocumentItem) => void;
  onOpenVersions: (docId: string) => void;
  onReuseDocument: (doc: DocumentItem) => void;
  onSearchRelated: (doc: DocumentItem) => void;
  onOpenMemo: (doc: DocumentItem) => void;
  onOpenContractRisk: (doc: DocumentItem) => void;
  onSave: () => void;
  onComplete: () => void;
  onRevertToDraft: () => void;
  onChangeDownloadFormat: (value: string) => void;
  onChangeSelectedFont: (value: string) => void;
  onDownload: (doc: DocumentItem) => void;
  onOpenQualityCheck: (docId: string) => void;
  onOpenTodoExtract: () => void;
  onGenerateDesignPrompt: (lang: 'ko' | 'en') => void;
  onCopyDesignPrompt: () => void;
  onDownloadAiContext: (docId: string, lang: 'ko' | 'en') => void;
  onCommentsReflected: () => void;
}

export function DocumentViewerModal({
  viewDoc,
  editTitle,
  editContent,
  saving,
  isEdited,
  isDraft,
  showViewerComments,
  statusColor,
  selectedFont,
  downloadFormat,
  fontOptions,
  downloadFormatOptions,
  designPrompt,
  designPromptLang,
  loadingDesignPrompt,
  copiedDesignPrompt,
  onChangeTitle,
  onChangeContent,
  onToggleComments,
  onRequestClose,
  onOpenShare,
  onOpenVersions,
  onReuseDocument,
  onSearchRelated,
  onOpenMemo,
  onOpenContractRisk,
  onSave,
  onComplete,
  onRevertToDraft,
  onChangeDownloadFormat,
  onChangeSelectedFont,
  onDownload,
  onOpenQualityCheck,
  onOpenTodoExtract,
  onGenerateDesignPrompt,
  onCopyDesignPrompt,
  onDownloadAiContext,
  onCommentsReflected,
}: DocumentViewerModalProps) {
  const [proposalViewMode, setProposalViewMode] = useState<'preview' | 'edit'>('preview');

  if (!viewDoc) return null;

  const isProposal = viewDoc.template === '제안서';
  const proposalHtml = isProposal
    ? renderProposalDocumentHtml({
        title: isDraft ? editTitle || viewDoc.title : viewDoc.title,
        content: isDraft ? editContent || viewDoc.content || '' : viewDoc.content || '',
        createdAt: viewDoc.createdAt,
      })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="view-doc-title">
      <div className={`flex max-h-[100dvh] w-full flex-col bg-white shadow-xl transition-all duration-300 sm:mx-4 sm:max-h-[90vh] sm:rounded-2xl ${showViewerComments ? 'sm:max-w-6xl' : 'sm:max-w-4xl'}`}>
        <div className="flex items-start justify-between border-b border-border px-4 py-4 shrink-0 sm:px-6 sm:py-5">
          <div className="flex-1 min-w-0 flex flex-col gap-2.5">
            {isDraft ? (
              <input
                value={editTitle}
                onChange={(e) => onChangeTitle(e.target.value)}
                className="text-lg font-semibold text-foreground w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none pb-1 transition-colors"
              />
            ) : (
              <h2 id="view-doc-title" className="text-lg font-semibold text-foreground truncate">{viewDoc.title}</h2>
            )}
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[viewDoc.status]}`}>{viewDoc.status}</span>
              <span className="text-xs text-foreground-secondary">{viewDoc.createdAt}</span>
              {isEdited && <span className="text-xs text-warning font-medium">수정됨</span>}
            </div>
          </div>
          <div className="ml-3 flex items-center gap-2">
            <button
              onClick={() => onOpenShare(viewDoc)}
              className="hidden rounded-lg border border-border px-3.5 py-2.5 text-[12px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary md:inline-flex"
            >
              공유
            </button>
            <button
              onClick={() => onOpenVersions(viewDoc.id)}
              className="hidden rounded-lg border border-border px-3.5 py-2.5 text-[12px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary md:inline-flex"
            >
              버전
            </button>
            <button
              onClick={onToggleComments}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[12px] font-medium transition-colors ${
                showViewerComments
                  ? 'bg-primary text-white'
                  : 'border border-border text-foreground-secondary hover:bg-surface-secondary'
              }`}
              title="댓글"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="hidden sm:inline">댓글</span>
            </button>
            <button onClick={onRequestClose} className="p-2 rounded-lg hover:bg-surface-secondary text-foreground-secondary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="border-b border-border bg-surface-tertiary px-4 py-3 shrink-0 sm:px-6 sm:py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-secondary">Workflow</span>
                <span className="text-[12px] text-foreground">
                  {isDraft
                    ? '저장 -> 검토 공유 -> 댓글 반영 -> 완료 처리'
                    : '검색/재활용 -> 수정 반영 -> 버전 관리 -> 공유 운영'}
                </span>
              </div>
            </div>
            <DocumentOpsSummary
              documentTitle={viewDoc.title}
              isDraft={isDraft}
              versionLabel={(viewDoc.versionNumber ?? 1) > 1 ? `v${viewDoc.versionNumber}` : null}
              onOpenComments={onToggleComments}
              onOpenShare={() => onOpenShare(viewDoc)}
              onOpenVersions={() => onOpenVersions(viewDoc.id)}
              onReuse={() => onReuseDocument(viewDoc)}
              onOpenContractRisk={() => onOpenContractRisk(viewDoc)}
              onOpenMemo={() => onOpenMemo(viewDoc)}
              onSearchRelated={() => onSearchRelated(viewDoc)}
            />
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              {isProposal ? (
                <div className="flex h-full min-h-[400px] flex-col gap-3">
                  {isDraft && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setProposalViewMode('preview')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          proposalViewMode === 'preview'
                            ? 'bg-foreground text-white'
                            : 'border border-border text-foreground-secondary hover:bg-surface-secondary'
                        }`}
                      >
                        레이아웃 보기
                      </button>
                      <button
                        onClick={() => setProposalViewMode('edit')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          proposalViewMode === 'edit'
                            ? 'bg-foreground text-white'
                            : 'border border-border text-foreground-secondary hover:bg-surface-secondary'
                        }`}
                      >
                        원문 편집
                      </button>
                    </div>
                  )}
                  {!isDraft || proposalViewMode === 'preview' ? (
                    <HtmlPreviewFrame
                      title="proposal-preview"
                      html={proposalHtml}
                      className="h-full min-h-[640px] w-full rounded-xl border border-border bg-white"
                    />
                  ) : (
                    <textarea
                      value={editContent}
                      onChange={(e) => onChangeContent(e.target.value)}
                      className="w-full h-full min-h-[400px] text-sm text-foreground leading-relaxed bg-transparent resize-none focus:outline-none font-mono"
                      placeholder="문서 내용을 편집하세요..."
                    />
                  )}
                </div>
              ) : isDraft ? (
                <textarea
                  value={editContent}
                  onChange={(e) => onChangeContent(e.target.value)}
                  className="w-full h-full min-h-[400px] text-sm text-foreground leading-relaxed bg-transparent resize-none focus:outline-none font-mono"
                  placeholder="문서 내용을 편집하세요..."
                />
              ) : (
                <div className="prose prose-sm max-w-none">
                  {(viewDoc.content ?? '문서 내용이 없습니다.').split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">{line.replace('## ', '')}</h2>;
                    if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-foreground mt-4 mb-2">{line.replace('# ', '')}</h1>;
                    if (line.startsWith('- ')) return <li key={i} className="text-sm text-foreground ml-4">{line.replace('- ', '')}</li>;
                    if (line.startsWith('*')) return <p key={i} className="text-sm text-foreground-secondary italic">{line.replace(/\*/g, '')}</p>;
                    if (line.trim() === '---') return <hr key={i} className="my-3 border-border" />;
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="text-sm text-foreground leading-relaxed">{line}</p>;
                  })}
                </div>
              )}
            </div>

            {isProposal && (
              <div className="border-t border-border px-4 py-4 shrink-0 sm:px-6 sm:py-5">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-3.5">
                    <span className="text-sm font-medium text-foreground">AI 디자인 프롬프트</span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-gradient-to-r from-primary to-purple-500 text-white font-medium">GenSpark / Gamma / Canva</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={() => onGenerateDesignPrompt('ko')} disabled={loadingDesignPrompt} className="px-4 py-2.5 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary-tint disabled:opacity-50 transition-colors">
                      {loadingDesignPrompt && designPromptLang === 'ko' ? '생성 중...' : '국문 프롬프트'}
                    </button>
                    <button onClick={() => onGenerateDesignPrompt('en')} disabled={loadingDesignPrompt} className="px-4 py-2.5 rounded-lg text-sm font-medium border border-purple-600 text-purple-600 hover:bg-purple-50 disabled:opacity-50 transition-colors">
                      {loadingDesignPrompt && designPromptLang === 'en' ? 'Generating...' : 'English Prompt'}
                    </button>
                  </div>
                </div>
                {designPrompt && (
                  <div className="mt-3">
                    <div className="bg-surface-secondary rounded-xl p-4 max-h-40 overflow-y-auto">
                      <pre className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-sans">{designPrompt}</pre>
                    </div>
                    <button onClick={onCopyDesignPrompt} className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-foreground text-white hover:bg-primary transition-colors">
                      {copiedDesignPrompt ? '복사 완료!' : '클립보드에 복사'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isProposal && (
              <div className="border-t border-border px-4 py-4 shrink-0 sm:px-6 sm:py-5">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-3.5">
                    <span className="text-sm font-medium text-foreground">AI 컨텍스트 다운로드</span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-gradient-to-r from-[#34c759] to-[#30d158] text-white font-medium">ChatGPT / Gemini / Claude</span>
                  </div>
                  <p className="text-xs text-foreground-secondary">다른 AI 도구에서 활용할 수 있는 컨텍스트 파일을 다운로드합니다.</p>
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={() => onDownloadAiContext(viewDoc.id, 'ko')} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-success text-success hover:bg-success/5 transition-colors">
                      국문 다운로드
                    </button>
                    <button onClick={() => onDownloadAiContext(viewDoc.id, 'en')} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-success text-success hover:bg-success/5 transition-colors">
                      English Download
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex shrink-0 flex-col gap-3 border-t border-border px-4 py-4 min-w-0 sm:px-6 sm:py-4">
              <div className="flex flex-wrap gap-2.5">
                {isDraft && (
                  <button onClick={onComplete} disabled={saving} className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors whitespace-nowrap">
                    {saving ? '처리 중...' : '완료 문서로 전환'}
                  </button>
                )}
                {viewDoc.status === '완료' && (
                  <button onClick={onRevertToDraft} disabled={saving} className="px-4 py-2.5 rounded-xl border border-border text-sm text-foreground-secondary hover:bg-surface-secondary disabled:opacity-50 transition-colors whitespace-nowrap">
                    초안으로 되돌리기
                  </button>
                )}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                {isDraft && (
                  <button onClick={onSave} disabled={saving || !isEdited} className="px-4 py-2.5 rounded-xl border border-primary text-sm text-primary font-medium hover:bg-surface-secondary disabled:opacity-40 transition-colors whitespace-nowrap">
                    {saving ? '저장 중...' : '초안 저장'}
                  </button>
                )}
                <select value={downloadFormat} onChange={(e) => onChangeDownloadFormat(e.target.value)} className="px-3 py-2.5 rounded-xl border border-border text-sm text-foreground-secondary bg-white">
                  {downloadFormatOptions.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
                </select>
                <select value={selectedFont} onChange={(e) => onChangeSelectedFont(e.target.value)} className="px-3 py-2.5 rounded-xl border border-border text-sm text-foreground-secondary bg-white max-w-[120px]">
                  {fontOptions.map((font) => <option key={font} value={font}>{font}</option>)}
                </select>
                <button onClick={() => onOpenContractRisk(viewDoc)} className="px-4 py-2.5 rounded-xl border border-danger/30 text-sm text-danger font-medium hover:bg-danger/5 transition-colors whitespace-nowrap">
                  계약 리스크 검토
                </button>
                <button onClick={() => onDownload(viewDoc)} className="px-4 py-2.5 rounded-xl border border-border text-sm text-foreground-secondary hover:bg-surface-secondary transition-colors whitespace-nowrap">
                  다운로드
                </button>
                <button onClick={() => onOpenQualityCheck(viewDoc.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary text-sm text-primary font-medium hover:bg-primary-tint transition-colors whitespace-nowrap">
                  AI 검수 시작
                </button>
                {(viewDoc.title.includes('회의록') || viewDoc.title.includes('회의')) && (
                  <button onClick={onOpenTodoExtract} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-500 text-sm text-purple-500 font-medium hover:bg-purple-50 transition-colors whitespace-nowrap">
                    할일 추출
                  </button>
                )}
              </div>
            </div>
          </div>

          {showViewerComments && (
            <div className="w-full max-w-none flex-shrink-0 overflow-hidden border-t border-border lg:max-w-[360px] lg:border-l lg:border-t-0">
              <DocumentCommentPanel
                documentId={viewDoc.id}
                inline
                onClose={onToggleComments}
                onReflected={onCommentsReflected}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
