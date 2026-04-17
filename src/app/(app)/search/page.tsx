'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { FILE_TYPE_BADGE } from '@/lib/constants/ui';
import { SearchInput, EmptyState, Spinner } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { VoiceInputButton } from '@/components/common/VoiceInputButton';

/* ────────────────────────── types ────────────────────────── */
interface SearchResult {
  id: string;
  name: string;
  excerpt: string;
  relevance: number;
  fileType: string;
  department: string;
  date: string;
  aiSummary: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type SearchTab = 'file' | 'ai';

/* ────────────────────────── constants ────────────────────── */
const FILE_TYPES = ['전체', 'PDF', 'DOCX', 'PPTX', 'XLSX', 'MD', 'M4A'];
const SORT_OPTIONS = ['관련도순', '최신순', '오래된순', '이름순'];

/* ────────────────────────── page ─────────────────────────── */
export default function SearchPage() {
  const toast = useToast();

  // 탭
  const [activeTab, setActiveTab] = useState<SearchTab>('file');

  // 파일 검색 상태
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [department, setDepartment] = useState('전체');
  const [departments, setDepartments] = useState<string[]>(['전체']);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [fileType, setFileType] = useState('전체');
  const [sort, setSort] = useState('관련도순');
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ name: string; text: string; truncated?: boolean; totalLength?: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // AI 채팅 상태
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 부서 목록 + 검색 제안어
  useEffect(() => {
    fetch('/api/departments').then(r => r.json()).then(json => {
      const names = (json.data ?? [])
        .filter((d: { is_active: boolean }) => d.is_active !== false)
        .map((d: { name: string }) => d.name);
      setDepartments(['전체', ...names]);
    }).catch(() => {});
    fetch('/api/templates').then(r => r.json()).then(json => {
      const names = (json.templates ?? []).map((t: { name: string }) => t.name);
      setSuggestions(names.length > 0 ? names : ['회의록', '보고서', '계약서', '제안서', '공문']);
    }).catch(() => {
      setSuggestions(['회의록', '보고서', '계약서', '제안서', '공문']);
    });
  }, []);

  const openPreview = async (fileId: string) => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await fetch(`/api/files/${fileId}/preview`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setPreviewData({ name: '오류', text: err?.error || '미리보기를 불러올 수 없습니다.' });
        return;
      }
      const data = await res.json();
      setPreviewData(data);
    } catch {
      setPreviewData({ name: '오류', text: '네트워크 오류가 발생했습니다.' });
    } finally {
      setPreviewLoading(false);
    }
  };

  // AI 채팅 전송
  const sendChat = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: msg };
    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setChatInput('');
    setChatLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: chatMessages,
          fileIds: results.length > 0 ? results.map((r) => r.id) : undefined,
        }),
      });
      const data = await res.json();
      setChatMessages([...nextHistory, {
        role: 'assistant',
        content: data.answer ?? data.error ?? '오류가 발생했습니다.',
      }]);
    } catch {
      setChatMessages([...nextHistory, { role: 'assistant', content: '네트워크 오류가 발생했습니다.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [chatInput, chatMessages, chatLoading, results]);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setLoading(true);
      setSearched(true);
      setExpandedSummary(null);
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, department, fileType }),
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [department, fileType],
  );

  const sortedResults = [...results].sort((a, b) => {
    switch (sort) {
      case '최신순': return b.date.localeCompare(a.date);
      case '오래된순': return a.date.localeCompare(b.date);
      case '이름순': return a.name.localeCompare(b.name);
      default: return b.relevance - a.relevance;
    }
  });

  useEffect(() => {
    if (searched && query.trim()) doSearch(query);
  }, [department, fileType]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── 탭 헤더 ─── */
  const tabs: { id: SearchTab; label: string; desc: string }[] = [
    { id: 'file', label: '파일 검색', desc: '파일명 · 내용으로 검색' },
    { id: 'ai', label: 'AI에게 묻기', desc: '자연어로 질문하기' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="pb-10">

      {/* ── 헤더 ── */}
      <section>
        <h1 className="text-[24px] font-bold text-foreground" style={{ paddingBottom: 12, borderBottom: '1px solid #e5e5e7' }}>검색</h1>
        <p className="text-[13px] text-muted mt-2">파일을 찾거나 AI에게 직접 질문하세요</p>
      </section>

      {/* ── 탭 ── */}
      <div className="flex gap-1 bg-[#f5f5f7] rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex flex-col items-start px-5 py-2.5 rounded-lg text-left transition-all ${
              activeTab === t.id
                ? 'bg-white shadow-sm text-[#1d1d1f]'
                : 'text-[#6e6e73] hover:text-[#1d1d1f]'
            }`}
          >
            <span className={`text-[13px] font-semibold ${activeTab === t.id ? 'text-[#0071e3]' : ''}`}>{t.label}</span>
            <span className="text-[11px] text-[#a1a1a6] mt-0.5">{t.desc}</span>
          </button>
        ))}
      </div>

      {/* ══════════════ 파일 검색 탭 ══════════════ */}
      {activeTab === 'file' && (
        <>
          {/* 검색창 */}
          <div className="bg-white rounded-2xl border border-[#e5e5e7]" style={{ padding: '28px' }}>
            <div className="relative flex items-center gap-2">
              <div className="flex-1">
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  onSearch={() => doSearch(query)}
                  placeholder="파일명이나 내용으로 검색하세요..."
                  showButton
                  buttonLabel={loading ? '검색 중...' : '검색'}
                  loading={loading}
                  buttonDisabled={loading || !query.trim()}
                  size="lg"
                />
              </div>
              <VoiceInputButton
                onTranscript={(text) => { setQuery(text); doSearch(text); }}
                disabled={loading}
                className="shrink-0"
              />
            </div>
          </div>

          {/* 필터 */}
          <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="rounded-xl border border-[#e5e5e7] bg-white text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
              style={{ padding: '10px 18px' }}
            >
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
            <select
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
              className="rounded-xl border border-[#e5e5e7] bg-white text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
              style={{ padding: '10px 18px' }}
            >
              {FILE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* 제안어 */}
          {!searched && (
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); doSearch(s); }}
                  className="rounded-full bg-[#f5f5f7] border border-[#e5e5e7] text-[14px] text-[#1d1d1f] hover:bg-white hover:border-[#0071e3] transition-colors"
                  style={{ padding: '10px 18px' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* 로딩 */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Spinner size="lg" />
              <p className="text-[#6e6e73] text-sm">파일을 검색하고 있습니다...</p>
            </div>
          )}

          {/* 결과 */}
          {searched && !loading && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#6e6e73]">
                  <span className="font-semibold text-[#1d1d1f]">{sortedResults.length}개</span> 결과
                </p>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] focus:outline-none"
                >
                  {SORT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>

              {sortedResults.length === 0 ? (
                <EmptyState iconType="search" title="검색 결과가 없습니다" description="다른 키워드로 다시 검색해 보세요" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {sortedResults.map((r) => (
                    <div
                      key={r.id}
                      className="bg-white rounded-2xl border border-[#e5e5e7] overflow-hidden hover:shadow-md transition-shadow"
                      style={{ padding: '24px 28px' }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="inline-flex items-center justify-center text-xs font-bold text-[#1d1d1f] bg-[#f5f5f7] rounded-lg w-12 h-6 font-num">
                              {r.relevance}%
                            </span>
                            <h3 className="text-[16px] font-semibold text-foreground truncate">{r.name}</h3>
                          </div>
                          <p className="text-sm text-[#6e6e73] leading-relaxed mb-3">{r.excerpt}</p>
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FILE_TYPE_BADGE[r.fileType] ?? 'bg-gray-100 text-gray-600'}`}>
                              {r.fileType}
                            </span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                              {r.department}
                            </span>
                            <span className="text-xs text-[#6e6e73]">{r.date}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-[#f5f5f7] flex items-center gap-4">
                        <button
                          onClick={() => openPreview(r.id)}
                          className="flex items-center gap-1.5 text-sm text-[#1d1d1f] hover:text-[#0071e3] font-medium transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          미리보기
                        </button>
                        <button
                          onClick={() => setExpandedSummary(expandedSummary === r.id ? null : r.id)}
                          className="flex items-center gap-1.5 text-sm text-[#0071e3] font-medium transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>
                          AI 요약 {expandedSummary === r.id ? '접기' : '보기'}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/files/${r.id}/download`);
                              if (!res.ok) { toast.error('다운로드 실패'); return; }
                              const data = await res.json();
                              if (data.url) {
                                const dlRes = await fetch(data.url);
                                const blob = await dlRes.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = r.name; a.click();
                                URL.revokeObjectURL(url);
                              }
                            } catch { toast.error('다운로드 실패'); }
                          }}
                          className="flex items-center gap-1.5 text-sm text-[#6e6e73] hover:text-[#1d1d1f] font-medium transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          원본 다운로드
                        </button>
                      </div>

                      {expandedSummary === r.id && (
                        <div className="mt-4 p-5 rounded-xl bg-[#f5f5f7] text-sm text-[#1d1d1f] leading-relaxed">
                          {r.aiSummary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 검색 전 빈 상태 */}
          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-24 h-24 rounded-full bg-[#f5f5f7] flex items-center justify-center" style={{ marginBottom: 16 }}>
                <svg className="w-10 h-10 text-[#0071e3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#1d1d1f]" style={{ marginBottom: 8 }}>파일 검색</h3>
              <p className="text-[#6e6e73] max-w-sm text-sm">파일명이나 내용으로 업로드된 문서를 검색합니다.</p>
            </div>
          )}
        </>
      )}

      {/* ══════════════ AI에게 묻기 탭 ══════════════ */}
      {activeTab === 'ai' && (
        <div className="bg-white rounded-2xl border border-[#e5e5e7] overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 260px)', minHeight: 480 }}>

          {/* 채팅 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5e7] bg-[#f5f5f7] shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0071e3] flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1d1d1f]">AI 문서 질의응답</p>
                <p className="text-xs text-[#6e6e73]">업로드된 파일 기반으로 답변합니다</p>
              </div>
            </div>
            {chatMessages.length > 0 && (
              <button
                onClick={() => setChatMessages([])}
                className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors px-3 py-1.5 rounded-lg hover:bg-white"
              >
                대화 초기화
              </button>
            )}
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-6 py-5" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <svg className="w-12 h-12 text-[#0071e3] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[#1d1d1f]">문서에 대해 무엇이든 물어보세요</p>
                  <p className="text-xs text-[#6e6e73] mt-1">파일 탭에서 검색 후 질문하면 더 정확한 답변을 드립니다</p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-sm mt-2">
                  {[
                    '3월에 체결한 계약서의 납기일이 언제인가요?',
                    '가장 최근 회의록의 주요 결정 사항은?',
                    '계약 금액이 1억 이상인 파일을 찾아줘',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setChatInput(q)}
                      className="text-left text-xs text-[#0071e3] bg-[#f0f7ff] hover:bg-[#e0f0ff] px-4 py-2.5 rounded-xl transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-[#0071e3] flex items-center justify-center shrink-0 mr-2 mt-1">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#0071e3] text-white rounded-tr-sm'
                      : 'bg-[#f5f5f7] text-[#1d1d1f] rounded-tl-sm'
                  }`}
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#0071e3] flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div className="bg-[#f5f5f7] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#6e6e73] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[#6e6e73] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[#6e6e73] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 입력창 */}
          <div className="px-5 py-4 border-t border-[#e5e5e7] shrink-0 flex gap-2 bg-white">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder="질문을 입력하세요... (Enter로 전송)"
              disabled={chatLoading}
              className="flex-1 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-sm text-[#1d1d1f] placeholder:text-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#0071e3] disabled:opacity-50 px-4 py-3"
            />
            <button
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              className="w-11 h-11 rounded-xl bg-[#0071e3] text-white flex items-center justify-center hover:bg-[#005bbf] transition-colors disabled:opacity-40 shrink-0 self-end"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── 파일 미리보기 모달 ── */}
      {(previewData || previewLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setPreviewData(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#e5e5e7] shrink-0">
              <h2 className="text-lg font-semibold text-[#1d1d1f] truncate">{previewLoading ? '불러오는 중...' : previewData?.name}</h2>
              <button onClick={() => setPreviewData(null)} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {previewLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <pre className="whitespace-pre-wrap text-sm text-[#1d1d1f] leading-relaxed font-sans">{previewData?.text}</pre>
                  {previewData?.truncated && (
                    <p className="mt-4 text-xs text-[#6e6e73]">* 전체 {previewData.totalLength?.toLocaleString()}자 중 10,000자까지 표시됩니다.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
