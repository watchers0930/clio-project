'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isContractTemplate } from '@/lib/contract-fields';
import type {
  DocumentItem as Document,
  SourceFile,
  TemplateItem as Template,
  TemplateFile,
  VersionItem,
} from '@/components/documents/page-types';
import type { ExtractedTodo } from '@/lib/ai/extract-todos';
import { useToast } from '@/components/ui/toast';

export const statusColor: Record<string, string> = {
  초안: 'bg-[#2E6FF2]/8 text-[#2E6FF2]',
  완료: 'bg-[#1A5AD9]/8 text-[#1A5AD9]',
};

export const statusDot: Record<string, string> = {
  초안: '#2E6FF2',
  완료: '#1A5AD9',
};

export const FONT_OPTIONS = ['맑은 고딕', '나눔고딕', '바탕', '돋움', '굴림', '나눔명조', 'Arial', 'Times New Roman'];
export const DOWNLOAD_FORMAT_OPTIONS = ['docx', 'hwpx', 'pdf'] as const;

export function useDocumentsPage() {
  const toast = useToast();
  const router = useRouter();
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
  const [fileSearch, setFileSearch] = useState('');
  const [fileDeptFilter, setFileDeptFilter] = useState('전체');
  const [fileTypeFilter, setFileTypeFilter] = useState('전체');
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const [shareDocTitle, setShareDocTitle] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [qualityCheckDocId, setQualityCheckDocId] = useState<string | null>(null);
  const [todoExtractOpen, setTodoExtractOpen] = useState(false);
  const [todoExtractInitial, setTodoExtractInitial] = useState<ExtractedTodo[]>([]);
  const [sttModalOpen, setSttModalOpen] = useState(false);
  const [showViewerComments, setShowViewerComments] = useState(false);
  const [versionPanelDocId, setVersionPanelDocId] = useState<string | null>(null);
  const [versionItems, setVersionItems] = useState<VersionItem[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [newVersionDocId, setNewVersionDocId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; description?: string; onConfirm: () => void }>({ open: false, title: '', onConfirm: () => {} });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [selectedFont, setSelectedFont] = useState('맑은 고딕');
  const [downloadFormat, setDownloadFormat] = useState<string>('docx');
  const [designPrompt, setDesignPrompt] = useState<string | null>(null);
  const [designPromptLang, setDesignPromptLang] = useState<'ko' | 'en'>('ko');
  const [loadingDesignPrompt, setLoadingDesignPrompt] = useState(false);
  const [copiedDesignPrompt, setCopiedDesignPrompt] = useState(false);

  const openConfirm = (title: string, description: string | undefined, onConfirm: () => void) => setConfirmState({ open: true, title, description, onConfirm });
  const closeConfirm = () => setConfirmState((state) => ({ ...state, open: false }));

  const validateDate = (key: string, value: string) => {
    if (!value) {
      setDateErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (!match) {
      if (value.replace(/[\d/]/g, '').length > 0 || value.length >= 10) {
        setDateErrors((prev) => ({ ...prev, [key]: 'yyyy/mm/dd 형식으로 입력하세요' }));
      }
      return;
    }
    const [, y, m, d] = match;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    if (month < 1 || month > 12) return void setDateErrors((prev) => ({ ...prev, [key]: '월은 01~12 사이여야 합니다' }));
    const lastDay = new Date(year, month, 0).getDate();
    if (day < 1 || day > lastDay) return void setDateErrors((prev) => ({ ...prev, [key]: `${month}월은 ${lastDay}일까지입니다` }));
    if (year < 2000 || year > 2099) return void setDateErrors((prev) => ({ ...prev, [key]: '연도는 2000~2099 사이여야 합니다' }));
    setDateErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleDateInput = (key: string, raw: string) => {
    const digits = raw.replace(/[^\d]/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 4)}/${digits.slice(4)}`;
    if (digits.length > 6) formatted = `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6)}`;
    setContractFormData((prev) => ({ ...prev, [key]: formatted }));
    validateDate(key, formatted);
  };

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        const templateData = data.data ?? data.templates ?? [];
        setTemplates(templateData.map((template: Record<string, unknown>) => ({
          id: template.id as string,
          name: template.name as string,
          description: template.description as string,
          templateFile: (template.templateFile as TemplateFile | null) ?? null,
        })));
      }
    } catch {
    }
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files?limit=500');
      if (res.ok) {
        const data = await res.json();
        const fileData = data.data ?? data.files ?? [];
        setSourceFiles(fileData.filter((file: Record<string, unknown>) => file.status !== '오류').map((file: Record<string, unknown>) => ({
          id: file.id as string,
          name: (file.name as string) ?? '',
          type: (file.type as string) ?? 'FILE',
          department: (file.department as string) ?? '미분류',
          size: (file.size as string) ?? '',
          uploadDate: (file.uploadDate as string) ?? '',
          status: (file.status as string) ?? '',
        })));
      }
    } catch {
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
    setContractFormData({ signDate: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}` });
    setGenerating(false);
    setGeneratedDoc(null);
    setOutputFormat('docx');
    setGeneratedDownloadUrl(null);
    setGeneratedOutline(null);
    setFileSearch('');
    setFileDeptFilter('전체');
    setFileTypeFilter('전체');
  };

  const openCreateModal = () => { resetModal(); setShowModal(true); };
  const toggleFile = (id: string) => setSelectedFiles((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const canNext = () => step === 1 ? !!selectedTemplate : !(step === 3 && selectedTemplate === '__none__' && !customStructure.trim());

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedDownloadUrl(null);
    setGeneratedOutline(null);
    try {
      const isCustom = selectedTemplate === '__none__';
      const finalInstructions = isCustom ? `## 문서 구조:\n${customStructure.trim()}\n\n${instructions.trim() ? `## 추가 지시사항:\n${instructions.trim()}` : ''}` : instructions.trim() || undefined;
      const selectedTemplateItem = templates.find((template) => template.id === selectedTemplate);
      const isContract = selectedTemplateItem ? isContractTemplate(selectedTemplateItem.name) : false;
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
          ...(newVersionDocId ? { parentId: newVersionDocId } : {}),
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        toast.error(errorData?.error ?? '문서 생성에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
      const data = await res.json();
      const newDoc = data.document as Document | undefined;
      if (!newDoc) return;
      setGeneratedDoc(newDoc);
      setDocs((prev) => [newDoc, ...prev]);
      if (data.downloadUrl) setGeneratedDownloadUrl(data.downloadUrl);
      if (data.outline) setGeneratedOutline(data.outline);
      if (data.format) setOutputFormat(data.format);
      setNewVersionDocId(null);
      setStep(5);
    } catch {
      toast.error('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = (id: string) => openConfirm('이 문서를 삭제하시겠습니까?', '이 작업은 되돌릴 수 없습니다.', async () => {
    closeConfirm();
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocs((prev) => prev.filter((doc) => doc.id !== id));
        setSelectedDocIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      }
    } catch {
    }
  });

  const handleBulkDelete = () => {
    const count = selectedDocIds.size;
    if (count === 0) return;
    openConfirm(`${count}개 문서 삭제`, '선택된 문서를 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.', async () => {
      closeConfirm();
      const ids = Array.from(selectedDocIds);
      await Promise.all(ids.map((id) => fetch(`/api/documents?id=${id}`, { method: 'DELETE' })));
      setDocs((prev) => prev.filter((doc) => !selectedDocIds.has(doc.id)));
      setSelectedDocIds(new Set());
    });
  };

  const handleDeleteAll = () => {
    if (docs.length === 0) return;
    openConfirm(`전체 ${docs.length}개 문서 삭제`, '모든 문서를 삭제합니다. 이 작업은 되돌릴 수 없습니다.', async () => {
      closeConfirm();
      await Promise.all(docs.map((doc) => fetch(`/api/documents?id=${doc.id}`, { method: 'DELETE' })));
      setDocs([]);
      setSelectedDocIds(new Set());
    });
  };

  const toggleDocSelect = (id: string) => setSelectedDocIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleSelectAll = () => setSelectedDocIds(selectedDocIds.size === docs.length ? new Set() : new Set(docs.map((doc) => doc.id)));

  const openVersionPanel = async (docId: string) => {
    setVersionPanelDocId(docId);
    setVersionLoading(true);
    setVersionItems([]);
    try {
      const res = await fetch(`/api/documents/${docId}/versions`);
      const data = await res.json();
      setVersionItems(data.versions ?? []);
    } catch {
    }
    setVersionLoading(false);
  };

  const openDocModal = (doc: Document) => {
    setViewDoc(doc);
    setEditContent(doc.content ?? '');
    setEditTitle(doc.title);
    setShowViewerComments(false);
    setDesignPrompt(null);
    setCopiedDesignPrompt(false);
  };

  const handleSave = async () => {
    if (!viewDoc) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${viewDoc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: editContent, title: editTitle }) });
      if (!res.ok) throw new Error();
      const updated = { ...viewDoc, content: editContent, title: editTitle };
      setViewDoc(updated);
      setDocs((prev) => prev.map((doc) => doc.id === viewDoc.id ? updated : doc));
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = () => {
    if (!viewDoc) return;
    openConfirm('문서 완료', '문서를 최종 완료 상태로 변경합니다. 완료 후에도 초안으로 되돌릴 수 있습니다.', async () => {
      closeConfirm();
      if (!viewDoc) return;
      setSaving(true);
      try {
        const body: Record<string, string> = { status: 'completed' };
        if (editContent !== viewDoc.content) body.content = editContent;
        if (editTitle !== viewDoc.title) body.title = editTitle;
        const res = await fetch(`/api/documents/${viewDoc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error();
        const updated = { ...viewDoc, ...body, status: '완료' as const, content: editContent, title: editTitle };
        setViewDoc(updated);
        setDocs((prev) => prev.map((doc) => doc.id === viewDoc.id ? updated : doc));
      } catch {
        toast.error('상태 변경에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleRevertToDraft = () => {
    if (!viewDoc) return;
    openConfirm('초안으로 되돌리기', '문서를 초안 상태로 되돌립니다.', async () => {
      closeConfirm();
      if (!viewDoc) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/documents/${viewDoc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'draft' }) });
        if (!res.ok) throw new Error();
        const updated = { ...viewDoc, status: '초안' as const };
        setViewDoc(updated);
        setDocs((prev) => prev.map((doc) => doc.id === viewDoc.id ? updated : doc));
      } catch {
        toast.error('상태 변경에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    });
  };

  const isEdited = viewDoc ? editContent !== (viewDoc.content ?? '') || editTitle !== viewDoc.title : false;
  const isDraft = viewDoc?.status === '초안';

  const handleDesignPrompt = async (lang: 'ko' | 'en') => {
    if (!viewDoc) return;
    setLoadingDesignPrompt(true);
    setDesignPrompt(null);
    setDesignPromptLang(lang);
    setCopiedDesignPrompt(false);
    try {
      const res = await fetch(`/api/documents/${viewDoc.id}/design-prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang }) });
      if (res.ok) {
        const data = await res.json();
        setDesignPrompt(data.prompt);
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error ?? '프롬프트 생성 실패');
      }
    } catch {
      toast.error('네트워크 오류');
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
        const res = await fetch(`/api/documents/${doc.id}/download?font=${encodeURIComponent(selectedFont)}&format=pdf`);
        if (!res.ok) throw new Error('다운로드 실패');
        const htmlContent = await res.text();
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.onload = () => { setTimeout(() => printWindow.print(), 300); };
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
      toast.error('다운로드에 실패했습니다.');
    }
  };

  const handleDownloadAiContext = async (docId: string, lang: 'ko' | 'en') => {
    try {
      const res = await fetch(`/api/documents/${docId}/ai-context`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang }) });
      if (!res.ok) {
        toast.error(lang === 'ko' ? '다운로드 실패' : 'Download failed');
        return;
      }
      const { context, fileName } = await res.json();
      const blob = new Blob([context], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(lang === 'ko' ? '다운로드 실패' : 'Download failed');
    }
  };

  const handleViewerClose = () => {
    if (isEdited) {
      openConfirm('저장하지 않고 닫기', '수정 내용이 저장되지 않았습니다. 닫으시겠습니까?', () => {
        closeConfirm();
        setViewDoc(null);
        setShowViewerComments(false);
      });
      return;
    }
    setViewDoc(null);
    setShowViewerComments(false);
  };

  const handleDownloadGeneratedFile = async () => {
    if (!generatedDoc || !generatedDownloadUrl) return;
    try {
      const res = await fetch(generatedDownloadUrl);
      if (!res.ok) throw new Error('다운로드 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = (generatedDownloadUrl.split('?')[0] ?? '').split('.').pop() || outputFormat;
      a.download = `${generatedDoc.title}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('다운로드에 실패했습니다.');
    }
  };

  return {
    router, loading, docs, showModal, step, selectedTemplate, selectedFiles, instructions, customStructure, generating, generatedDoc, outputFormat, generatedDownloadUrl, generatedOutline, contractFormData, dateErrors, fileSearch, fileDeptFilter, fileTypeFilter, shareDocId, shareDocTitle, selectedDocIds, viewDoc, editContent, editTitle, saving, qualityCheckDocId, todoExtractOpen, todoExtractInitial, sttModalOpen, showViewerComments, versionPanelDocId, versionItems, versionLoading, confirmState, templates, sourceFiles, selectedFont, downloadFormat, designPrompt, designPromptLang, loadingDesignPrompt, copiedDesignPrompt, isEdited, isDraft,
    loadDocs, setShareDocId, setShareDocTitle, setTodoExtractOpen, setTodoExtractInitial, setSttModalOpen, setShowViewerComments, setQualityCheckDocId, setVersionPanelDocId, setStep, setSelectedTemplate, setSelectedFiles, setInstructions, setCustomStructure, setOutputFormat, setContractFormData, setFileSearch, setFileDeptFilter, setFileTypeFilter, setEditContent, setEditTitle, setDownloadFormat, setSelectedFont, resetModal, openCreateModal, toggleFile, canNext, handleGenerate, handleDelete, handleBulkDelete, handleDeleteAll, toggleDocSelect, toggleSelectAll, openVersionPanel, openDocModal, handleSave, handleComplete, handleRevertToDraft, handleDesignPrompt, handleCopyDesignPrompt, handleDownload, handleDownloadAiContext, handleViewerClose, handleDownloadGeneratedFile, handleDateInput, closeConfirm,
    handleVersionNew: (docId: string) => { setNewVersionDocId(docId); setVersionPanelDocId(null); openCreateModal(); },
  };
}
