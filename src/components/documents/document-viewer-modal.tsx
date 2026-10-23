import { useState } from 'react';
import { DocumentCommentPanel } from '@/components/documents/DocumentCommentPanel';
import { HtmlPreviewFrame } from '@/components/documents/html-preview-frame';
import type { DocumentItem } from '@/components/documents/page-types';
import { renderProposalDocumentHtml } from '@/lib/templates/proposal-render';
import { useServerRenderedPreview, BUILTIN_FORM_TITLE_RE } from '@/components/documents/use-server-rendered-preview';
import { DocumentMarkdownBody } from '@/components/documents/document-markdown-body';
import { stripEmbeddedInputs, getEmbeddedInputsPrefix } from '@/lib/documents/embedded-inputs';
import { resolveDocumentInputForm } from '@/lib/documents/resolve-input-form';
import { DocumentInputEditor, getInputEditorAvailability, getInputValidationState } from '@/components/documents/document-input-editor';
import { DocumentViewerFooter } from '@/components/documents/document-viewer-footer';

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
  onSaveInputs: () => Promise<boolean> | void;
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
  onSaveInputs,
  onComplete,
  onRevertToDraft,
  onChangeDownloadFormat,
  onChangeSelectedFont,
  onDownload,
  onOpenQualityCheck,
  onOpenTodoExtract,
  onCommentsReflected,
}: DocumentViewerModalProps) {
  // preview = 레이아웃 보기 / edit = 원문 편집 / inputs = 입력값 편집(공용 폼)
  const [viewMode, setViewMode] = useState<'preview' | 'edit' | 'inputs'>('preview');
  const [lastDocId, setLastDocId] = useState<string | null>(viewDoc?.id ?? null);
  // 제안서를 제외한 템플릿 문서(품의서 등)는 서버 렌더 HTML 프리뷰 사용
  const serverPreview = useServerRenderedPreview(viewDoc, selectedFont);

  // 문서를 열거나 다른 문서로 전환하면 항상 레이아웃 보기로 시작한다(stale 'inputs' 모드 방지).
  // React 권장 "렌더 중 상태 조정" 패턴(effect 내 동기 setState 회피).
  const docId = viewDoc?.id ?? null;
  if (docId !== lastDocId) {
    setLastDocId(docId);
    setViewMode('preview');
  }

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
  // 빌트인 양식 식별: 제목 매칭(품의서·근로계약서 등) 또는 공용 resolver(ID/메타로 복원 가능한 4양식).
  // BE inline 렌더도 같은 resolver를 우선하므로, 제목을 바꾼 재직증명서 등도 서버 렌더로 연결한다(MED#4).
  const inputFormRecoverable = resolveDocumentInputForm({
    title: viewDoc.title, templateId: viewDoc.templateId, templateName: viewDoc.template, content: viewDoc.content ?? '',
  }).ok;
  const isBuiltinForm =
    !isProposal && !isServerTemplate && hasEmbeddedInputs &&
    (BUILTIN_FORM_TITLE_RE.test(viewDoc.title ?? '') || inputFormRecoverable);
  // 커스텀 구조 마크다운(빌트인 양식이 아닌)만 마크다운으로 렌더
  const isMarkdownTemplate = !isProposal && !isServerTemplate && !isBuiltinForm && hasEmbeddedInputs;
  // iframe(HTML) 프리뷰 = 제안서(클라 렌더) + 서버 템플릿 + 빌트인 양식
  const useHtmlPreview = isProposal || isServerTemplate || isBuiltinForm;
  // 원문 편집 textarea에는 입력값 메타 주석(<!--DOCUMENT_INPUTS:...-->)을 숨겨 보여주고,
  // 편집 결과에는 주석 접두부를 다시 붙여 저장 content에 보존한다(레이아웃 복원용).
  const editDisplayContent = stripEmbeddedInputs(editContent);
  const handleEditContentChange = (value: string) =>
    onChangeContent(getEmbeddedInputsPrefix(editContent) + value);
  // 입력값 편집 가용성은 제목이 아니라 resolver 결과로 판단한다(제목 변경 문서도 복원 가능 시 편집).
  const inputEditability = isDraft
    ? getInputEditorAvailability(viewDoc, editContent)
    : { available: false, reason: '초안 상태에서만 입력값을 편집할 수 있습니다.' };
  const showInputEditButton = isDraft && (isBuiltinForm || inputEditability.available);
  // 필수값·손상 검증을 저장/완료 액션에 공유 적용(내부 입력값 저장만 막던 우회 차단, MED#3).
  const inputValidation = isDraft
    ? getInputValidationState(viewDoc, editContent)
    : { applicable: false, valid: true, missingLabels: [] as string[] };
  const inputInvalidTitle = inputValidation.valid
    ? undefined
    : `필수 입력값을 완성해야 합니다: ${inputValidation.missingLabels.join(', ')}`;
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setViewMode('preview')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          viewMode === 'preview'
                            ? 'bg-foreground text-white'
                            : 'border border-border text-foreground-secondary hover:bg-surface-secondary'
                        }`}
                      >
                        레이아웃 보기
                      </button>
                      {showInputEditButton && (
                        <button
                          onClick={() => inputEditability.available && setViewMode('inputs')}
                          disabled={!inputEditability.available}
                          aria-disabled={!inputEditability.available}
                          title={inputEditability.available ? undefined : inputEditability.reason}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            viewMode === 'inputs'
                              ? 'bg-foreground text-white'
                              : 'border border-border text-foreground-secondary hover:bg-surface-secondary'
                          }`}
                        >
                          입력값 편집
                        </button>
                      )}
                      <button
                        onClick={() => setViewMode('edit')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          viewMode === 'edit'
                            ? 'bg-foreground text-white'
                            : 'border border-border text-foreground-secondary hover:bg-surface-secondary'
                        }`}
                      >
                        원문 편집
                      </button>
                    </div>
                  )}
                  {isDraft && viewMode === 'inputs' ? (
                    <DocumentInputEditor
                      viewDoc={viewDoc}
                      editContent={editContent}
                      saving={saving}
                      onChangeContent={onChangeContent}
                      onSaveInputs={onSaveInputs}
                    />
                  ) : !isDraft || viewMode === 'preview' ? (
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
                      <div className="flex h-full min-h-[640px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-white px-6 text-center text-sm text-foreground-secondary">
                        <p>레이아웃 미리보기를 불러오지 못했습니다. 입력값은 저장되었을 수 있습니다.</p>
                        <button
                          type="button"
                          onClick={() => serverPreview.refetch()}
                          className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-tint"
                        >
                          미리보기 다시 시도
                        </button>
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
                        value={editDisplayContent}
                        onChange={(e) => handleEditContentChange(e.target.value)}
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
                        onClick={() => setViewMode('preview')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          viewMode === 'preview'
                            ? 'bg-foreground text-white'
                            : 'border border-border text-foreground-secondary hover:bg-surface-secondary'
                        }`}
                      >
                        레이아웃 보기
                      </button>
                      <button
                        onClick={() => setViewMode('edit')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          viewMode === 'edit'
                            ? 'bg-foreground text-white'
                            : 'border border-border text-foreground-secondary hover:bg-surface-secondary'
                        }`}
                      >
                        원문 편집
                      </button>
                    </div>
                  )}
                  {!isDraft || viewMode === 'preview' ? (
                    <div className="h-full min-h-[400px] overflow-y-auto rounded-xl border border-border bg-white px-5 py-4">
                      <DocumentMarkdownBody content={isDraft ? editContent : viewDoc.content ?? ''} />
                    </div>
                  ) : (
                    <textarea
                      value={editDisplayContent}
                      onChange={(e) => handleEditContentChange(e.target.value)}
                      className="w-full h-full min-h-[360px] text-sm text-foreground leading-relaxed bg-transparent resize-none focus:outline-none font-mono"
                      placeholder="문서 내용을 편집하세요..."
                    />
                  )}
                </div>
              ) : isDraft ? (
                <textarea
                  value={editDisplayContent}
                  onChange={(e) => handleEditContentChange(e.target.value)}
                  className="w-full h-full min-h-[400px] text-sm text-foreground leading-relaxed bg-transparent resize-none focus:outline-none font-mono"
                  placeholder="문서 내용을 편집하세요..."
                />
              ) : (
                <DocumentMarkdownBody content={viewDoc.content ?? ''} />
              )}
            </div>

            <DocumentViewerFooter
              viewDoc={viewDoc}
              isDraft={isDraft}
              saving={saving}
              isEdited={isEdited}
              inputsMode={viewMode === 'inputs'}
              inputValid={inputValidation.valid}
              inputInvalidTitle={inputInvalidTitle}
              downloadFormat={downloadFormat}
              selectedFont={selectedFont}
              availableDownloadFormats={availableDownloadFormats}
              fontOptions={fontOptions}
              onComplete={onComplete}
              onRevertToDraft={onRevertToDraft}
              onSave={onSave}
              onChangeDownloadFormat={onChangeDownloadFormat}
              onChangeSelectedFont={onChangeSelectedFont}
              onOpenContractRisk={onOpenContractRisk}
              onDownload={onDownload}
              onOpenQualityCheck={onOpenQualityCheck}
              onOpenTodoExtract={onOpenTodoExtract}
            />
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
