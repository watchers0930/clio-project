'use client';

import { useState, useEffect, useCallback } from 'react';

/* ────────────────────────── types ────────────────────────── */
interface Document {
  id: string;
  title: string;
  template: string;
  createdAt: string;
  status: '초안' | '완료';
  sourceCount: number;
  content?: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
}

interface SourceFile {
  id: string;
  name: string;
  type: string;
  department: string;
  size: string;
  uploadDate: string;
  status: string;
}

const statusColor: Record<string, string> = {
  '초안': 'bg-[#f5f5f7] text-[#ff9f0a]',
  '완료': 'bg-[#f5f5f7] text-[#30d158]',
};

const TEMPLATE_ICONS: Record<string, string> = {
  '주간업무보고서': '📊',
  '회의록': '📝',
  '기술설계문서': '💡',
  '마케팅_캠페인_기획서': '🎯',
  '채용공고_양식': '👥',
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
  const [generating, setGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<Document | null>(null);

  // Step 2: file search & filter
  const [fileSearch, setFileSearch] = useState('');
  const [fileDeptFilter, setFileDeptFilter] = useState('전체');
  const [fileTypeFilter, setFileTypeFilter] = useState('전체');

  // View modal state
  const [viewDoc, setViewDoc] = useState<Document | null>(null);

  // Templates and source files from API
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        const tmplData = data.data ?? data.templates ?? [];
        setTemplates(
          tmplData.map((t: Record<string, unknown>) => ({
            id: t.id as string,
            name: t.name as string,
            description: t.description as string,
          }))
        );
      }
    } catch {
      // silent
    }
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files?limit=50');
      if (res.ok) {
        const data = await res.json();
        const fileData = data.data ?? data.files ?? [];
        setSourceFiles(
          fileData
            .filter((f: Record<string, unknown>) => f.status === '완료')
            .map((f: Record<string, unknown>) => ({
              id: f.id as string,
              name: (f.name as string) ?? '',
              type: (f.type as string) ?? 'FILE',
              department: (f.department as string) ?? '미분류',
              size: (f.size as string) ?? '',
              uploadDate: (f.uploadDate as string) ?? '',
              status: (f.status as string) ?? '',
            }))
        );
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadDocs();
    loadTemplates();
    loadFiles();
  }, [loadDocs, loadTemplates, loadFiles]);

  const resetModal = () => {
    setShowModal(false);
    setStep(1);
    setSelectedTemplate(null);
    setSelectedFiles(new Set());
    setInstructions('');
    setGenerating(false);
    setGeneratedDoc(null);
    setFileSearch('');
    setFileDeptFilter('전체');
    setFileTypeFilter('전체');
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

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate,
          sourceFileIds: Array.from(selectedFiles),
          instructions: instructions.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newDoc = data.document;
        if (newDoc) {
          setGeneratedDoc(newDoc);
          setDocs((prev) => [newDoc, ...prev]);
          setStep(5); // Show generated result
        }
      }
    } catch {
      // silent
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 문서를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      // silent
    }
  };

  const handleDownload = (doc: Document) => {
    const content = doc.content ?? `# ${doc.title}\n\n문서 내용이 여기에 표시됩니다.`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-[#e5e5e7] rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 bg-white rounded-2xl border border-[#e5e5e7]" />
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
          <h1 className="text-2xl font-bold text-[#1d1d1f]">문서 생성</h1>
          <p className="text-[#6e6e73] mt-1">AI를 활용하여 문서를 자동으로 생성하세요</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors shadow-sm"
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
          <div className="w-24 h-24 rounded-full bg-[#f5f5f7] flex items-center justify-center" style={{ marginBottom: 20 }}>
            <svg className="w-10 h-10 text-[#0071e3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#1d1d1f]" style={{ marginBottom: 20 }}>생성된 문서가 없습니다</h3>
          <p className="text-[#6e6e73] text-sm" style={{ marginBottom: 20 }}>새 문서 생성 버튼을 눌러 첫 문서를 만들어 보세요</p>
          <button onClick={() => setShowModal(true)} className="px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors">
            새 문서 생성
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl border border-[#e5e5e7] p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-[#1d1d1f] truncate pr-2">{d.title}</h3>
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[d.status]}`}>{d.status}</span>
              </div>
              <div className="space-y-2 text-sm text-[#6e6e73]">
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
              <div className="flex gap-2 mt-4 pt-3 border-t border-[#f5f5f7]">
                <button
                  onClick={() => setViewDoc(d)}
                  className="px-4 py-2 rounded-lg text-sm text-[#0071e3] hover:bg-[#f5f5f7] transition-colors"
                >
                  보기
                </button>
                <button
                  onClick={() => handleDownload(d)}
                  className="px-4 py-2 rounded-lg text-sm text-[#0071e3] hover:bg-[#f5f5f7] transition-colors"
                >
                  다운로드
                </button>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="px-4 py-2 rounded-lg text-sm text-[#ff3b30] hover:bg-[#f5f5f7] transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── View Document Modal ── */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-[#e5e5e7] flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-semibold text-[#1d1d1f]">{viewDoc.title}</h2>
                <div className="flex gap-2 mt-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[viewDoc.status]}`}>{viewDoc.status}</span>
                  <span className="text-xs text-[#6e6e73]">{viewDoc.createdAt}</span>
                </div>
              </div>
              <button onClick={() => setViewDoc(null)} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-6">
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
            </div>
            <div className="px-6 py-5 border-t border-[#e5e5e7] flex justify-end gap-3">
              <button
                onClick={() => handleDownload(viewDoc)}
                className="px-5 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
              >
                다운로드
              </button>
              <button onClick={() => setViewDoc(null)} className="px-6 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Document Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* modal header */}
            <div className="px-6 py-5 border-b border-[#e5e5e7] flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-semibold text-[#1d1d1f]">새 문서 생성</h2>
              <button onClick={resetModal} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* steps indicator */}
            {step <= 4 && (
              <div className="px-6 py-6">
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex items-center gap-2 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${step >= s ? 'bg-[#1d1d1f] text-white' : 'bg-[#f5f5f7] text-[#6e6e73]'}`}>
                        {step > s ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        ) : (
                          s
                        )}
                      </div>
                      {s < 4 && <div className={`h-0.5 flex-1 rounded ${step > s ? 'bg-[#1d1d1f]' : 'bg-[#e5e5e7]'}`} />}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-[#6e6e73] mt-2">
                  <span>템플릿 선택</span>
                  <span>소스 파일</span>
                  <span>추가 지시</span>
                  <span>확인</span>
                </div>
              </div>
            )}

            <div className="px-6 py-6">
              {/* Step 1: Select template */}
              {step === 1 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`p-5 rounded-xl border text-left transition-all ${selectedTemplate === t.id ? 'border-[#0071e3] bg-[#f5f5f7] ring-2 ring-[#0071e3]/30' : 'border-[#e5e5e7] hover:border-[#0071e3]'}`}
                    >
                      <span className="text-2xl">{TEMPLATE_ICONS[t.name] ?? '📄'}</span>
                      <h4 className="font-medium text-[#1d1d1f] text-sm mt-2">{t.name}</h4>
                      <p className="text-xs text-[#6e6e73] mt-1 line-clamp-2">{t.description}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2: Select source files */}
              {step === 2 && (() => {
                const FILE_TYPE_COLORS: Record<string, string> = {
                  PDF: 'bg-red-50 text-red-600',
                  DOCX: 'bg-blue-50 text-blue-600',
                  XLSX: 'bg-green-50 text-green-600',
                  PPTX: 'bg-orange-50 text-orange-600',
                  MD: 'bg-purple-50 text-purple-600',
                };
                const departments = Array.from(new Set(sourceFiles.map((f) => f.department)));
                const types = Array.from(new Set(sourceFiles.map((f) => f.type)));
                const filtered = sourceFiles.filter((f) => {
                  if (fileSearch && !f.name.toLowerCase().includes(fileSearch.toLowerCase())) return false;
                  if (fileDeptFilter !== '전체' && f.department !== fileDeptFilter) return false;
                  if (fileTypeFilter !== '전체' && f.type !== fileTypeFilter) return false;
                  return true;
                });

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[#6e6e73]">소스 파일을 선택하세요</p>
                      <span className="text-xs font-medium text-[#0071e3]">{selectedFiles.size}개 선택됨</span>
                    </div>

                    {/* 검색 */}
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                      </svg>
                      <input
                        value={fileSearch}
                        onChange={(e) => setFileSearch(e.target.value)}
                        placeholder="파일명 검색..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                      />
                    </div>

                    {/* 필터 */}
                    <div className="flex gap-2 flex-wrap">
                      <select
                        value={fileDeptFilter}
                        onChange={(e) => setFileDeptFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-[#e5e5e7] text-xs text-[#1d1d1f] bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                      >
                        <option value="전체">전체 부서</option>
                        {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <select
                        value={fileTypeFilter}
                        onChange={(e) => setFileTypeFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-[#e5e5e7] text-xs text-[#1d1d1f] bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                      >
                        <option value="전체">전체 타입</option>
                        {types.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {selectedFiles.size > 0 && (
                        <button
                          onClick={() => setSelectedFiles(new Set())}
                          className="px-3 py-1.5 rounded-lg text-xs text-[#ff3b30] hover:bg-red-50 transition-colors"
                        >
                          선택 해제
                        </button>
                      )}
                    </div>

                    {/* 파일 목록 */}
                    {sourceFiles.length === 0 ? (
                      <div className="text-center py-10">
                        <svg className="w-10 h-10 text-[#e5e5e7] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <p className="text-sm font-medium text-[#1d1d1f]">등록된 파일이 없습니다</p>
                        <p className="text-xs text-[#6e6e73] mt-1">파일 관리에서 먼저 파일을 업로드해 주세요</p>
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-[#6e6e73]">검색 결과가 없습니다</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {filtered.map((f) => (
                          <label
                            key={f.id}
                            className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${selectedFiles.has(f.id) ? 'border-[#0071e3] bg-[#f0f5ff]' : 'border-[#e5e5e7] hover:bg-[#f5f5f7]'}`}
                          >
                            <input type="checkbox" checked={selectedFiles.has(f.id)} onChange={() => toggleFile(f.id)} className="rounded border-[#e5e5e7] text-[#0071e3] focus:ring-[#0071e3] shrink-0" />
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${FILE_TYPE_COLORS[f.type] ?? 'bg-gray-50 text-gray-600'}`}>
                              {f.type}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#1d1d1f] truncate">{f.name}</p>
                              <p className="text-[11px] text-[#6e6e73] mt-0.5">{f.department} · {f.size} · {f.uploadDate}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Step 3: Instructions */}
              {step === 3 && (
                <div>
                  <p className="text-sm text-[#6e6e73] mb-4">추가 지시사항을 입력하세요 (선택)</p>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="예: 핵심 수치 위주로 요약해 주세요. 표 형태로 정리해 주세요."
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] resize-none"
                  />
                </div>
              )}

              {/* Step 4: Confirm */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="bg-[#f5f5f7] rounded-xl p-5 space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#6e6e73]">템플릿</span>
                      <span className="text-[#1d1d1f] font-medium">{templates.find((t) => t.id === selectedTemplate)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6e6e73]">소스 파일</span>
                      <span className="text-[#1d1d1f] font-medium">{selectedFiles.size}개</span>
                    </div>
                    {instructions && (
                      <div>
                        <span className="text-[#6e6e73]">추가 지시사항</span>
                        <p className="text-[#1d1d1f] mt-1">{instructions}</p>
                      </div>
                    )}
                  </div>
                  {generating && (
                    <div className="flex flex-col items-center py-6 gap-3">
                      <div className="w-8 h-8 border-3 border-[#e5e5e7] border-t-[#0071e3] rounded-full animate-spin" />
                      <p className="text-sm text-[#6e6e73]">AI가 문서를 생성하고 있습니다...</p>
                    </div>
                  )}
                  {!generating && (
                    <p className="text-xs text-[#6e6e73] text-center">생성 버튼을 누르면 AI가 문서를 생성합니다.</p>
                  )}
                </div>
              )}

              {/* Step 5: Generated result */}
              {step === 5 && generatedDoc && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-[#f5f5f7] border border-[#e5e5e7]">
                    <svg className="w-6 h-6 text-[#30d158] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div>
                      <h4 className="font-semibold text-[#1d1d1f]">문서가 생성되었습니다!</h4>
                      <p className="text-sm text-[#6e6e73]">{generatedDoc.title}</p>
                    </div>
                  </div>
                  <div className="bg-[#f5f5f7] rounded-xl p-4 max-h-60 overflow-y-auto">
                    <div className="text-sm text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">
                      {generatedDoc.content ?? '내용 없음'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* modal footer */}
            <div className="px-6 py-5 border-t border-[#e5e5e7] flex items-center justify-between sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => {
                  if (step === 1 || step === 5) resetModal();
                  else setStep(step - 1);
                }}
                className="px-5 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
              >
                {step === 1 || step === 5 ? '닫기' : '이전'}
              </button>
              {step < 4 && (
                <button
                  disabled={!canNext()}
                  onClick={() => setStep(step + 1)}
                  className="px-6 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              )}
              {step === 4 && (
                <button
                  disabled={generating}
                  onClick={handleGenerate}
                  className="px-6 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {generating ? '생성 중...' : '문서 생성'}
                </button>
              )}
              {step === 5 && (
                <button
                  onClick={() => {
                    if (generatedDoc) setViewDoc(generatedDoc);
                    resetModal();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors"
                >
                  문서 보기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
