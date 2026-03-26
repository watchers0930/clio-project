'use client';

import { useState, useCallback } from 'react';

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

/* ────────────────────────── constants ────────────────────── */
const SUGGESTIONS = ['최근 회의록', '계약서 템플릿', '분기 보고서', '인사 관련 문서', '프로젝트 현황', '마케팅 전략', '예산', '채용'];

const DEPARTMENTS = ['전체', '경영지원팀', '총무팀', '개발팀', '마케팅팀', '인사팀'];
const FILE_TYPES = ['전체', 'PDF', 'DOCX', 'PPTX', 'XLSX', 'MD', 'M4A'];
const SORT_OPTIONS = ['관련도순', '최신순', '오래된순', '이름순'];

const typeBadge: Record<string, string> = {
  PDF: 'bg-[#f5f5f7] text-[#1d1d1f]',
  DOCX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  PPTX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  XLSX: 'bg-[#f5f5f7] text-[#1d1d1f]',
  MD: 'bg-[#f5f5f7] text-[#1d1d1f]',
  M4A: 'bg-[#f5f5f7] text-[#1d1d1f]',
};

/* ────────────────────────── page ─────────────────────────── */
export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [department, setDepartment] = useState('전체');
  const [fileType, setFileType] = useState('전체');
  const [sort, setSort] = useState('관련도순');
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);

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

  // Sort results client-side
  const sortedResults = [...results].sort((a, b) => {
    switch (sort) {
      case '최신순':
        return b.date.localeCompare(a.date);
      case '오래된순':
        return a.date.localeCompare(b.date);
      case '이름순':
        return a.name.localeCompare(b.name);
      default:
        return b.relevance - a.relevance;
    }
  });

  // Re-search when filters change (if already searched)
  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    // We trigger a new search on next render via effect-like approach
    // Instead, call doSearch directly after state updates
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }} className="pb-10">
      {/* ── header ── */}
      <section>
        <h1 className="text-[24px] font-bold text-foreground" style={{ paddingBottom: 12, borderBottom: '1px solid #e5e5e7' }}>AI 검색</h1>
        <p className="text-[13px] text-muted mt-2">자연어로 원하는 문서를 빠르게 찾아보세요</p>
      </section>

      {/* ── search bar ── */}
      <div className="bg-white rounded-2xl border border-[#e5e5e7] overflow-hidden" style={{ padding: '24px' }}>
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
            placeholder="자연어로 문서를 검색하세요..."
            className="w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] text-[14px] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent"
            style={{ padding: '12px 96px 12px 48px' }}
          />
          <button
            onClick={() => doSearch(query)}
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-[#1d1d1f] text-white text-[14px] font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ padding: '8px 20px' }}
          >
            {loading ? '검색 중...' : '검색'}
          </button>
        </div>
      </div>

      {/* ── filters ── */}
      <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
        <select
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value);
            if (searched && query.trim()) {
              setTimeout(() => doSearch(query), 0);
            }
          }}
          className="rounded-xl border border-[#e5e5e7] bg-white text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
          style={{ padding: '8px 16px' }}
        >
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          value={fileType}
          onChange={(e) => {
            setFileType(e.target.value);
            if (searched && query.trim()) {
              setTimeout(() => doSearch(query), 0);
            }
          }}
          className="rounded-xl border border-[#e5e5e7] bg-white text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
          style={{ padding: '8px 16px' }}
        >
          {FILE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* ── suggestions ── */}
      {!searched && (
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setQuery(s);
                doSearch(s);
              }}
              className="rounded-full bg-[#f5f5f7] border border-[#e5e5e7] text-[14px] text-[#1d1d1f] hover:bg-white hover:border-[#0071e3] transition-colors"
              style={{ padding: '8px 16px' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-3 border-[#e5e5e7] border-t-[#0071e3] rounded-full animate-spin" />
          <p className="text-[#6e6e73] text-sm">AI가 문서를 분석하고 있습니다...</p>
        </div>
      )}

      {/* ── results ── */}
      {searched && !loading && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#6e6e73]">
              <span className="font-semibold text-[#1d1d1f]">{sortedResults.length}개</span> 결과를 찾았습니다
            </p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>

          {sortedResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 rounded-full bg-[#f5f5f7] flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-[#e5e5e7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#1d1d1f] mb-1">검색 결과가 없습니다</h3>
              <p className="text-[#6e6e73] text-sm">다른 키워드로 다시 검색해 보세요</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {sortedResults.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-[#e5e5e7] overflow-hidden hover:shadow-md transition-shadow"
                  style={{ padding: '20px 24px' }}
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
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge[r.fileType] ?? 'bg-gray-100 text-gray-600'}`}>
                          {r.fileType}
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                          {r.department}
                        </span>
                        <span className="text-xs text-[#6e6e73]">{r.date}</span>
                      </div>
                    </div>
                  </div>

                  {/* AI summary toggle */}
                  <div className="mt-3 pt-3 border-t border-[#f5f5f7]">
                    <button
                      onClick={() => setExpandedSummary(expandedSummary === r.id ? null : r.id)}
                      className="flex items-center gap-1.5 text-sm text-[#0071e3] hover:text-[#0071e3] font-medium transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      AI 요약 {expandedSummary === r.id ? '접기' : '보기'}
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedSummary === r.id ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    {expandedSummary === r.id && (
                      <div className="mt-3 p-4 rounded-xl bg-[#f5f5f7] text-sm text-[#1d1d1f] leading-relaxed">
                        {r.aiSummary}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── empty state (before first search) ── */}
      {!searched && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-32 h-32 rounded-full bg-[#f5f5f7] flex items-center justify-center mb-6">
            <svg className="w-14 h-14 text-[#0071e3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-[#1d1d1f] mb-2">AI 기반 스마트 검색</h3>
          <p className="text-[#6e6e73] max-w-md">
            자연어로 질문하면 AI가 관련 문서를 찾아 핵심 내용을 요약해 드립니다.
            위 검색창에 궁금한 내용을 입력해 보세요.
          </p>
        </div>
      )}
    </div>
  );
}
