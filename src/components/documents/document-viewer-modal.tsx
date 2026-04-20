import { DocumentCommentPanel } from '@/components/documents/DocumentCommentPanel';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="view-doc-title">
      <div className={`bg-white rounded-2xl shadow-xl w-full mx-4 max-h-[90vh] flex flex-col transition-all duration-300 ${showViewerComments ? 'max-w-6xl' : 'max-w-4xl'}`}>
        <div className="px-6 py-5 border-b border-[#e5e5e7] flex items-center justify-between shrink-0">
          <div className="flex-1 min-w-0">
            {isDraft ? (
              <input
                value={editTitle}
                onChange={(e) => onChangeTitle(e.target.value)}
                className="text-lg font-semibold text-[#1d1d1f] w-full bg-transparent border-b border-transparent hover:border-[#e5e5e7] focus:border-[#0071e3] focus:outline-none pb-1 transition-colors"
              />
            ) : (
              <h2 id="view-doc-title" className="text-lg font-semibold text-[#1d1d1f] truncate">{viewDoc.title}</h2>
            )}
            <div className="flex gap-2 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[viewDoc.status]}`}>{viewDoc.status}</span>
              <span className="text-xs text-[#6e6e73]">{viewDoc.createdAt}</span>
              {isEdited && <span className="text-xs text-[#ff9f0a] font-medium">수정됨</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-3">
            <button
              onClick={onToggleComments}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                showViewerComments
                  ? 'bg-[#2E6FF2] text-white'
                  : 'border border-[#e5e5e7] text-[#6e6e73] hover:bg-[#f5f5f7]'
              }`}
              title="댓글"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              댓글
            </button>
            <button onClick={onRequestClose} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto px-6 py-5">
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
              <div className="px-6 py-5 border-t border-[#e5e5e7] shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-medium text-[#1d1d1f]">AI 디자인 프롬프트</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[#0071e3] to-[#5856d6] text-white font-medium">GenSpark / Gamma / Canva</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onGenerateDesignPrompt('ko')} disabled={loadingDesignPrompt} className="px-4 py-2 rounded-lg text-sm font-medium border border-[#0071e3] text-[#0071e3] hover:bg-[#f0f5ff] disabled:opacity-50 transition-colors">
                    {loadingDesignPrompt && designPromptLang === 'ko' ? '생성 중...' : '국문 프롬프트'}
                  </button>
                  <button onClick={() => onGenerateDesignPrompt('en')} disabled={loadingDesignPrompt} className="px-4 py-2 rounded-lg text-sm font-medium border border-[#5856d6] text-[#5856d6] hover:bg-[#f5f0ff] disabled:opacity-50 transition-colors">
                    {loadingDesignPrompt && designPromptLang === 'en' ? 'Generating...' : 'English Prompt'}
                  </button>
                </div>
                {designPrompt && (
                  <div className="mt-3">
                    <div className="bg-[#f5f5f7] rounded-xl p-4 max-h-40 overflow-y-auto">
                      <pre className="text-xs text-[#1d1d1f] whitespace-pre-wrap leading-relaxed font-sans">{designPrompt}</pre>
                    </div>
                    <button onClick={onCopyDesignPrompt} className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#1d1d1f] text-white hover:bg-[#0071e3] transition-colors flex items-center gap-2">
                      {copiedDesignPrompt ? '복사 완료!' : '클립보드에 복사'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isProposal && (
              <div className="px-6 py-5 border-t border-[#e5e5e7] shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-medium text-[#1d1d1f]">AI 컨텍스트 다운로드</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[#34c759] to-[#30d158] text-white font-medium">ChatGPT / Gemini / Claude</span>
                </div>
                <p className="text-xs text-[#6e6e73] mb-3">다른 AI 도구에서 활용할 수 있는 컨텍스트 파일을 다운로드합니다.</p>
                <div className="flex gap-2">
                  <button onClick={() => onDownloadAiContext(viewDoc.id, 'ko')} className="px-4 py-2 rounded-lg text-sm font-medium border border-[#34c759] text-[#34c759] hover:bg-[#f0faf2] transition-colors flex items-center gap-2">
                    국문 다운로드
                  </button>
                  <button onClick={() => onDownloadAiContext(viewDoc.id, 'en')} className="px-4 py-2 rounded-lg text-sm font-medium border border-[#30d158] text-[#30d158] hover:bg-[#f0faf2] transition-colors flex items-center gap-2">
                    English Download
                  </button>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-[#e5e5e7] flex items-center justify-between shrink-0 gap-2 min-w-0">
              <div className="flex gap-2 shrink-0">
                {isDraft && (
                  <button onClick={onComplete} disabled={saving} className="px-4 py-2 rounded-xl bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0066cc] disabled:opacity-50 transition-colors whitespace-nowrap">
                    {saving ? '처리 중...' : '완료'}
                  </button>
                )}
                {viewDoc.status === '완료' && (
                  <button onClick={onRevertToDraft} disabled={saving} className="px-4 py-2 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] disabled:opacity-50 transition-colors whitespace-nowrap">
                    초안으로 되돌리기
                  </button>
                )}
              </div>
              <div className="flex gap-2 items-center min-w-0 flex-wrap justify-end">
                {isDraft && (
                  <button onClick={onSave} disabled={saving || !isEdited} className="px-4 py-2 rounded-xl border border-[#0071e3] text-sm text-[#0071e3] font-medium hover:bg-[#f5f5f7] disabled:opacity-40 transition-colors whitespace-nowrap">
                    {saving ? '저장 중...' : '저장'}
                  </button>
                )}
                <select value={downloadFormat} onChange={(e) => onChangeDownloadFormat(e.target.value)} className="px-2 py-2 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] bg-white">
                  {downloadFormatOptions.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
                </select>
                <select value={selectedFont} onChange={(e) => onChangeSelectedFont(e.target.value)} className="px-2 py-2 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] bg-white max-w-[110px]">
                  {fontOptions.map((font) => <option key={font} value={font}>{font}</option>)}
                </select>
                <button onClick={() => onDownload(viewDoc)} className="px-4 py-2 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors whitespace-nowrap">
                  다운로드
                </button>
                <button onClick={() => onOpenQualityCheck(viewDoc.id)} className="px-4 py-2 rounded-xl border border-[#0071e3] text-sm text-[#0071e3] font-medium hover:bg-[#f0f5ff] transition-colors flex items-center gap-1.5 whitespace-nowrap">
                  AI 검수
                </button>
                {(viewDoc.title.includes('회의록') || viewDoc.title.includes('회의')) && (
                  <button onClick={onOpenTodoExtract} className="px-4 py-2 rounded-xl border border-[#7B61FF] text-sm text-[#7B61FF] font-medium hover:bg-[#F3F0FF] transition-colors flex items-center gap-1.5 whitespace-nowrap">
                    할일 추출
                  </button>
                )}
              </div>
            </div>
          </div>

          {showViewerComments && (
            <div className="w-[320px] flex-shrink-0 overflow-hidden rounded-br-2xl">
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
