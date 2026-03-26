'use client';

import { useState, useEffect } from 'react';

/* ────────────────────────── types ────────────────────────── */
interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  department: string;
  scope: '전사 공용' | '부서 전용';
  usageCount: number;
  lastUpdated: string;
  placeholders: string[];
}

/* ────────────────────────── mock ─────────────────────────── */
const MOCK_TEMPLATES: Template[] = [
  { id: 't1', name: '분기 보고서', icon: '📊', description: '분기별 경영 성과 보고서를 자동으로 생성합니다. 매출, 비용, 순이익 등 핵심 지표를 포함합니다.', department: '전사', scope: '전사 공용', usageCount: 48, lastUpdated: '2026-03-20', placeholders: ['분기', '부서명', '매출액', '순이익'] },
  { id: 't2', name: '회의록 요약', icon: '📝', description: '회의 내용을 핵심 위주로 요약하고 액션 아이템을 정리합니다.', department: '전사', scope: '전사 공용', usageCount: 92, lastUpdated: '2026-03-22', placeholders: ['회의일자', '참석자', '주요 안건'] },
  { id: 't3', name: '프로젝트 제안서', icon: '💡', description: '프로젝트 제안서를 구조화하여 생성합니다.', department: '개발팀', scope: '부서 전용', usageCount: 23, lastUpdated: '2026-03-18', placeholders: ['프로젝트명', '목표', '일정', '예산'] },
  { id: 't4', name: '계약서 분석', icon: '📋', description: '계약서의 주요 조항을 분석하고 리스크를 식별합니다.', department: '법무팀', scope: '부서 전용', usageCount: 17, lastUpdated: '2026-03-19', placeholders: ['계약 상대방', '계약 기간', '금액'] },
  { id: 't5', name: '성과 리포트', icon: '📈', description: '부서별 성과를 정리한 리포트를 생성합니다.', department: '전사', scope: '전사 공용', usageCount: 35, lastUpdated: '2026-03-21', placeholders: ['기간', '부서명', 'KPI 항목'] },
  { id: 't6', name: '이메일 초안', icon: '✉️', description: '비즈니스 이메일 초안을 작성합니다.', department: '전사', scope: '전사 공용', usageCount: 64, lastUpdated: '2026-03-23', placeholders: ['수신자', '제목', '핵심 내용'] },
  { id: 't7', name: '채용 공고', icon: '👥', description: '직무별 채용 공고문을 작성합니다.', department: '인사팀', scope: '부서 전용', usageCount: 12, lastUpdated: '2026-03-15', placeholders: ['직무', '경력', '우대사항'] },
  { id: 't8', name: '캠페인 보고서', icon: '🎯', description: '마케팅 캠페인의 성과를 분석한 보고서를 생성합니다.', department: '마케팅팀', scope: '부서 전용', usageCount: 19, lastUpdated: '2026-03-17', placeholders: ['캠페인명', '기간', '채널', '예산'] },
];

/* ────────────────────────── page ─────────────────────────── */
export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'전사 공용' | '부서 전용'>('전사 공용');
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/templates');
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates ?? MOCK_TEMPLATES);
        } else throw new Error();
      } catch {
        setTemplates(MOCK_TEMPLATES);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = templates.filter((t) => t.scope === tab);
  const detail = templates.find((t) => t.id === detailId);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-[#DDE3EC] rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-white rounded-2xl border border-[#DDE3EC]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0A1628]">템플릿 관리</h1>
          <p className="text-[#6B7A8D] mt-1">문서 생성에 사용할 템플릿을 관리하세요</p>
        </div>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4B8FD4] text-white text-sm font-medium hover:bg-[#3A7DC2] transition-colors shadow-sm">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          새 템플릿
        </button>
      </div>

      {/* tabs */}
      <div className="flex gap-1 bg-[#F2F5F9] rounded-xl p-1 w-fit">
        {(['전사 공용', '부서 전용'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-[#0A1628] shadow-sm' : 'text-[#6B7A8D] hover:text-[#0A1628]'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-[#DDE3EC] p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{t.icon}</span>
              <div className="flex gap-1">
                <button onClick={() => setDetailId(t.id)} title="편집" className="p-1.5 rounded-lg hover:bg-[#F2F5F9] text-[#6B7A8D] hover:text-[#4B8FD4] transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                </button>
                <button title="복제" className="p-1.5 rounded-lg hover:bg-[#F2F5F9] text-[#6B7A8D] hover:text-[#4B8FD4] transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                </button>
                <button title="삭제" className="p-1.5 rounded-lg hover:bg-red-50 text-[#6B7A8D] hover:text-red-500 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
              </div>
            </div>
            <h3 className="font-semibold text-[#0A1628] mb-1">{t.name}</h3>
            <p className="text-sm text-[#6B7A8D] line-clamp-2 mb-3">{t.description}</p>
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <span className="px-2 py-0.5 rounded-full bg-[#EBF2FA] text-[#4B8FD4] font-medium">{t.department}</span>
              <span className="text-[#6B7A8D]">사용 {t.usageCount}회</span>
              <span className="text-[#6B7A8D]">·</span>
              <span className="text-[#6B7A8D]">{t.lastUpdated}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Detail/Edit Modal ── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#DDE3EC] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#0A1628]">템플릿 상세</h2>
              <button onClick={() => setDetailId(null)} className="p-1 rounded-lg hover:bg-[#F2F5F9] text-[#6B7A8D]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-6 space-y-5">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{detail.icon}</span>
                <div>
                  <h3 className="font-bold text-[#0A1628] text-lg">{detail.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#EBF2FA] text-[#4B8FD4] font-medium">{detail.department}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1">이름</label>
                <input defaultValue={detail.name} className="w-full px-4 py-2.5 rounded-xl border border-[#DDE3EC] text-sm focus:outline-none focus:ring-2 focus:ring-[#4B8FD4]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1">설명</label>
                <textarea defaultValue={detail.description} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-[#DDE3EC] text-sm focus:outline-none focus:ring-2 focus:ring-[#4B8FD4] resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-2">플레이스홀더</label>
                <div className="flex flex-wrap gap-2">
                  {detail.placeholders.map((p) => (
                    <span key={p} className="px-3 py-1 rounded-full bg-[#F2F5F9] text-sm text-[#0A1628] border border-[#DDE3EC]">
                      {'{{'}{p}{'}}'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-[#F8FAFC] rounded-xl p-4">
                <h4 className="text-sm font-medium text-[#0A1628] mb-2">미리보기</h4>
                <p className="text-sm text-[#6B7A8D] leading-relaxed">
                  {detail.description} 플레이스홀더 {detail.placeholders.length}개가 포함되어 있으며,
                  지금까지 {detail.usageCount}회 사용되었습니다.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#DDE3EC] flex justify-end gap-3">
              <button onClick={() => setDetailId(null)} className="px-4 py-2 rounded-xl border border-[#DDE3EC] text-sm text-[#6B7A8D] hover:bg-[#F2F5F9] transition-colors">취소</button>
              <button onClick={() => setDetailId(null)} className="px-5 py-2 rounded-xl bg-[#4B8FD4] text-white text-sm font-medium hover:bg-[#3A7DC2] transition-colors">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
