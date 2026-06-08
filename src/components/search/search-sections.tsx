'use client';

import { FileSearchTab } from './search-file-tab';
import type { ChatMessage, SearchTab } from './types';

interface HeaderProps {
  query: string;
  onActivateFileTab: () => void;
  onActivateAiTab: () => void;
  onOpenDocuments: () => void;
  onOpenContractRisk: () => void;
  onOpenFiles: () => void;
}

interface TabsProps {
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
}

interface AiTabProps {
  chatMessages: ChatMessage[];
  chatInput: string;
  chatLoading: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onChatInputChange: (value: string) => void;
  onSendChat: () => void;
  onResetChat: () => void;
}

export function SearchHeader({
  query,
  onOpenDocuments,
  onOpenContractRisk,
  onOpenFiles,
}: HeaderProps) {
  return (
    <section className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-4 px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[20px] font-bold text-foreground">AI 검색</h1>
            <p className="mt-1.5 text-[13px] text-foreground-secondary">
              저장된 문서를 검색하고, 문서 생성이나 계약 분석으로 바로 이어갑니다.
              {query.trim() && (
                <span className="ml-2 inline-flex rounded-full border border-primary/30 bg-primary-tint px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  {query.trim()}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onOpenDocuments} className="h-9 rounded-xl bg-foreground px-4 text-[13px] font-medium text-white transition-colors hover:bg-primary">문서 생성</button>
            <button onClick={onOpenContractRisk} className="h-9 rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary">계약 분석</button>
            <button onClick={onOpenFiles} className="h-9 rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary">문서허브</button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SearchTabs({ activeTab, onTabChange }: TabsProps) {
  const tabs: { id: SearchTab; label: string; desc: string }[] = [
    { id: 'file', label: '파일 검색', desc: '파일명 · 내용으로 검색' },
    { id: 'ai', label: 'AI에게 묻기', desc: '자연어로 질문하기' },
  ];

  return (
    <div className="flex w-fit gap-1.5 rounded-xl bg-surface-secondary p-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex flex-col items-start rounded-lg px-5 py-3 text-left transition-all ${
            activeTab === tab.id ? 'bg-white text-foreground shadow-sm' : 'text-foreground-secondary hover:text-foreground'
          }`}
        >
          <span className={`text-[13px] font-semibold ${activeTab === tab.id ? 'text-primary' : ''}`}>{tab.label}</span>
          <span className="mt-0.5 text-[11px] text-foreground-quaternary">{tab.desc}</span>
        </button>
      ))}
    </div>
  );
}

export { FileSearchTab };

export function AiSearchTab({
  chatMessages,
  chatInput,
  chatLoading,
  chatEndRef,
  onChatInputChange,
  onSendChat,
  onResetChat,
}: AiTabProps) {
  return (
    <div className="flex h-[calc(100vh-260px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-white">
      <div className="flex flex-col gap-3 border-b border-border bg-surface-secondary px-4 py-4 shrink-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <SparkleSmallIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">AI 문서 질의응답</p>
            <p className="text-xs text-foreground-secondary">업로드된 파일 기반으로 답변합니다</p>
          </div>
        </div>
        {chatMessages.length > 0 ? (
          <button onClick={onResetChat} className="w-full rounded-lg px-3.5 py-2 text-xs text-foreground-secondary transition-colors hover:bg-white hover:text-foreground sm:w-auto">
            대화 초기화
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {chatMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <SparkleLargeIcon />
            <div>
              <p className="text-sm font-semibold text-foreground">문서에 대해 무엇이든 물어보세요</p>
              <p className="mt-1 text-xs text-foreground-secondary">파일 탭에서 검색 후 질문하면 더 정확한 답변을 드립니다</p>
            </div>
            <div className="mt-2 flex w-full max-w-sm flex-col gap-2">
              {[
                '3월에 체결한 계약서의 납기일이 언제인가요?',
                '가장 최근 회의록의 주요 결정 사항은?',
                '계약 금액이 1억 이상인 파일을 찾아줘',
              ].map((example) => (
                <button key={example} onClick={() => onChatInputChange(example)} className="rounded-xl bg-primary-tint px-4 py-2.5 text-left text-xs text-primary transition-colors hover:bg-primary-tint">
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {chatMessages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'assistant' ? (
              <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                <SparkleSmallIcon />
              </div>
            ) : null}
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
                message.role === 'user' ? 'rounded-tr-sm bg-primary text-white' : 'rounded-tl-sm bg-surface-secondary text-foreground'
              }`}
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {message.content}
            </div>
          </div>
        ))}

        {chatLoading ? (
          <div className="flex items-center justify-start gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
              <SparkleSmallIcon />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-surface-secondary px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-foreground-secondary" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-foreground-secondary" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-foreground-secondary" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : null}
        <div ref={chatEndRef} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border bg-white px-4 py-4 shrink-0 sm:flex-row sm:px-5">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSendChat()}
          placeholder="질문을 입력하세요... (Enter로 전송)"
          disabled={chatLoading}
          className="flex-1 rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
        <button onClick={onSendChat} disabled={chatLoading || !chatInput.trim()} className="h-11 w-full shrink-0 rounded-xl bg-primary text-white transition-colors hover:bg-primary-dark disabled:opacity-40 sm:w-11 sm:self-end">
          <div className="flex items-center justify-center">
            <SendIcon />
          </div>
        </button>
      </div>
    </div>
  );
}

export function SearchPreviewModal({ previewData, previewLoading, onClose }: { previewData: { name: string; text: string; truncated?: boolean; totalLength?: number } | null; previewLoading: boolean; onClose: () => void }) {
  if (!previewData && !previewLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-8 py-6 shrink-0">
          <h2 className="truncate text-lg font-semibold text-foreground">{previewLoading ? '불러오는 중...' : previewData?.name}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-foreground-secondary hover:bg-surface-secondary">
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {previewLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">{previewData?.text}</pre>
              {previewData?.truncated ? <p className="mt-4 text-xs text-foreground-secondary">* 전체 {previewData.totalLength?.toLocaleString()}자 중 10,000자까지 표시됩니다.</p> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SparkleSmallIcon() {
  return <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>;
}

function SparkleLargeIcon() {
  return <svg className="h-12 w-12 text-primary opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>;
}

function SendIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" /></svg>;
}

function CloseIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}
