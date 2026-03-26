'use client';

import { useState, useEffect } from 'react';

/* ────────────────────────── types ────────────────────────── */
interface Document {
  id: string;
  title: string;
  template: string;
  createdAt: string;
  status: '초안' | '완료';
  sourceCount: number;
}

interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface SourceFile {
  id: string;
  name: string;
  type: string;
}

/* ────────────────────────── mock ─────────────────────────── */
const MOCK_DOCS: Document[] = [
  { id: '1', title: '2026년 1분기 경영 보고서', template: '분기 보고서', createdAt: '2026-03-25', status: '완료', sourceCount: 5 },
  { id: '2', title: '프로젝트 A 제안서 초안', template: '프로젝트 제안서', createdAt: '2026-03-24', status: '초안', sourceCount: 3 },
  { id: '3', title: '3월 전사 회의 요약', template: '회의록 요약', createdAt: '2026-03-23', status: '완료', sourceCount: 2 },
  { id: '4', title: '신규 거래처 계약 검토', template: '계약서 분석', createdAt: '2026-03-22', status: '초안', sourceCount: 4 },
  { id: '5', title: '마케팅 성과 리포트', template: '성과 리포트', createdAt: '2026-03-21', status: '완료', sourceCount: 6 },
];

const MOCK_TEMPLATES: Template[] = [
  { id: 't1', name: '분기 보고서', icon: '📊', description: '분기별 경영 성과 보고서를 자동으로 생성합니다.' },
  { id: 't2', name: '회의록 요약', icon: '📝', description: '회의 내용을 핵심 위주로 요약합니다.' },
  { id: 't3', name: '프로젝트 제안서', icon: '💡', description: '프로젝트 제안서를 구조화하여 생성합니다.' },
  { id: 't4', name: '계약서 분석', icon: '📋', description: '계약서의 주요 조항을 분석합니다.' },
  { id: 't5', name: '성과 리포트', icon: '📈', description: '부서별 성과를 정리한 리포트를 생성합니다.' },
  { id: 't6', name: '이메일 초안', icon: '✉️', description: '비즈니스 이메일 초안을 작성합니다.' },
];

const MOCK_SOURCE_FILES: SourceFile[] = [
  { id: 'f1', name: '2026년 1분기 실적보고서.pdf', type: 'PDF' },
  { id: 'f2', name: '프로젝트 제안서_v3.docx', type: 'DOCX' },
  { id: 'f3', name: '3월 회의록.md', type: 'MD' },
  { id: 'f4', name: '계약서_최종.pdf', type: 'PDF' },
  { id: 'f5', name: '마케팅 전략 보고서.pptx', type: 'PPTX' },
  { id: 'f6', name: '급여 명세서_3월.xlsx', type: 'XLSX' },
];

const statusColor: Record<string, string> = {
  '초안': 'bg-amber-100 text-amber-700',
  '완료': 'bg-green-100 text-green-700',
};

/* ────────────────────────── page ─────────────────────────── */
export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/documents');
        if (res.ok) {
          const data = await res.json();
          setDocs(data.documents ?? MOCK_DOCS);
        } else throw new Error();
      } catch {
        setDocs(MOCK_DOCS);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const resetModal = () => {
    setShowModal(false);
    setStep(1);
    setSelectedTemplate(null);
    setSelectedFiles(new Set());
    setInstructions('');
  };

  const toggleFile = (id: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const canNext = () => {
    if (step === 1) return !!selectedTemplate;
    if (step === 2) return selectedFiles.size > 0;
    return true;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-[#DDE3EC] rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 bg-white rounded-2xl border border-[#DDE3EC]" />
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
          <h1 className="text-2xl font-bold text-[#0A1628]">문서 생성</h1>
          <p className="text-[#6B7A8D] mt-1">AI를 활용하여 문서를 자동으로 생성하세요</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4B8FD4] text-white text-sm font-medium hover:bg-[#3A7DC2] transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          새 문서 생성
        </button>
      </div>

      {/* document list */}
      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 rounded-full bg-[#EBF2FA] flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-[#4B8FD4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#0A1628] mb-1">생성된 문서가 없습니다</h3>
          <p className="text-[#6B7A8D] text-sm mb-4">새 문서 생성 버튼을 눌러 첫 문서를 만들어 보세요</p>
          <button onClick={() => setShowModal(true)} className="px-5 py-2.5 rounded-xl bg-[#4B8FD4] text-white text-sm font-medium hover:bg-[#3A7DC2] transition-colors">
            새 문서 생성
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl border border-[#DDE3EC] p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-[#0A1628] truncate pr-2">{d.title}</h3>
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[d.status]}`}>{d.status}</span>
              </div>
              <div className="space-y-2 text-sm text-[#6B7A8D]">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" /></svg>
                  <span>템플릿: {d.template}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                  <span>{d.createdAt}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  <span>소스 파일 {d.sourceCount}개</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-[#F2F5F9]">
                <button className="px-3 py-1.5 rounded-lg text-sm text-[#4B8FD4] hover:bg-[#EBF2FA] transition-colors">보기</button>
                <button className="px-3 py-1.5 rounded-lg text-sm text-[#4B8FD4] hover:bg-[#EBF2FA] transition-colors">다운로드</button>
                <button className="px-3 py-1.5 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors">삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── New Document Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* modal header */}
            <div className="px-6 py-4 border-b border-[#DDE3EC] flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-semibold text-[#0A1628]">새 문서 생성</h2>
              <button onClick={resetModal} className="p-1 rounded-lg hover:bg-[#F2F5F9] text-[#6B7A8D]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* steps indicator */}
            <div className="px-6 py-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${step >= s ? 'bg-[#4B8FD4] text-white' : 'bg-[#F2F5F9] text-[#6B7A8D]'}`}>
                      {s}
                    </div>
                    {s < 4 && <div className={`h-0.5 flex-1 rounded ${step > s ? 'bg-[#4B8FD4]' : 'bg-[#DDE3EC]'}`} />}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-[#6B7A8D] mt-2">
                <span>템플릿 선택</span>
                <span>소스 파일</span>
                <span>추가 지시</span>
                <span>미리보기</span>
              </div>
            </div>

            <div className="px-6 pb-6">
              {/* Step 1 */}
              {step === 1 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {MOCK_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`p-4 rounded-xl border text-left transition-all ${selectedTemplate === t.id ? 'border-[#4B8FD4] bg-[#EBF2FA] ring-2 ring-[#4B8FD4]/30' : 'border-[#DDE3EC] hover:border-[#4B8FD4]'}`}
                    >
                      <span className="text-2xl">{t.icon}</span>
                      <h4 className="font-medium text-[#0A1628] text-sm mt-2">{t.name}</h4>
                      <p className="text-xs text-[#6B7A8D] mt-1 line-clamp-2">{t.description}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div className="space-y-2">
                  <p className="text-sm text-[#6B7A8D] mb-3">문서 생성에 사용할 소스 파일을 선택하세요</p>
                  {MOCK_SOURCE_FILES.map((f) => (
                    <label
                      key={f.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedFiles.has(f.id) ? 'border-[#4B8FD4] bg-[#EBF2FA]' : 'border-[#DDE3EC] hover:bg-[#F8FAFC]'}`}
                    >
                      <input type="checkbox" checked={selectedFiles.has(f.id)} onChange={() => toggleFile(f.id)} className="rounded border-[#DDE3EC] text-[#4B8FD4] focus:ring-[#4B8FD4]" />
                      <svg className="w-5 h-5 text-[#6B7A8D] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="text-sm text-[#0A1628] truncate">{f.name}</span>
                      <span className="ml-auto text-xs text-[#6B7A8D] shrink-0">{f.type}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Step 3 */}
              {step === 3 && (
                <div>
                  <p className="text-sm text-[#6B7A8D] mb-3">추가 지시사항을 입력하세요 (선택)</p>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="예: 핵심 수치 위주로 요약해 주세요. 표 형태로 정리해 주세요."
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl border border-[#DDE3EC] bg-white text-sm text-[#0A1628] placeholder:text-[#6B7A8D] focus:outline-none focus:ring-2 focus:ring-[#4B8FD4] resize-none"
                  />
                </div>
              )}

              {/* Step 4 - Preview */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="bg-[#F8FAFC] rounded-xl p-4 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#6B7A8D]">템플릿</span>
                      <span className="text-[#0A1628] font-medium">{MOCK_TEMPLATES.find((t) => t.id === selectedTemplate)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7A8D]">소스 파일</span>
                      <span className="text-[#0A1628] font-medium">{selectedFiles.size}개</span>
                    </div>
                    {instructions && (
                      <div>
                        <span className="text-[#6B7A8D]">추가 지시사항</span>
                        <p className="text-[#0A1628] mt-1">{instructions}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7A8D] text-center">생성 버튼을 누르면 AI가 문서를 생성합니다. 수 분이 소요될 수 있습니다.</p>
                </div>
              )}
            </div>

            {/* modal footer */}
            <div className="px-6 py-4 border-t border-[#DDE3EC] flex items-center justify-between sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => (step === 1 ? resetModal() : setStep(step - 1))}
                className="px-4 py-2 rounded-xl border border-[#DDE3EC] text-sm text-[#6B7A8D] hover:bg-[#F2F5F9] transition-colors"
              >
                {step === 1 ? '취소' : '이전'}
              </button>
              <button
                disabled={!canNext()}
                onClick={() => {
                  if (step < 4) setStep(step + 1);
                  else resetModal(); // would call generate API
                }}
                className="px-5 py-2 rounded-xl bg-[#4B8FD4] text-white text-sm font-medium hover:bg-[#3A7DC2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {step === 4 ? '문서 생성' : '다음'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
