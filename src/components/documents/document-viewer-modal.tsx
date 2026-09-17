import { useState } from 'react';
import { DocumentCommentPanel } from '@/components/documents/DocumentCommentPanel';
import { HtmlPreviewFrame } from '@/components/documents/html-preview-frame';
import type { DocumentItem } from '@/components/documents/page-types';
import { renderProposalDocumentHtml } from '@/lib/templates/proposal-render';
import { useServerRenderedPreview } from '@/components/documents/use-server-rendered-preview';
import { DocumentMarkdownBody } from '@/components/documents/document-markdown-body';

const EMBEDDED_INPUTS_RE = /^<!--(?:PROPOSAL_INPUTS|DOCUMENT_INPUTS):/;

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
  onCommentsReflected,
}: DocumentViewerModalProps) {
  const [proposalViewMode, setProposalViewMode] = useState<'preview' | 'edit'>('preview');
  // 제안서를 제외한 템플릿 문서(품의서 등)는 서버 렌더 HTML 프리뷰 사용
  const serverPreview = useServerRenderedPreview(viewDoc, selectedFont);

  if (!viewDoc) return null;

  void onReuseDocument;
  void onSearchRelated;
  void onOpenMemo;

  const isProposal = viewDoc.template === '제안서';
  // 커스텀 DB 템플릿(templateId 보유): 번들이 DB에 있어 서버 렌더 HTML 프리뷰 사용
  const isServerTemplate = !isProposal && !!viewDoc.templateId;
  // 빌트인 템플릿(품의서·재직증명서·휴가원 등)은 template_id 없이 저장되고 본문 앞에
  // <!--DOCUMENT_INPUTS--> 주석이 붙는다. 주석을 걷어낸 마크다운 본문을 렌더한다.
  const hasEmbeddedInputs = EMBEDDED_INPUTS_RE.test(viewDoc.content ?? '');
  const isMarkdownTemplate = !isProposal && !isServerTemplate && hasEmbeddedInputs;
  // iframe(HTML) 프리뷰 = 제안서(클라 렌더) + 서버 템플릿
  const useHtmlPreview = isProposal || isServerTemplate;
  const availableDownloadFormats = isProposal ? ['pdf'] : downloadFormatOptions;
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
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              {useHtmlPreview ? (
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
                    isProposal ? (
                      <HtmlPreviewFrame
                        title="proposal-preview"
                        html={proposalHtml}
                        className="h-full min-h-[640px] w-full rounded-xl border border-border bg-white"
                      />
                    ) : serverPreview.loading ? (
                      <div className="flex h-full min-h-[640px] w-full items-center justify-center rounded-xl border border-border bg-white text-sm text-foreground-secondary">
                        레이아웃을 불러오는 중입니다…
                      </div>
                    ) : serverPreview.error || !serverPreview.html ? (
                      <div className="flex h-full min-h-[640px] w-full items-center justify-center rounded-xl border border-border bg-white text-sm text-foreground-secondary">
                        레이아웃 미리보기를 불러오지 못했습니다. 원문 편집 또는 다운로드로 확인해 주세요.
                      </div>
                    ) : (
                      <HtmlPreviewFrame
                        title="document-preview"
                        html={serverPreview.html}
                        className="h-full min-h-[640px] w-full rounded-xl border border-border bg-white"
                      />
                    )
                  ) : (
                    <div className="flex h-full min-h-[400px] flex-col gap-2">
                      {isServerTemplate && isEdited && (
                        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                          편집한 내용은 <strong>초안 저장</strong> 후 레이아웃 보기에 반영됩니다.
                        </p>
                      )}
                      <textarea
                        value={editContent}
                        onChange={(e) => onChangeContent(e.target.value)}
                        className="w-full h-full min-h-[360px] text-sm text-foreground leading-relaxed bg-transparent resize-none focus:outline-none font-mono"
                        placeholder="문서 내용을 편집하세요..."
                      />
                    </div>
                  )}
                </div>
              ) : isMarkdownTemplate ? (
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
                    <div className="h-full min-h-[400px] overflow-y-auto rounded-xl border border-border bg-white px-5 py-4">
                      <DocumentMarkdownBody content={isDraft ? editContent : viewDoc.content ?? ''} />
                    </div>
                  ) : (
                    <textarea
                      value={editContent}
                      onChange={(e) => onChangeContent(e.target.value)}
                      className="w-full h-full min-h-[360px] text-sm text-foreground leading-relaxed bg-transparent resize-none focus:outline-none font-mono"
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
                <DocumentMarkdownBody content={viewDoc.content ?? ''} />
              )}
            </div>

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
                  {availableDownloadFormats.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
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
