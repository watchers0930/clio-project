'use client';

import { useState, useEffect, useCallback } from 'react';
import { isContractTemplate, getContractSchema, type ContractField } from '@/lib/contract-fields';

/* ────────────────────────── types ────────────────────────── */
interface Document {
  id: string;
  title: string;
  template: string;
  createdAt: string;
  status: '초안' | '완료' | '결재중' | '승인됨' | '반려됨';
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
  '결재중': 'bg-[#2E6FF2]/10 text-[#2E6FF2]',
  '승인됨': 'bg-[#30d158]/10 text-[#30d158]',
  '반려됨': 'bg-[#ff3b30]/10 text-[#ff3b30]',
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
  const [customStructure, setCustomStructure] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<Document | null>(null);
  const [outputFormat, setOutputFormat] = useState<string>('docx');
  const [generatedDownloadUrl, setGeneratedDownloadUrl] = useState<string | null>(null);
  const [generatedOutline, setGeneratedOutline] = useState<Record<string, unknown> | null>(null);
  const [contractFormData, setContractFormData] = useState<Record<string, string>>({});
  const [dateErrors, setDateErrors] = useState<Record<string, string>>({});

  // 날짜 유효성 검증 (yyyy/mm/dd)
  const validateDate = (key: string, val: string) => {
    if (!val) { setDateErrors(prev => { const n = { ...prev }; delete n[key]; return n; }); return; }
    const m = val.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (!m) {
      if (val.replace(/[\d/]/g, '').length > 0 || val.length >= 10) {
        setDateErrors(prev => ({ ...prev, [key]: 'yyyy/mm/dd 형식으로 입력하세요' }));
      }
      return;
    }
    const [, ys, ms, ds] = m;
    const y = parseInt(ys), mo = parseInt(ms), d = parseInt(ds);
    if (mo < 1 || mo > 12) { setDateErrors(prev => ({ ...prev, [key]: '월은 01~12 사이여야 합니다' })); return; }
    const lastDay = new Date(y, mo, 0).getDate();
    if (d < 1 || d > lastDay) { setDateErrors(prev => ({ ...prev, [key]: `${mo}월은 ${lastDay}일까지입니다` })); return; }
    if (y < 2000 || y > 2099) { setDateErrors(prev => ({ ...prev, [key]: '연도는 2000~2099 사이여야 합니다' })); return; }
    setDateErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  // 날짜 자동 포맷 (숫자 입력 → yyyy/mm/dd 자동 슬래시)
  const handleDateInput = (key: string, raw: string) => {
    const digits = raw.replace(/[^\d]/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + '/' + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + '/' + digits.slice(4, 6) + '/' + digits.slice(6);
    setContractFormData(prev => ({ ...prev, [key]: formatted }));
    validateDate(key, formatted);
  };

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

  // 결재 요청 모달
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalUsers, setApprovalUsers] = useState<Array<{ id: string; name: string; email: string; department?: string }>>([]);
  const [approvalSearch, setApprovalSearch] = useState('');
  const [selectedApprover, setSelectedApprover] = useState<string | null>(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);

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
    setCustomStructure('');
    const now = new Date();
    const todayFormatted = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    setContractFormData({ signDate: todayFormatted });
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
    if (step === 3 && selectedTemplate === '__none__' && !customStructure.trim()) return false;
    return true;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedDownloadUrl(null);
    setGeneratedOutline(null);
    try {
      const isCustom = selectedTemplate === '__none__';
      const finalInstructions = isCustom
        ? `## 문서 구조:\n${customStructure.trim()}\n\n${instructions.trim() ? `## 추가 지시사항:\n${instructions.trim()}` : ''}`
        : instructions.trim() || undefined;

      // 계약서 여부 판별
      const selTmplObj = templates.find(t => t.id === selectedTemplate);
      const isContract = selTmplObj ? isContractTemplate(selTmplObj.name) : false;
      if (isContract) setOutputFormat('hwpx');
      const actualFormat = isContract ? 'hwpx' : outputFormat;

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: isCustom ? undefined : selectedTemplate,
          sourceFileIds: Array.from(selectedFiles),
          instructions: finalInstructions,
          outputFormat: actualFormat,
          font: selectedFont,
          customStructure: isCustom ? customStructure.trim() : undefined,
          ...(isContract && Object.keys(contractFormData).length > 0 ? { contractFormData } : {}),
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
          if (data.format) setOutputFormat(data.format);
          if (data.mode) console.log('[생성 모드]', data.mode);
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
    setDesignPrompt(null);
    setCopiedDesignPrompt(false);
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

  const openApprovalModal = async () => {
    setShowApprovalModal(true);
    setSelectedApprover(null);
    setApprovalSearch('');
    try {
      const res = await fetch('/api/users');
      const d = await res.json();
      if (d.success) {
        const currentUser = JSON.parse(localStorage.getItem('clio_user') ?? '{}');
        setApprovalUsers((d.data ?? []).filter((u: { id: string }) => u.id !== currentUser.id));
      }
    } catch {}
  };

  const handleSubmitApproval = async () => {
    if (!viewDoc || !selectedApprover) return;
    setSubmittingApproval(true);
    try {
      const res = await fetch(`/api/documents/${viewDoc.id}/submit-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId: selectedApprover }),
      });
      const d = await res.json();
      if (d.success) {
        const updated = { ...viewDoc, status: '결재중' as const };
        setViewDoc(updated);
        setDocs((prev) => prev.map((doc) => doc.id === viewDoc.id ? updated : doc));
        setShowApprovalModal(false);
      } else {
        alert(d.error ?? '결재 요청 실패');
      }
    } catch {
      alert('서버 오류');
    }
    setSubmittingApproval(false);
  };

  const isEdited = viewDoc ? (editContent !== (viewDoc.content ?? '') || editTitle !== viewDoc.title) : false;
  const isDraft = viewDoc?.status === '초안';
  const isRejected = viewDoc?.status === '반려됨';

  const FONT_OPTIONS = ['맑은 고딕', '나눔고딕', '바탕', '돋움', '굴림', '나눔명조', 'Arial', 'Times New Roman'];
  const DOWNLOAD_FORMAT_OPTIONS = ['docx', 'hwpx', 'pdf'] as const;
  const [selectedFont, setSelectedFont] = useState('맑은 고딕');
  const [downloadFormat, setDownloadFormat] = useState<string>('docx');

  // 제안서 디자인 프롬프트
  const [designPrompt, setDesignPrompt] = useState<string | null>(null);
  const [designPromptLang, setDesignPromptLang] = useState<'ko' | 'en'>('ko');
  const [loadingDesignPrompt, setLoadingDesignPrompt] = useState(false);
  const [copiedDesignPrompt, setCopiedDesignPrompt] = useState(false);

  const isProposal = viewDoc?.template === '제안서';

  const handleDesignPrompt = async (lang: 'ko' | 'en') => {
    if (!viewDoc) return;
    setLoadingDesignPrompt(true);
    setDesignPrompt(null);
    setDesignPromptLang(lang);
    setCopiedDesignPrompt(false);
    try {
      const res = await fetch(`/api/documents/${viewDoc.id}/design-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang }),
      });
      if (res.ok) {
        const data = await res.json();
        setDesignPrompt(data.prompt);
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error ?? '프롬프트 생성 실패');
      }
    } catch {
      alert('네트워크 오류');
    } finally {
      setLoadingDesignPrompt(false);
    }
  };

  const handleCopyDesignPrompt = async () => {
    if (!designPrompt) return;
    await navigator.clipboard.writeText(designPrompt);
    setCopiedDesignPrompt(true);
    setTimeout(() => setCopiedDesignPrompt(false), 2000);
  };

  const handleDownload = async (doc: Document) => {
    try {
      if (downloadFormat === 'pdf') {
        // PDF: 서버에서 print-ready HTML을 받아 새 창에서 인쇄(PDF 저장)
        const res = await fetch(`/api/documents/${doc.id}/download?font=${encodeURIComponent(selectedFont)}&format=pdf`);
        if (!res.ok) throw new Error('다운로드 실패');
        const htmlContent = await res.text();
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.onload = () => {
            setTimeout(() => printWindow.print(), 300);
          };
        }
        return;
      }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          onClick={() => { const n = new Date(); setContractFormData({ signDate: `${n.getFullYear()}/${String(n.getMonth()+1).padStart(2,'0')}/${String(n.getDate()).padStart(2,'0')}` }); setShowModal(true); }}
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
          <button onClick={() => { const n = new Date(); setContractFormData({ signDate: `${n.getFullYear()}/${String(n.getMonth()+1).padStart(2,'0')}/${String(n.getDate()).padStart(2,'0')}` }); setShowModal(true); }} className="px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ marginTop: 20 }}>
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
                <div className="flex gap-2 mt-4 pt-3 border-t border-[#f5f5f7] ml-7 flex-wrap">
                  {d.status === '완료' && (
                    <button
                      onClick={() => { openDocModal(d); setTimeout(() => openApprovalModal(), 100); }}
                      className="px-4 py-2 rounded-lg text-sm text-white bg-[#2E6FF2] hover:bg-[#1a5ad9] transition-colors"
                    >
                      결재 요청
                    </button>
                  )}
                  <button
                    onClick={() => openDocModal(d)}
                    className="px-4 py-2 rounded-lg text-sm text-[#0071e3] hover:bg-[#f5f5f7] transition-colors"
                  >
                    {d.status === '초안' ? '편집' : '보기'}
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="px-4 py-2 rounded-lg text-sm text-[#ff3b30] hover:bg-[#f5f5f7] transition-colors"
                  >
                    삭제
                  </button>
                  <button
                    onClick={() => handleDownload(d)}
                    className="px-4 py-2 rounded-lg text-sm text-[#0071e3] hover:bg-[#f5f5f7] transition-colors"
                  >
                    다운로드
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-8 py-6 border-b border-[#e5e5e7] flex items-center justify-between shrink-0">
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
            <div className="flex-1 overflow-y-auto px-8 py-6">
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

            {/* 제안서 디자인 프롬프트 */}
            {isProposal && (
              <div className="px-8 py-5 border-t border-[#e5e5e7] shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-medium text-[#1d1d1f]">AI 디자인 프롬프트</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[#0071e3] to-[#5856d6] text-white font-medium">GenSpark / Gamma / Canva</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDesignPrompt('ko')}
                    disabled={loadingDesignPrompt}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-[#0071e3] text-[#0071e3] hover:bg-[#f0f5ff] disabled:opacity-50 transition-colors"
                  >
                    {loadingDesignPrompt && designPromptLang === 'ko' ? '생성 중...' : '국문 프롬프트'}
                  </button>
                  <button
                    onClick={() => handleDesignPrompt('en')}
                    disabled={loadingDesignPrompt}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-[#5856d6] text-[#5856d6] hover:bg-[#f5f0ff] disabled:opacity-50 transition-colors"
                  >
                    {loadingDesignPrompt && designPromptLang === 'en' ? 'Generating...' : 'English Prompt'}
                  </button>
                </div>
                {designPrompt && (
                  <div className="mt-3">
                    <div className="bg-[#f5f5f7] rounded-xl p-4 max-h-40 overflow-y-auto">
                      <pre className="text-xs text-[#1d1d1f] whitespace-pre-wrap leading-relaxed font-sans">{designPrompt}</pre>
                    </div>
                    <button
                      onClick={handleCopyDesignPrompt}
                      className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#1d1d1f] text-white hover:bg-[#0071e3] transition-colors flex items-center gap-2"
                    >
                      {copiedDesignPrompt ? (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                          복사 완료!
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                          클립보드에 복사
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 제안서 AI 컨텍스트 다운로드 */}
            {isProposal && (
              <div className="px-8 py-5 border-t border-[#e5e5e7] shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-medium text-[#1d1d1f]">AI 컨텍스트 다운로드</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[#34c759] to-[#30d158] text-white font-medium">ChatGPT / Gemini / Claude</span>
                </div>
                <p className="text-xs text-[#6e6e73] mb-3">다른 AI 도구에서 활용할 수 있는 컨텍스트 파일을 다운로드합니다.</p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/documents/${viewDoc!.id}/ai-context`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ lang: 'ko' }),
                        });
                        if (!res.ok) { alert('생성 실패'); return; }
                        const { context, fileName } = await res.json();
                        const blob = new Blob([context], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = fileName; a.click();
                        URL.revokeObjectURL(url);
                      } catch { alert('다운로드 실패'); }
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-[#34c759] text-[#34c759] hover:bg-[#f0faf2] transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                    국문 다운로드
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/documents/${viewDoc!.id}/ai-context`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ lang: 'en' }),
                        });
                        if (!res.ok) { alert('Failed'); return; }
                        const { context, fileName } = await res.json();
                        const blob = new Blob([context], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = fileName; a.click();
                        URL.revokeObjectURL(url);
                      } catch { alert('Download failed'); }
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-[#30d158] text-[#30d158] hover:bg-[#f0faf2] transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                    English Download
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-8 py-5 border-t border-[#e5e5e7] flex items-center justify-between shrink-0">
              <div className="flex gap-2">
                {isDraft && (
                  <button onClick={handleComplete} disabled={saving} className="px-5 py-2.5 rounded-xl bg-[#30d158] text-white text-sm font-medium hover:bg-[#28b94c] disabled:opacity-50 transition-colors">
                    {saving ? '처리 중...' : '완료'}
                  </button>
                )}
                {viewDoc?.status === '완료' && (
                  <>
                    <button onClick={openApprovalModal} className="px-5 py-2.5 rounded-xl bg-[#2E6FF2] text-white text-sm font-medium hover:bg-[#1a5ad9] transition-colors">
                      결재 요청
                    </button>
                    <button onClick={handleRevertToDraft} disabled={saving} className="px-5 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] disabled:opacity-50 transition-colors">
                      초안으로 되돌리기
                    </button>
                  </>
                )}
                {viewDoc?.status === '결재중' && (
                  <span className="px-5 py-2.5 rounded-xl bg-[#2E6FF2]/10 text-[#2E6FF2] text-sm font-medium">
                    결재 진행 중
                  </span>
                )}
                {viewDoc?.status === '승인됨' && (
                  <span className="px-5 py-2.5 rounded-xl bg-[#30d158]/10 text-[#30d158] text-sm font-medium">
                    승인 완료
                  </span>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* modal header */}
            <div className="px-8 py-6 border-b border-[#e5e5e7] flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 id="new-doc-title" className="text-lg font-semibold text-[#1d1d1f]">새 문서 생성</h2>
              <button onClick={resetModal} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* steps indicator */}
            {step <= 4 && (
              <div className="px-8 py-6">
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

            <div className="px-8 py-6">
              {/* Step 1: Select template */}
              {step === 1 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {/* 템플릿 없이 생성 */}
                  <button
                    onClick={() => { setSelectedTemplate('__none__'); setCustomStructure(''); }}
                    className={`p-5 rounded-xl border text-left transition-all ${selectedTemplate === '__none__' ? 'border-[#0071e3] bg-[#f5f5f7] ring-2 ring-[#0071e3]/30' : 'border-dashed border-[#d1d1d6] hover:border-[#0071e3]'}`}
                  >
                    <span className="text-2xl">✏️</span>
                    <h4 className="font-medium text-[#1d1d1f] text-sm mt-2">직접 작성</h4>
                    <p className="text-xs text-[#6e6e73] mt-1">문서 구조를 직접 입력하여 생성</p>
                  </button>
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
                    <div className="flex gap-2 flex-wrap" style={{ marginBottom: 10 }}>
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
                      <div className="max-h-80 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {filtered.map((f) => (
                          <label
                            key={f.id}
                            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${selectedFiles.has(f.id) ? 'border-[#0071e3] bg-[#f0f5ff]' : 'border-[#e5e5e7] hover:bg-[#f5f5f7]'}`}
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

              {/* Step 3: Instructions + Output Format / 계약서 입력 폼 */}
              {step === 3 && (() => {
                const selTmpl = templates.find(t => t.id === selectedTemplate);
                const contractSchema = selTmpl ? getContractSchema(selTmpl.name) : null;

                // ── 계약서 입력 폼 ──
                if (contractSchema) {
                  const groups = [...new Set(contractSchema.fields.map(f => f.group))];
                  return (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-[#f0f5ff] border border-[#d0e2ff]">
                        <svg className="w-5 h-5 text-[#0071e3] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                        <div>
                          <p className="text-sm font-semibold text-[#1d1d1f]">계약서 자동 작성</p>
                          <p className="text-xs text-[#6e6e73]">아래 항목을 입력하면 표준계약서 양식에 자동으로 반영됩니다. AI 토큰을 사용하지 않습니다.</p>
                        </div>
                      </div>
                      {groups.map(group => {
                        const fields = contractSchema.fields.filter(f => f.group === group);
                        return (
                          <div key={group}>
                            <h4 className="text-sm font-semibold text-[#1d1d1f] mb-3 flex items-center gap-2" style={{ marginTop: 10 }}>
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3]" />
                              {group}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4" style={{ marginBottom: 10 }}>
                              {fields.map(field => (
                                <div key={field.key} className={field.half ? '' : 'md:col-span-2'} style={{ paddingTop: 5, paddingBottom: 15 }}>
                                  <label className="block text-xs text-[#6e6e73]" style={{ marginBottom: 8 }}>
                                    {field.label} {field.required && <span className="text-[#ff3b30]">*</span>}
                                  </label>
                                  {field.type === 'address' ? (
                                    <div
                                      onClick={() => {
                                        const script = document.createElement('script');
                                        script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
                                        script.onload = () => {
                                          new (window as unknown as Record<string, unknown>).daum.Postcode({
                                            oncomplete: (data: { address: string; zonecode: string }) => {
                                              setContractFormData(prev => ({
                                                ...prev,
                                                [field.key]: `(${data.zonecode}) ${data.address}`,
                                              }));
                                            },
                                          }).open();
                                        };
                                        if ((window as unknown as Record<string, unknown>).daum) {
                                          new (window as unknown as Record<string, unknown>).daum.Postcode({
                                            oncomplete: (data: { address: string; zonecode: string }) => {
                                              setContractFormData(prev => ({
                                                ...prev,
                                                [field.key]: `(${data.zonecode}) ${data.address}`,
                                              }));
                                            },
                                          }).open();
                                        } else {
                                          document.head.appendChild(script);
                                        }
                                      }}
                                      className="w-full px-4 py-2.5 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-sm cursor-pointer hover:border-[#0071e3] transition-colors flex items-center gap-2"
                                    >
                                      {contractFormData[field.key] ? (
                                        <span className="text-[#1d1d1f]">{contractFormData[field.key]}</span>
                                      ) : (
                                        <span className="text-[#c7c7cc] flex items-center gap-1.5">
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                                          클릭하여 주소 검색
                                        </span>
                                      )}
                                    </div>
                                  ) : field.placeholder === 'yyyy/mm/dd' ? (
                                    <>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={contractFormData[field.key] ?? ''}
                                        onChange={(e) => handleDateInput(field.key, e.target.value)}
                                        placeholder="yyyy/mm/dd"
                                        maxLength={10}
                                        className={`w-full px-4 py-2.5 rounded-xl border text-sm text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none focus:ring-2 transition-shadow ${dateErrors[field.key] ? 'border-[#ff3b30] focus:ring-[#ff3b30]/30 bg-[#fff5f5]' : 'border-[#e5e5e7] focus:ring-[#0071e3] bg-white'}`}
                                      />
                                      {dateErrors[field.key] && (
                                        <p className="text-[11px] text-[#ff3b30] mt-0.5">{dateErrors[field.key]}</p>
                                      )}
                                    </>
                                  ) : (
                                    <input
                                      type="text"
                                      inputMode={field.type === 'number' ? 'numeric' : undefined}
                                      value={field.type === 'number' && contractFormData[field.key]
                                        ? Number(contractFormData[field.key]).toLocaleString('ko-KR')
                                        : (contractFormData[field.key] ?? '')}
                                      onChange={(e) => {
                                        let val = e.target.value;
                                        if (field.type === 'number') val = val.replace(/[^0-9]/g, '');
                                        setContractFormData(prev => {
                                          const next = { ...prev, [field.key]: val };
                                          // 계약금액 입력 시 공급가액/부가세 자동 계산
                                          if (field.key === 'totalAmount' && val) {
                                            const total = Number(val);
                                            next.supplyAmount = String(Math.round(total / 1.1));
                                            next.vatAmount = String(total - Math.round(total / 1.1));
                                          }
                                          return next;
                                        });
                                      }}
                                      placeholder={field.placeholder}
                                      className="w-full px-4 py-2.5 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-shadow"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // ── 일반 문서 (기존 UI) ──
                return (
                  <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
                    <div className="space-y-5">
                      <div>
                        <p className="text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 10 }}>출력 포맷</p>
                        <div className="grid grid-cols-3 gap-2">
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
                    </div>
                    <div className="space-y-5">
                      <div className="flex flex-col h-full">
                        <p className="text-sm text-[#6e6e73]" style={{ marginBottom: 10 }}>추가 지시사항 (선택)</p>
                        <textarea
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          placeholder="예: 핵심 수치 위주로 요약해 주세요. 표 형태로 정리해 주세요."
                          rows={14}
                          className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] resize-none"
                        />
                      </div>
                      {selectedTemplate === '__none__' && (
                        <div>
                          <p className="text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 5 }}>문서 구조 *</p>
                          <p className="text-xs text-[#6e6e73]" style={{ marginBottom: 8 }}>AI가 이 구조를 따라 문서를 생성합니다</p>
                          <textarea
                            value={customStructure}
                            onChange={(e) => setCustomStructure(e.target.value)}
                            placeholder={"예:\n# 업무일지\n## 오늘의 업무\n- 주요 업무 내용 1\n- 주요 업무 내용 2\n## 문제점 및 해결 방안\n## 내일의 계획"}
                            rows={6}
                            className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] resize-none font-mono"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Step 4: Confirm */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="bg-[#f5f5f7] rounded-xl p-6 space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#6e6e73]">템플릿</span>
                      <span className="text-[#1d1d1f] font-medium">{selectedTemplate === '__none__' ? '직접 작성' : templates.find((t) => t.id === selectedTemplate)?.name}</span>
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

                  {/* 파일 다운로드 버튼 */}
                  {generatedDownloadUrl && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(generatedDownloadUrl);
                          if (!res.ok) throw new Error('다운로드 실패');
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          const dlExt = (generatedDownloadUrl?.split('?')[0] ?? '').split('.').pop() || outputFormat;
                          a.download = `${generatedDoc?.title ?? '문서'}.${dlExt}`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch { alert('다운로드에 실패했습니다.'); }
                      }}
                      className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0071e3] text-white text-sm font-medium hover:bg-[#005bb5] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      {outputFormat.toUpperCase()} 파일 다운로드
                    </button>
                  )}

                  {/* 제안서 AI 컨텍스트 다운로드 (Step 5) */}
                  {templates.find(t => t.id === selectedTemplate)?.name === '제안서' && generatedDoc?.id && (
                    <div className="mt-4 p-4 rounded-xl bg-[#f0faf2] border border-[#d1f0d9]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-[#1d1d1f]">AI 컨텍스트 다운로드</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[#34c759] to-[#30d158] text-white font-medium">ChatGPT / Gemini / Claude</span>
                      </div>
                      <p className="text-xs text-[#6e6e73] mb-3">다른 AI 도구에서 활용할 수 있는 컨텍스트 파일</p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/documents/${generatedDoc!.id}/ai-context`, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ lang: 'ko' }),
                              });
                              if (!res.ok) { alert('생성 실패'); return; }
                              const { context, fileName } = await res.json();
                              const blob = new Blob([context], { type: 'text/plain;charset=utf-8' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
                              URL.revokeObjectURL(url);
                            } catch { alert('다운로드 실패'); }
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#34c759] text-[#34c759] hover:bg-white transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                          국문
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/documents/${generatedDoc!.id}/ai-context`, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ lang: 'en' }),
                              });
                              if (!res.ok) { alert('Failed'); return; }
                              const { context, fileName } = await res.json();
                              const blob = new Blob([context], { type: 'text/plain;charset=utf-8' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
                              URL.revokeObjectURL(url);
                            } catch { alert('Download failed'); }
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#30d158] text-[#30d158] hover:bg-white transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                          English
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* modal footer */}
            <div className="px-8 py-5 border-t border-[#e5e5e7] flex items-center justify-between sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => {
                  if (step === 1 || step === 5) resetModal();
                  else setStep(step - 1);
                }}
                className="px-6 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
              >
                {step === 1 || step === 5 ? '닫기' : '이전'}
              </button>
              {step < 4 && (
                <button
                  disabled={!canNext()}
                  onClick={() => setStep(step + 1)}
                  className="px-7 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              )}
              {step === 4 && (
                <button
                  disabled={generating}
                  onClick={handleGenerate}
                  className="px-7 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                  className="px-7 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors"
                >
                  문서 편집
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ────── 결재 요청 모달 ────── */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" style={{ padding: '28px 32px' }}>
            <h3 className="text-[16px] font-semibold text-[#1B1F2B] mb-5">결재자 선택</h3>

            <input
              type="text"
              placeholder="이름 또는 이메일 검색..."
              value={approvalSearch}
              onChange={(e) => setApprovalSearch(e.target.value)}
              className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/30 focus:border-[#2E6FF2] mb-3"
            />

            <div className="max-h-[240px] overflow-y-auto border border-[#E2E5EA] rounded-lg">
              {approvalUsers
                .filter((u) => {
                  if (!approvalSearch) return true;
                  const q = approvalSearch.toLowerCase();
                  return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                })
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedApprover(u.id)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-[#E2E5EA] last:border-0 transition-colors ${
                      selectedApprover === u.id ? 'bg-[#2E6FF2]/5' : 'hover:bg-[#f9fafb]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#2E6FF2]/10 flex items-center justify-center text-[12px] font-semibold text-[#2E6FF2] flex-shrink-0">
                      {u.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1B1F2B]">{u.name}</p>
                      <p className="text-[11px] text-[#7C8494] truncate">{u.email}{u.department ? ` · ${u.department}` : ''}</p>
                    </div>
                    {selectedApprover === u.id && (
                      <svg className="w-5 h-5 text-[#2E6FF2] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              {approvalUsers.length === 0 && (
                <p className="text-center py-6 text-[13px] text-[#7C8494]">사용자가 없습니다.</p>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 text-[13px] text-[#7C8494] hover:text-[#1B1F2B] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmitApproval}
                disabled={!selectedApprover || submittingApproval}
                className="px-5 py-2 text-[13px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1a5ad9] disabled:opacity-40 transition-colors"
              >
                {submittingApproval ? '요청 중...' : '결재 요청'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
