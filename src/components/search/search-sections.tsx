'use client';

import { PLATFORM_LABEL } from '@/lib/constants/ui';
import { FileSearchTab } from './search-file-tab';
import { FileSearch, ShieldAlert, Sparkles } from 'lucide-react';
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
  onActivateFileTab,
  onActivateAiTab,
  onOpenDocuments,
  onOpenContractRisk,
  onOpenFiles,
}: HeaderProps) {
  const searchActionCards = [
    {
      title: 'AI 검색',
      description: '저장된 문서를 다시 찾고 근거를 확인한 뒤 바로 다음 작업으로 이어갑니다.',
      icon: FileSearch,
    },
    {
      title: '문서 생성',
      description: '검색한 자료를 바탕으로 업데이트 문서와 공유용 문서를 작성합니다.',
      icon: Sparkles,
    },
    {
      title: '계약 리스크',
      description: '계약서 후보 문서면 전문 분석 화면으로 넘길 수 있습니다.',
      icon: ShieldAlert,
    },
  ];

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#e5e5e7] bg-white">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="px-4 py-5 sm:px-6 sm:py-6 xl:px-[30px] xl:py-[30px]">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0071e3]">Document Retrieval</p>
            <h1 className="text-[24px] font-bold leading-[1.25] text-[#1d1d1f] sm:text-[28px]">AI 검색</h1>
            <p className="max-w-2xl text-[15px] text-[#6e6e73]" style={{ lineHeight: '20px' }}>
              CLIO는 기업 문서를 한곳에 저장한 뒤, 공유하고, 코멘트를 반영하고,
              <br className="hidden sm:block" />
              다시 검색해 재활용하는 문서 운영 플랫폼입니다.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6e6e73]">
              <span className="rounded-full bg-[#f5f5f7] px-3 py-1 font-medium text-[#1d1d1f]">{PLATFORM_LABEL}</span>
              {query.trim() ? (
                <span className="rounded-full border border-[#d6ebff] bg-[#eef6ff] px-3 py-1 text-[#0071e3]">현재 검색어: {query.trim()}</span>
              ) : (
                <span>검색 후 바로 문서 생성이나 계약 분석으로 넘길 수 있습니다.</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {searchActionCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="rounded-2xl border border-[#e5e5e7] bg-[#f5f5f7] p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#0071e3] shadow-sm">
                      <Icon size={18} />
                    </div>
                    <p className="mt-3 text-[13px] font-semibold text-[#1d1d1f]">{card.title}</p>
                    <p className="mt-2 text-[12px] leading-5 text-[#6e6e73]">{card.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-[#e5e5e7] bg-[#fbfbfc] px-4 py-5 sm:px-6 sm:py-6 xl:border-l xl:border-t-0 xl:px-[28px] xl:py-[28px]">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6e6e73]">Recommended Flow</p>
            <h2 className="text-[18px] font-semibold text-[#1d1d1f]">검색 후 이어지는 문서 운영</h2>
            <div className="flex flex-col" style={{ gap: 12 }}>
              <button onClick={onActivateFileTab} className="rounded-2xl border border-[#e5e5e7] bg-white p-4 text-left transition-colors hover:border-[#0071e3]/40">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p className="text-[14px] font-semibold text-[#1d1d1f]">1. 문서와 근거를 찾습니다</p>
                  <p className="text-[12px] leading-5 text-[#6e6e73]">검색 결과와 AI 요약으로 필요한 문서와 공유 맥락을 추립니다.</p>
                </div>
              </button>
              <button onClick={onActivateAiTab} className="rounded-2xl border border-[#e5e5e7] bg-white p-4 text-left transition-colors hover:border-[#0071e3]/40">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p className="text-[14px] font-semibold text-[#1d1d1f]">2. AI에게 바로 묻습니다</p>
                  <p className="text-[12px] leading-5 text-[#6e6e73]">검색 결과를 바탕으로 핵심 내용을 질문하고 답을 받습니다.</p>
                </div>
              </button>
              <div className="rounded-2xl border border-[#e5e5e7] bg-white p-4">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p className="text-[14px] font-semibold text-[#1d1d1f]">3. 다음 작업으로 넘깁니다</p>
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={onOpenDocuments} className="rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-[12px] font-medium text-white transition-colors hover:bg-[#0071e3]">문서 생성</button>
                    <button onClick={onOpenContractRisk} className="rounded-xl border border-[#f59e0b] px-4 py-2.5 text-[12px] font-medium text-[#f59e0b] transition-colors hover:bg-amber-50">계약 분석</button>
                    <button onClick={onOpenFiles} className="rounded-xl border border-[#e5e5e7] px-4 py-2.5 text-[12px] font-medium text-[#6e6e73] transition-colors hover:bg-[#f5f5f7]">문서허브</button>
                  </div>
                </div>
              </div>
            </div>
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
    <div className="flex w-fit gap-1.5 rounded-xl bg-[#f5f5f7] p-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex flex-col items-start rounded-lg px-5 py-3 text-left transition-all ${
            activeTab === tab.id ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
          }`}
        >
          <span className={`text-[13px] font-semibold ${activeTab === tab.id ? 'text-[#0071e3]' : ''}`}>{tab.label}</span>
          <span className="mt-0.5 text-[11px] text-[#a1a1a6]">{tab.desc}</span>
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
    <div className="flex h-[calc(100vh-260px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-[#e5e5e7] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e5e5e7] bg-[#f5f5f7] px-4 py-4 shrink-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0071e3]">
            <SparkleSmallIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1d1d1f]">AI 문서 질의응답</p>
            <p className="text-xs text-[#6e6e73]">업로드된 파일 기반으로 답변합니다</p>
          </div>
        </div>
        {chatMessages.length > 0 ? (
          <button onClick={onResetChat} className="w-full rounded-lg px-3.5 py-2 text-xs text-[#6e6e73] transition-colors hover:bg-white hover:text-[#1d1d1f] sm:w-auto">
            대화 초기화
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {chatMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <SparkleLargeIcon />
            <div>
              <p className="text-sm font-semibold text-[#1d1d1f]">문서에 대해 무엇이든 물어보세요</p>
              <p className="mt-1 text-xs text-[#6e6e73]">파일 탭에서 검색 후 질문하면 더 정확한 답변을 드립니다</p>
            </div>
            <div className="mt-2 flex w-full max-w-sm flex-col gap-2">
              {[
                '3월에 체결한 계약서의 납기일이 언제인가요?',
                '가장 최근 회의록의 주요 결정 사항은?',
                '계약 금액이 1억 이상인 파일을 찾아줘',
              ].map((example) => (
                <button key={example} onClick={() => onChatInputChange(example)} className="rounded-xl bg-[#f0f7ff] px-4 py-2.5 text-left text-xs text-[#0071e3] transition-colors hover:bg-[#e0f0ff]">
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {chatMessages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'assistant' ? (
              <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0071e3]">
                <SparkleSmallIcon />
              </div>
            ) : null}
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
                message.role === 'user' ? 'rounded-tr-sm bg-[#0071e3] text-white' : 'rounded-tl-sm bg-[#f5f5f7] text-[#1d1d1f]'
              }`}
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {message.content}
            </div>
          </div>
        ))}

        {chatLoading ? (
          <div className="flex items-center justify-start gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0071e3]">
              <SparkleSmallIcon />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-[#f5f5f7] px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#6e6e73]" style={{ animationDelay: '0ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#6e6e73]" style={{ animationDelay: '150ms' }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#6e6e73]" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : null}
        <div ref={chatEndRef} />
      </div>

      <div className="flex flex-col gap-2 border-t border-[#e5e5e7] bg-white px-4 py-4 shrink-0 sm:flex-row sm:px-5">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSendChat()}
          placeholder="질문을 입력하세요... (Enter로 전송)"
          disabled={chatLoading}
          className="flex-1 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 py-3 text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#0071e3] disabled:opacity-50"
        />
        <button onClick={onSendChat} disabled={chatLoading || !chatInput.trim()} className="h-11 w-full shrink-0 rounded-xl bg-[#0071e3] text-white transition-colors hover:bg-[#005bbf] disabled:opacity-40 sm:w-11 sm:self-end">
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
        <div className="flex items-center justify-between border-b border-[#e5e5e7] px-8 py-6 shrink-0">
          <h2 className="truncate text-lg font-semibold text-[#1d1d1f]">{previewLoading ? '불러오는 중...' : previewData?.name}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-[#6e6e73] hover:bg-[#f5f5f7]">
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {previewLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0071e3] border-t-transparent" />
            </div>
          ) : (
            <>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#1d1d1f]">{previewData?.text}</pre>
              {previewData?.truncated ? <p className="mt-4 text-xs text-[#6e6e73]">* 전체 {previewData.totalLength?.toLocaleString()}자 중 10,000자까지 표시됩니다.</p> : null}
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
  return <svg className="h-12 w-12 text-[#0071e3] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>;
}

function SendIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" /></svg>;
}

function CloseIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}
