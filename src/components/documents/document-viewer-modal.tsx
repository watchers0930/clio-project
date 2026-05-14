import { DocumentCommentPanel } from '@/components/documents/DocumentCommentPanel';
import { DocumentOpsSummary } from '@/components/documents/document-ops-summary';
import type { DocumentItem } from '@/components/documents/page-types';

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
  if (!viewDoc) return null;

  const isProposal = viewDoc.template === '제안서';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="view-doc-title">
      <div className={`flex max-h-[100dvh] w-full flex-col bg-white shadow-xl transition-all duration-300 sm:mx-4 sm:max-h-[90vh] sm:rounded-2xl ${showViewerComments ? 'sm:max-w-6xl' : 'sm:max-w-4xl'}`}>
        <div className="flex items-start justify-between border-b border-[#e5e5e7] px-4 py-4 shrink-0 sm:px-6 sm:py-5">
          <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isDraft ? (
              <input
                value={editTitle}
                onChange={(e) => onChangeTitle(e.target.value)}
                className="text-lg font-semibold text-[#1d1d1f] w-full bg-transparent border-b border-transparent hover:border-[#e5e5e7] focus:border-[#0071e3] focus:outline-none pb-1 transition-colors"
              />
            ) : (
              <h2 id="view-doc-title" className="text-lg font-semibold text-[#1d1d1f] truncate">{viewDoc.title}</h2>
            )}
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[viewDoc.status]}`}>{viewDoc.status}</span>
              <span className="text-xs text-[#6e6e73]">{viewDoc.createdAt}</span>
              {isEdited && <span className="text-xs text-[#ff9f0a] font-medium">수정됨</span>}
            </div>
          </div>
          <div className="ml-3 flex items-center gap-2">
            <button
              onClick={() => onOpenShare(viewDoc)}
              className="hidden rounded-lg border border-[#e5e5e7] px-3.5 py-2.5 text-[12px] font-medium text-[#6e6e73] transition-colors hover:bg-[#f5f5f7] md:inline-flex"
            >
              공유
            </button>
            <button
              onClick={() => onOpenVersions(viewDoc.id)}
              className="hidden rounded-lg border border-[#e5e5e7] px-3.5 py-2.5 text-[12px] font-medium text-[#6e6e73] transition-colors hover:bg-[#f5f5f7] md:inline-flex"
            >
              버전
            </button>
            <button
              onClick={onToggleComments}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[12px] font-medium transition-colors ${
                showViewerComments
                  ? 'bg-[#2E6FF2] text-white'
                  : 'border border-[#e5e5e7] text-[#6e6e73] hover:bg-[#f5f5f7]'
              }`}
              title="댓글"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="hidden sm:inline">댓글</span>
            </button>
            <button onClick={onRequestClose} className="p-2 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="border-b border-[#e5e5e7] bg-[#fbfbfc] px-4 py-3 shrink-0 sm:px-6 sm:py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8494]">Workflow</span>
                <span className="text-[12px] text-[#1B1F2B]">
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
              {isDraft ? (
                <textarea
                  value={editContent}
                  onChange={(e) => onChangeContent(e.target.value)}
                  className="w-full h-full min-h-[400px] text-sm text-[#1d1d1f] leading-relaxed bg-transparent resize-none focus:outline-none font-mono"
                  placeholder="문서 내용을 편집하세요..."
                />
              ) : (
                <div className="prose prose-sm max-w-none">
                  {(viewDoc.content ?? '문서 내용이 없습니다.').split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-[#1d1d1f] mt-4 mb-2">{line.replace('## ', '')}</h2>;
                    if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-[#1d1d1f] mt-4 mb-2">{line.replace('# ', '')}</h1>;
                    if (line.startsWith('- ')) return <li key={i} className="text-sm text-[#1d1d1f] ml-4">{line.replace('- ', '')}</li>;
                    if (line.startsWith('*')) return <p key={i} className="text-sm text-[#6e6e73] italic">{line.replace(/\*/g, '')}</p>;
                    if (line.trim() === '---') return <hr key={i} className="my-3 border-[#e5e5e7]" />;
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="text-sm text-[#1d1d1f] leading-relaxed">{line}</p>;
                  })}
                </div>
              )}
            </div>

            {isProposal && (
              <div className="border-t border-[#e5e5e7] px-4 py-4 shrink-0 sm:px-6 sm:py-5">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="flex items-center gap-3.5">
                    <span className="text-sm font-medium text-[#1d1d1f]">AI 디자인 프롬프트</span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-gradient-to-r from-[#0071e3] to-[#5856d6] text-white font-medium">GenSpark / Gamma / Canva</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={() => onGenerateDesignPrompt('ko')} disabled={loadingDesignPrompt} className="px-4 py-2.5 rounded-lg text-sm font-medium border border-[#0071e3] text-[#0071e3] hover:bg-[#f0f5ff] disabled:opacity-50 transition-colors">
                      {loadingDesignPrompt && designPromptLang === 'ko' ? '생성 중...' : '국문 프롬프트'}
                    </button>
                    <button onClick={() => onGenerateDesignPrompt('en')} disabled={loadingDesignPrompt} className="px-4 py-2.5 rounded-lg text-sm font-medium border border-[#5856d6] text-[#5856d6] hover:bg-[#f5f0ff] disabled:opacity-50 transition-colors">
                      {loadingDesignPrompt && designPromptLang === 'en' ? 'Generating...' : 'English Prompt'}
                    </button>
                  </div>
                </div>
                {designPrompt && (
                  <div className="mt-3">
                    <div className="bg-[#f5f5f7] rounded-xl p-4 max-h-40 overflow-y-auto">
                      <pre className="text-xs text-[#1d1d1f] whitespace-pre-wrap leading-relaxed font-sans">{designPrompt}</pre>
                    </div>
                    <button onClick={onCopyDesignPrompt} className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#1d1d1f] text-white hover:bg-[#0071e3] transition-colors">
                      {copiedDesignPrompt ? '복사 완료!' : '클립보드에 복사'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isProposal && (
              <div className="border-t border-[#e5e5e7] px-4 py-4 shrink-0 sm:px-6 sm:py-5">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="flex items-center gap-3.5">
                    <span className="text-sm font-medium text-[#1d1d1f]">AI 컨텍스트 다운로드</span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-gradient-to-r from-[#34c759] to-[#30d158] text-white font-medium">ChatGPT / Gemini / Claude</span>
                  </div>
                  <p className="text-xs text-[#6e6e73]">다른 AI 도구에서 활용할 수 있는 컨텍스트 파일을 다운로드합니다.</p>
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={() => onDownloadAiContext(viewDoc.id, 'ko')} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-[#34c759] text-[#34c759] hover:bg-[#f0faf2] transition-colors">
                      국문 다운로드
                    </button>
                    <button onClick={() => onDownloadAiContext(viewDoc.id, 'en')} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-[#30d158] text-[#30d158] hover:bg-[#f0faf2] transition-colors">
                      English Download
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex shrink-0 flex-col gap-3 border-t border-[#e5e5e7] px-4 py-4 min-w-0 sm:px-6 sm:py-4">
              <div className="flex flex-wrap gap-2.5">
                {isDraft && (
                  <button onClick={onComplete} disabled={saving} className="px-4 py-2.5 rounded-xl bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0066cc] disabled:opacity-50 transition-colors whitespace-nowrap">
                    {saving ? '처리 중...' : '완료 문서로 전환'}
                  </button>
                )}
                {viewDoc.status === '완료' && (
                  <button onClick={onRevertToDraft} disabled={saving} className="px-4 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] disabled:opacity-50 transition-colors whitespace-nowrap">
                    초안으로 되돌리기
                  </button>
                )}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                {isDraft && (
                  <button onClick={onSave} disabled={saving || !isEdited} className="px-4 py-2.5 rounded-xl border border-[#0071e3] text-sm text-[#0071e3] font-medium hover:bg-[#f5f5f7] disabled:opacity-40 transition-colors whitespace-nowrap">
                    {saving ? '저장 중...' : '초안 저장'}
                  </button>
                )}
                <select value={downloadFormat} onChange={(e) => onChangeDownloadFormat(e.target.value)} className="px-3 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] bg-white">
                  {downloadFormatOptions.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
                </select>
                <select value={selectedFont} onChange={(e) => onChangeSelectedFont(e.target.value)} className="px-3 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] bg-white max-w-[120px]">
                  {fontOptions.map((font) => <option key={font} value={font}>{font}</option>)}
                </select>
                <button onClick={() => onOpenContractRisk(viewDoc)} className="px-4 py-2.5 rounded-xl border border-[#FDE4E4] text-sm text-[#C24141] font-medium hover:bg-[#FFF5F5] transition-colors whitespace-nowrap">
                  계약 리스크 검토
                </button>
                <button onClick={() => onDownload(viewDoc)} className="px-4 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors whitespace-nowrap">
                  다운로드
                </button>
                <button onClick={() => onOpenQualityCheck(viewDoc.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#0071e3] text-sm text-[#0071e3] font-medium hover:bg-[#f0f5ff] transition-colors whitespace-nowrap">
                  AI 검수 시작
                </button>
                {(viewDoc.title.includes('회의록') || viewDoc.title.includes('회의')) && (
                  <button onClick={onOpenTodoExtract} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#7B61FF] text-sm text-[#7B61FF] font-medium hover:bg-[#F3F0FF] transition-colors whitespace-nowrap">
                    할일 추출
                  </button>
                )}
              </div>
            </div>
          </div>

          {showViewerComments && (
            <div className="w-full max-w-none flex-shrink-0 overflow-hidden border-t border-[#e5e5e7] lg:max-w-[360px] lg:border-l lg:border-t-0">
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
