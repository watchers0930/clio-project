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

/* ────────────────────────── mock ─────────────────────────── */
const MOCK_RESULTS: SearchResult[] = [
  {
    id: '1',
    name: '2026년 1분기 실적보고서.pdf',
    excerpt: '당기 순이익은 전년 대비 15% 증가한 420억원을 기록하였으며, 영업이익률은 12.3%로 전분기 대비 상승...',
    relevance: 96,
    fileType: 'PDF',
    department: '경영기획팀',
    date: '2026-03-25',
    aiSummary: '이 보고서는 2026년 1분기 경영 실적을 요약합니다. 매출액 3,500억원, 순이익 420억원으로 전년 대비 15% 성장하였습니다. 주요 성장 요인은 신제품 출시와 해외 시장 확대입니다.',
  },
  {
    id: '2',
    name: '프로젝트 제안서_v3.docx',
    excerpt: '본 프로젝트는 AI 기반 문서 관리 시스템을 구축하여 업무 효율성을 30% 이상 향상시키는 것을 목표로...',
    relevance: 89,
    fileType: 'DOCX',
    department: '개발팀',
    date: '2026-03-24',
    aiSummary: 'AI 문서 관리 시스템 프로젝트 제안서입니다. 6개월 일정, 총 예산 5억원이며, RAG 기반 검색과 자동 요약 기능을 핵심으로 합니다.',
  },
  {
    id: '3',
    name: '3월 전체 회의록.md',
    excerpt: '신규 인력 채용 계획에 대해 논의하였으며, 2분기까지 개발팀 5명, 마케팅팀 3명 충원 예정...',
    relevance: 78,
    fileType: 'MD',
    department: '인사팀',
    date: '2026-03-22',
    aiSummary: '3월 전사 회의록으로, 채용 계획(8명), 사무실 이전 일정, 하반기 교육 프로그램 등을 다루고 있습니다.',
  },
  {
    id: '4',
    name: '마케팅 분석 보고서.pptx',
    excerpt: '디지털 마케팅 캠페인 결과 분석: SNS 도달 150만, CTR 3.2%, 전환율 1.8%로 업계 평균 대비...',
    relevance: 72,
    fileType: 'PPTX',
    department: '마케팅팀',
    date: '2026-03-20',
    aiSummary: '2026년 상반기 디지털 마케팅 캠페인의 성과를 분석한 보고서입니다. 전체적으로 KPI 달성률 115%를 기록했습니다.',
  },
];

const SUGGESTIONS = ['최근 회의록', '계약서 템플릿', '분기 보고서', '인사 관련 문서', '프로젝트 현황'];

const DEPARTMENTS = ['전체', '경영기획팀', '개발팀', '마케팅팀', '인사팀', '법무팀'];
const FILE_TYPES = ['전체', 'PDF', 'DOCX', 'PPTX', 'XLSX', 'MD'];
const SORT_OPTIONS = ['관련도순', '최신순', '오래된순', '이름순'];

const typeBadge: Record<string, string> = {
  PDF: 'bg-red-100 text-red-600',
  DOCX: 'bg-blue-100 text-blue-600',
  PPTX: 'bg-orange-100 text-orange-600',
  XLSX: 'bg-green-100 text-green-600',
  MD: 'bg-purple-100 text-purple-600',
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
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&dept=${department}&type=${fileType}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? MOCK_RESULTS);
        } else throw new Error();
      } catch {
        setResults(MOCK_RESULTS);
      } finally {
        setLoading(false);
      }
    },
    [department, fileType],
  );

  return (
    <div className="space-y-6 pb-10">
      {/* ── header ── */}
      <section>
        <h1 className="text-2xl font-bold text-[#0A1628]">AI 검색</h1>
        <p className="text-[#6B7A8D] mt-1">자연어로 원하는 문서를 빠르게 찾아보세요</p>
      </section>

      {/* ── search bar ── */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7A8D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
          placeholder="자연어로 문서를 검색하세요..."
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-[#DDE3EC] bg-white text-[#0A1628] text-lg placeholder:text-[#6B7A8D] focus:outline-none focus:ring-2 focus:ring-[#4B8FD4] focus:border-transparent shadow-sm"
        />
        <button
          onClick={() => doSearch(query)}
          className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2 rounded-xl bg-[#4B8FD4] text-white text-sm font-medium hover:bg-[#3A7DC2] transition-colors"
        >
          검색
        </button>
      </div>

      {/* ── filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="px-4 py-2 rounded-xl border border-[#DDE3EC] bg-white text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#4B8FD4]"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          className="px-4 py-2 rounded-xl border border-[#DDE3EC] bg-white text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#4B8FD4]"
        >
          {FILE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          type="date"
          className="px-4 py-2 rounded-xl border border-[#DDE3EC] bg-white text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#4B8FD4]"
        />
        <span className="text-[#6B7A8D] text-sm">~</span>
        <input
          type="date"
          className="px-4 py-2 rounded-xl border border-[#DDE3EC] bg-white text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#4B8FD4]"
        />
      </div>

      {/* ── suggestions ── */}
      {!searched && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setQuery(s);
                doSearch(s);
              }}
              className="px-4 py-2 rounded-full bg-white border border-[#DDE3EC] text-sm text-[#0A1628] hover:bg-[#EBF2FA] hover:border-[#4B8FD4] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-3 border-[#DDE3EC] border-t-[#4B8FD4] rounded-full animate-spin" />
          <p className="text-[#6B7A8D] text-sm">AI가 문서를 분석하고 있습니다...</p>
        </div>
      )}

      {/* ── results ── */}
      {searched && !loading && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#6B7A8D]">
              <span className="font-semibold text-[#0A1628]">{results.length}개</span> 결과를 찾았습니다
            </p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#DDE3EC] bg-white text-sm text-[#0A1628] focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>

          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 rounded-full bg-[#F2F5F9] flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-[#DDE3EC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#0A1628] mb-1">검색 결과가 없습니다</h3>
              <p className="text-[#6B7A8D] text-sm">다른 키워드로 다시 검색해 보세요</p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-[#DDE3EC] p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="inline-flex items-center justify-center text-xs font-bold text-white bg-[#4B8FD4] rounded-lg w-12 h-6">
                          {r.relevance}%
                        </span>
                        <h3 className="font-semibold text-[#0A1628] truncate">{r.name}</h3>
                      </div>
                      <p className="text-sm text-[#6B7A8D] leading-relaxed mb-3">{r.excerpt}</p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge[r.fileType] ?? 'bg-gray-100 text-gray-600'}`}>
                          {r.fileType}
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#EBF2FA] text-[#4B8FD4]">
                          {r.department}
                        </span>
                        <span className="text-xs text-[#6B7A8D]">{r.date}</span>
                      </div>
                    </div>
                  </div>

                  {/* AI summary toggle */}
                  <div className="mt-3 pt-3 border-t border-[#F2F5F9]">
                    <button
                      onClick={() => setExpandedSummary(expandedSummary === r.id ? null : r.id)}
                      className="flex items-center gap-1.5 text-sm text-[#4B8FD4] hover:text-[#3A7DC2] font-medium transition-colors"
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
                      <div className="mt-3 p-4 rounded-xl bg-[#F8FAFC] text-sm text-[#1A2332] leading-relaxed">
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
          <div className="w-32 h-32 rounded-full bg-[#EBF2FA] flex items-center justify-center mb-6">
            <svg className="w-14 h-14 text-[#4B8FD4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-[#0A1628] mb-2">AI 기반 스마트 검색</h3>
          <p className="text-[#6B7A8D] max-w-md">
            자연어로 질문하면 AI가 관련 문서를 찾아 핵심 내용을 요약해 드립니다.
            위 검색창에 궁금한 내용을 입력해 보세요.
          </p>
        </div>
      )}
    </div>
  );
}
