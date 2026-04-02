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

interface TemplateFile {
  id: string;
  name: string;
  type: string;
  size: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  templateFile: TemplateFile | null;
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
  const [outputFormat, setOutputFormat] = useState<string>('docx');
  const [generatedDownloadUrl, setGeneratedDownloadUrl] = useState<string | null>(null);
  const [generatedOutline, setGeneratedOutline] = useState<Record<string, unknown> | null>(null);

  // Step 2: file search & filter
  const [fileSearch, setFileSearch] = useState('');
  const [fileDeptFilter, setFileDeptFilter] = useState('전체');
  const [fileTypeFilter, setFileTypeFilter] = useState('전체');

  // Bulk select
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // View/Edit modal state
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);

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
            templateFile: (t.templateFile as TemplateFile | null) ?? null,
          }))
        );
      }
    } catch {
      // silent
    }
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files?limit=500');
      if (res.ok) {
        const data = await res.json();
        const fileData = data.data ?? data.files ?? [];
        setSourceFiles(
          fileData
            .filter((f: Record<string, unknown>) => f.status !== '오류')
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
    setOutputFormat('docx');
    setGeneratedDownloadUrl(null);
    setGeneratedOutline(null);
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
    // Step 2: 파일 0개도 허용 (템플릿 양식만으로 생성 가능)
    return true;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedDownloadUrl(null);
    setGeneratedOutline(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate,
          sourceFileIds: Array.from(selectedFiles),
          instructions: instructions.trim() || undefined,
          outputFormat,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newDoc = data.document;
        if (newDoc) {
          setGeneratedDoc(newDoc);
          setDocs((prev) => [newDoc, ...prev]);
          if (data.downloadUrl) setGeneratedDownloadUrl(data.downloadUrl);
          if (data.outline) setGeneratedOutline(data.outline);
          setStep(5);
        }
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.error ?? '문서 생성에 실패했습니다. 다시 시도해 주세요.');
      }
    } catch {
      alert('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
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
        setSelectedDocIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      }
    } catch {
      // silent
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedDocIds.size;
    if (count === 0) return;
    if (!confirm(`선택된 ${count}개 문서를 삭제하시겠습니까?`)) return;
    const ids = Array.from(selectedDocIds);
    await Promise.all(ids.map((id) => fetch(`/api/documents?id=${id}`, { method: 'DELETE' })));
    setDocs((prev) => prev.filter((d) => !selectedDocIds.has(d.id)));
    setSelectedDocIds(new Set());
  };

  const handleDeleteAll = async () => {
    if (docs.length === 0) return;
    if (!confirm(`전체 ${docs.length}개 문서를 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    await Promise.all(docs.map((d) => fetch(`/api/documents?id=${d.id}`, { method: 'DELETE' })));
    setDocs([]);
    setSelectedDocIds(new Set());
  };

  const toggleDocSelect = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.size === docs.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(docs.map((d) => d.id)));
    }
  };

  const openDocModal = (doc: Document) => {
    setViewDoc(doc);
    setEditContent(doc.content ?? '');
    setEditTitle(doc.title);
  };

  const handleSave = async () => {
    if (!viewDoc) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${viewDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, title: editTitle }),
      });
      if (!res.ok) throw new Error();
      const updated = { ...viewDoc, content: editContent, title: editTitle };
      setViewDoc(updated);
      setDocs((prev) => prev.map((d) => d.id === viewDoc.id ? updated : d));
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!viewDoc || !confirm('문서를 최종 완료하시겠습니까?\n완료 후에도 초안으로 되돌릴 수 있습니다.')) return;
    setSaving(true);
    try {
      // 편집 내용이 있으면 함께 저장
      const body: Record<string, string> = { status: 'completed' };
      if (editContent !== viewDoc.content) body.content = editContent;
      if (editTitle !== viewDoc.title) body.title = editTitle;

      const res = await fetch(`/api/documents/${viewDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const updated = { ...viewDoc, ...body, status: '완료' as const, content: editContent, title: editTitle };
      setViewDoc(updated);
      setDocs((prev) => prev.map((d) => d.id === viewDoc.id ? updated : d));
    } catch {
      alert('상태 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevertToDraft = async () => {
    if (!viewDoc || !confirm('초안 상태로 되돌리시겠습니까?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${viewDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      });
      if (!res.ok) throw new Error();
      const updated = { ...viewDoc, status: '초안' as const };
      setViewDoc(updated);
      setDocs((prev) => prev.map((d) => d.id === viewDoc.id ? updated : d));
    } catch {
      alert('상태 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const isEdited = viewDoc ? (editContent !== (viewDoc.content ?? '') || editTitle !== viewDoc.title) : false;
  const isDraft = viewDoc?.status === '초안';

  const FONT_OPTIONS = ['맑은 고딕', '나눔고딕', '바탕', '돋움', '굴림', '나눔명조', 'Arial', 'Times New Roman'];
  const DOWNLOAD_FORMAT_OPTIONS = ['docx', 'hwpx', 'pdf'] as const;
  const [selectedFont, setSelectedFont] = useState('맑은 고딕');
  const [downloadFormat, setDownloadFormat] = useState<string>('docx');

  const handleDownload = async (doc: Document) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}/download?font=${encodeURIComponent(selectedFont)}&format=${downloadFormat}`);
      if (!res.ok) throw new Error('다운로드 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title}.${downloadFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('다운로드에 실패했습니다.');
    }
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
          <p className="text-[#6e6e73] mt-1" style={{ marginBottom: 10 }}>AI를 활용하여 문서를 자동으로 생성하세요</p>
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
        <>
          {/* Bulk actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#6e6e73]">
              <input
                type="checkbox"
                checked={docs.length > 0 && selectedDocIds.size === docs.length}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-[#e5e5e7] accent-[#0071e3]"
              />
              전체 선택
            </label>
            {selectedDocIds.size > 0 && (
              <button onClick={handleBulkDelete} className="px-4 py-1.5 rounded-lg text-sm text-[#ff3b30] border border-[#ff3b30] hover:bg-red-50 transition-colors">
                선택 삭제 ({selectedDocIds.size})
              </button>
            )}
            <button onClick={handleDeleteAll} className="px-4 py-1.5 rounded-lg text-sm text-[#6e6e73] border border-[#e5e5e7] hover:bg-[#f5f5f7] transition-colors">
              전체 삭제
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginTop: 20 }}>
            {docs.map((d) => (
              <div key={d.id} className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all ${selectedDocIds.has(d.id) ? 'border-[#0071e3] ring-1 ring-[#0071e3]' : 'border-[#e5e5e7]'}`}>
                <div className="flex items-start gap-3 mb-3">
                  <input
                    type="checkbox"
                    checked={selectedDocIds.has(d.id)}
                    onChange={() => toggleDocSelect(d.id)}
                    className="w-4 h-4 rounded border-[#e5e5e7] accent-[#0071e3] mt-1 shrink-0"
                  />
                  <h3 className="font-semibold text-[#1d1d1f] truncate flex-1">{d.title}</h3>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[d.status]}`}>{d.status}</span>
                </div>
                <div className="space-y-2 text-sm text-[#6e6e73] ml-7">
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
                <div className="flex gap-2 mt-4 pt-3 border-t border-[#f5f5f7] ml-7">
                  <button
                    onClick={() => openDocModal(d)}
                    className="px-4 py-2 rounded-lg text-sm text-[#0071e3] hover:bg-[#f5f5f7] transition-colors"
                  >
                    {d.status === '초안' ? '편집' : '보기'}
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
        </>
      )}

      {/* ── View/Edit Document Modal ── */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="view-doc-title" onKeyDown={(e) => { if (e.key === 'Escape' && !isEdited) setViewDoc(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#e5e5e7] flex items-center justify-between shrink-0">
              <div className="flex-1 min-w-0">
                {isDraft ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
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
              <button onClick={() => { if (isEdited && !confirm('수정 내용이 저장되지 않았습니다. 닫으시겠습니까?')) return; setViewDoc(null); }} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] ml-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {isDraft ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
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

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#e5e5e7] flex items-center justify-between shrink-0">
              <div>
                {isDraft ? (
                  <button onClick={handleComplete} disabled={saving} className="px-5 py-2.5 rounded-xl bg-[#30d158] text-white text-sm font-medium hover:bg-[#28b94c] disabled:opacity-50 transition-colors">
                    {saving ? '처리 중...' : '완료'}
                  </button>
                ) : (
                  <button onClick={handleRevertToDraft} disabled={saving} className="px-5 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] disabled:opacity-50 transition-colors">
                    초안으로 되돌리기
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                {isDraft && (
                  <button onClick={handleSave} disabled={saving || !isEdited} className="px-5 py-2.5 rounded-xl border border-[#0071e3] text-sm text-[#0071e3] font-medium hover:bg-[#f5f5f7] disabled:opacity-40 transition-colors">
                    {saving ? '저장 중...' : '저장'}
                  </button>
                )}
                <select value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value)} className="px-3 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] bg-white">
                  {DOWNLOAD_FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
                <select value={selectedFont} onChange={(e) => setSelectedFont(e.target.value)} className="px-3 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] bg-white">
                  {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <button onClick={() => handleDownload(viewDoc)} className="px-5 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">
                  다운로드
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Document Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-doc-title" onKeyDown={(e) => { if (e.key === 'Escape') resetModal(); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* modal header */}
            <div className="px-6 py-5 border-b border-[#e5e5e7] flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 id="new-doc-title" className="text-lg font-semibold text-[#1d1d1f]">새 문서 생성</h2>
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

            <div className="px-6 pt-2 pb-8">
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
                      {t.templateFile && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-blue-50 text-blue-600">{t.templateFile.type}</span>
                          <span className="text-[10px] text-[#6e6e73] truncate">{t.templateFile.name}</span>
                        </div>
                      )}
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
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[#6e6e73]">참조할 소스 파일을 선택하세요 (선택사항)</p>
                      <span className="text-xs font-medium text-[#0071e3]">{selectedFiles.size}개 선택됨</span>
                    </div>
                    {selectedFiles.size === 0 && (
                      <p className="text-xs text-[#ff9f0a] bg-[#fff8f0] px-3 py-2 rounded-lg">파일 없이도 템플릿 양식 기반으로 문서를 생성할 수 있습니다.</p>
                    )}

                    {/* 검색 */}
                    <div className="relative" style={{ marginTop: 10, marginBottom: 15 }}>
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

              {/* Step 3: Instructions + Output Format */}
              {step === 3 && (
                <div className="space-y-6">
                  {/* 출력 포맷 선택 */}
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1f] mb-3">출력 포맷</p>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { value: 'docx', label: 'DOCX', icon: '📝', desc: 'Word 문서' },
                        { value: 'pdf', label: 'PDF', icon: '📕', desc: 'PDF 문서' },
                        { value: 'hwpx', label: 'HWPX', icon: '📘', desc: '한글 문서' },
                        { value: 'xlsx', label: 'XLSX', icon: '📊', desc: 'Excel 보고서' },
                        { value: 'pptx', label: 'PPTX', icon: '📙', desc: '프레젠테이션' },
                      ].map((f) => (
                        <button
                          key={f.value}
                          onClick={() => setOutputFormat(f.value)}
                          className={`p-3 rounded-xl border text-center transition-all ${outputFormat === f.value ? 'border-[#0071e3] bg-[#f0f5ff] ring-2 ring-[#0071e3]/30' : 'border-[#e5e5e7] hover:border-[#0071e3]'}`}
                        >
                          <span className="text-xl">{f.icon}</span>
                          <p className="text-xs font-bold text-[#1d1d1f] mt-1">{f.label}</p>
                          <p className="text-[10px] text-[#6e6e73]">{f.desc}</p>
                        </button>
                      ))}
                    </div>
                    {(outputFormat === 'xlsx' || outputFormat === 'pptx') && (
                      <p className="text-xs text-[#0071e3] bg-[#f0f5ff] px-3 py-2 rounded-lg mt-2">
                        {outputFormat === 'xlsx' ? 'AI가 데이터 테이블을 구조화하여 Excel 파일로 생성합니다.' : 'AI가 슬라이드 구성을 자동으로 설계하여 PPT 파일로 생성합니다.'}
                      </p>
                    )}
                  </div>

                  {/* 추가 지시사항 */}
                  <div>
                    <p className="text-sm text-[#6e6e73] mb-3">추가 지시사항 (선택)</p>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="예: 핵심 수치 위주로 요약해 주세요. 표 형태로 정리해 주세요."
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] resize-none"
                    />
                  </div>
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
                    <div className="flex justify-between">
                      <span className="text-[#6e6e73]">출력 포맷</span>
                      <span className="text-[#1d1d1f] font-medium">{outputFormat.toUpperCase()}</span>
                    </div>
                    {instructions && (
                      <div>
                        <span className="text-[#6e6e73]">추가 지시사항</span>
                        <p className="text-[#1d1d1f] mt-1">{instructions}</p>
                      </div>
                    )}
                    {(() => {
                      const tmpl = templates.find((t) => t.id === selectedTemplate);
                      return tmpl?.templateFile ? (
                        <div className="flex items-center justify-between">
                          <span className="text-[#6e6e73]">표준양식</span>
                          <a
                            href={`/api/files/${tmpl.templateFile.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 text-[#0071e3] font-medium hover:underline"
                          >
                            <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-blue-50 text-blue-600">{tmpl.templateFile.type}</span>
                            {tmpl.templateFile.name}
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                          </a>
                        </div>
                      ) : null;
                    })()}
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
                      <h4 className="font-semibold text-[#1d1d1f]">{outputFormat.toUpperCase()} 문서가 생성되었습니다!</h4>
                      <p className="text-sm text-[#6e6e73]">{generatedDoc.title}</p>
                    </div>
                  </div>

                  {/* 마크다운 기반 포맷 미리보기 */}
                  {(outputFormat === 'docx' || outputFormat === 'pdf' || outputFormat === 'hwpx') && (
                    <div className="bg-[#f5f5f7] rounded-xl p-4 max-h-60 overflow-y-auto">
                      <div className="text-sm text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">
                        {generatedDoc.content ?? '내용 없음'}
                      </div>
                    </div>
                  )}

                  {/* XLSX 아웃라인 미리보기 */}
                  {outputFormat === 'xlsx' && generatedOutline && (generatedOutline as { sheets?: { sheetName: string; headers: string[]; rows: unknown[][] }[] }).sheets && (
                    <div className="bg-[#f5f5f7] rounded-xl p-4 max-h-60 overflow-y-auto space-y-3">
                      <p className="text-xs font-bold text-[#6e6e73] uppercase">Excel 아웃라인</p>
                      {((generatedOutline as { sheets: { sheetName: string; headers: string[]; rows: unknown[][] }[] }).sheets).map((sheet: { sheetName: string; headers: string[]; rows: unknown[][] }, idx: number) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-[#e5e5e7]">
                          <p className="text-sm font-medium text-[#1d1d1f]">{sheet.sheetName} ({sheet.rows?.length ?? 0}행)</p>
                          <p className="text-xs text-[#6e6e73] mt-1">컬럼: {sheet.headers?.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PPTX 아웃라인 미리보기 */}
                  {outputFormat === 'pptx' && generatedOutline && (generatedOutline as { slides?: { title: string; bullets?: string[] }[] }).slides && (
                    <div className="bg-[#f5f5f7] rounded-xl p-4 max-h-60 overflow-y-auto space-y-2">
                      <p className="text-xs font-bold text-[#6e6e73] uppercase">슬라이드 아웃라인</p>
                      {((generatedOutline as { slides: { title: string; bullets?: string[] }[] }).slides).map((slide: { title: string; bullets?: string[] }, idx: number) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-[#e5e5e7]">
                          <p className="text-sm font-medium text-[#1d1d1f]">{idx + 1}. {slide.title}</p>
                          {slide.bullets && (
                            <ul className="text-xs text-[#6e6e73] mt-1 ml-4 list-disc">
                              {slide.bullets.map((b: string, bi: number) => <li key={bi}>{b}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* XLSX/PPTX 직접 다운로드 버튼 */}
                  {generatedDownloadUrl && (
                    <a
                      href={generatedDownloadUrl}
                      download
                      className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0071e3] text-white text-sm font-medium hover:bg-[#005bb5] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      {outputFormat.toUpperCase()} 파일 다운로드
                    </a>
                  )}
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
                    if (generatedDoc) openDocModal(generatedDoc);
                    resetModal();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors"
                >
                  문서 편집
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
