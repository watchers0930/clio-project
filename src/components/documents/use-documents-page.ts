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
import { formatDateInput, validateDateInput } from '@/components/documents/date-input';
import { isWorklogTemplateName, WORKLOG_FIELDS } from '@/lib/templates/worklog';
import type { TemplateFieldDefinition } from '@/lib/templates/template-schema';
import { useDocumentViewerActions } from '@/components/documents/use-document-viewer-actions';
export {
  statusColor,
  statusDot,
  FONT_OPTIONS,
  DOWNLOAD_FORMAT_OPTIONS,
} from '@/components/documents/document-page-constants';

type AllowedOutputFormat = 'docx' | 'hwpx' | 'pdf' | 'xlsx' | 'pptx';

function getAllowedOutputFormats(templateFile: Template['templateFile'] | null | undefined, isContract: boolean): AllowedOutputFormat[] {
  if (isContract) return ['hwpx'];
  if (!templateFile?.name) return ['docx', 'pdf', 'xlsx', 'pptx'];

  const ext = templateFile.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'docx' || ext === 'dotx') return ['docx', 'pdf'];
  if (ext === 'hwpx' || ext === 'hwp') return ['hwpx', 'pdf'];
  if (ext === 'xlsx' || ext === 'xls') return ['xlsx'];
  if (ext === 'pptx' || ext === 'ppt') return ['pptx'];
  return ['docx', 'pdf', 'xlsx', 'pptx'];
}

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
  const [documentInputs, setDocumentInputs] = useState<Record<string, string>>({});
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [aiAssistPrompt, setAiAssistPrompt] = useState('');
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
  const [todoExtractOpen, setTodoExtractOpen] = useState(false);
  const [todoExtractInitial, setTodoExtractInitial] = useState<ExtractedTodo[]>([]);
  const [sttModalOpen, setSttModalOpen] = useState(false);
  const [versionPanelDocId, setVersionPanelDocId] = useState<string | null>(null);
  const [versionItems, setVersionItems] = useState<VersionItem[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [newVersionDocId, setNewVersionDocId] = useState<string | null>(null);
  const [originDocumentId, setOriginDocumentId] = useState<string | null>(null);
  const [originContext, setOriginContext] = useState<string | null>(null);
  const [creationContextTitle, setCreationContextTitle] = useState('');
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; description?: string; onConfirm: () => void }>({ open: false, title: '', onConfirm: () => {} });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [selectedFont, setSelectedFont] = useState('맑은 고딕');
  const [downloadFormat, setDownloadFormat] = useState<string>('docx');
  const [initializedFromQuery, setInitializedFromQuery] = useState(false);

  const openConfirm = (title: string, description: string | undefined, onConfirm: () => void) => setConfirmState({ open: true, title, description, onConfirm });
  const closeConfirm = () => setConfirmState((state) => ({ ...state, open: false }));
  const {
    viewDoc,
    editContent,
    editTitle,
    saving,
    qualityCheckDocId,
    showViewerComments,
    designPrompt,
    designPromptLang,
    loadingDesignPrompt,
    copiedDesignPrompt,
    isEdited,
    isDraft,
    setEditContent,
    setEditTitle,
    setQualityCheckDocId,
    setShowViewerComments,
    openDocModal,
    handleSave,
    handleComplete,
    handleRevertToDraft,
    handleDesignPrompt,
    handleCopyDesignPrompt,
    handleDownload,
    handleDownloadAiContext,
    handleViewerClose,
  } = useDocumentViewerActions({
    docs,
    setDocs,
    selectedFont,
    downloadFormat,
    toast,
    openConfirm,
    closeConfirm,
  });

  const handleDateInput = (key: string, raw: string) => {
    const formatted = formatDateInput(raw);
    setContractFormData((prev) => ({ ...prev, [key]: formatted }));
    validateDateInput(key, formatted, setDateErrors);
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
          templateMode: (template.templateMode as Template['templateMode']) ?? 'html-template',
          templateHtml: (template.templateHtml as string | undefined) ?? '',
          templateFile: (template.templateFile as TemplateFile | null) ?? null,
          templateFields: (template.templateFields as Template['templateFields']) ?? [],
          templateSections: (template.templateSections as Template['templateSections']) ?? [],
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

  useEffect(() => {
    if (initializedFromQuery || typeof window === 'undefined' || sourceFiles.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const shouldOpenCreate = params.get('create') === 'true';
    const selectedFileIds = params.get('files');
    const templateId = params.get('template');
    const initialInstructions = params.get('instructions');
    const versionOf = params.get('versionOf');
    const requestedOpenDocId = params.get('openDoc');
    const requestedOriginDocumentId = params.get('originDocumentId');
    const requestedOriginContext = params.get('originContext');
    const contextTitle = params.get('contextTitle');

    if (templateId) setSelectedTemplate(templateId);
    if (initialInstructions) setInstructions(initialInstructions);
    if (versionOf) setNewVersionDocId(versionOf);
    if (requestedOriginDocumentId) setOriginDocumentId(requestedOriginDocumentId);
    if (requestedOriginContext) setOriginContext(requestedOriginContext);

    if (selectedFileIds) {
      const nextSelectedFiles = new Set(
        selectedFileIds
          .split(',')
          .map((id) => id.trim())
          .filter((id) => sourceFiles.some((file) => file.id === id)),
      );
      if (nextSelectedFiles.size > 0) setSelectedFiles(nextSelectedFiles);
    }

    if (shouldOpenCreate) {
      setShowModal(true);
      if (templateId && selectedFileIds) setStep(3);
      else if (templateId) setStep(2);
      else setStep(1);
    }

    if (requestedOpenDocId) {
      const targetDoc = docs.find((doc) => doc.id === requestedOpenDocId);
      if (targetDoc) {
        openDocModal(targetDoc);
        params.delete('openDoc');
        const nextQuery = params.toString();
        router.replace(nextQuery ? `/documents?${nextQuery}` : '/documents');
      }
    }

    const relatedDocId = versionOf || requestedOriginDocumentId;
    if (contextTitle) {
      setCreationContextTitle(contextTitle);
    } else if (relatedDocId) {
      const relatedDoc = docs.find((doc) => doc.id === relatedDocId);
      if (relatedDoc) setCreationContextTitle(relatedDoc.title);
    }

    setInitializedFromQuery(true);
  }, [initializedFromQuery, sourceFiles, docs, router, openDocModal]);

  useEffect(() => {
    const selectedTemplateItem = templates.find((template) => template.id === selectedTemplate);
    const isContract = selectedTemplateItem ? isContractTemplate(selectedTemplateItem.name) : false;
    const allowedFormats = getAllowedOutputFormats(selectedTemplateItem?.templateFile, isContract);

    if (!allowedFormats.includes(outputFormat as AllowedOutputFormat)) {
      setOutputFormat(allowedFormats[0]);
    }
  }, [selectedTemplate, templates, outputFormat]);

  const resetModal = () => {
    setShowModal(false);
    setStep(1);
    setSelectedTemplate(null);
    setSelectedFiles(new Set());
    setInstructions('');
    setCustomStructure('');
    setAiAssistEnabled(false);
    setAiAssistPrompt('');
    const now = new Date();
    setDocumentInputs({
      report_title: '',
      subtitle: '',
      report_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    });
    setContractFormData({ signDate: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}` });
    setGenerating(false);
    setGeneratedDoc(null);
    setOutputFormat('docx');
    setGeneratedDownloadUrl(null);
    setGeneratedOutline(null);
    setFileSearch('');
    setFileDeptFilter('전체');
    setFileTypeFilter('전체');
    setNewVersionDocId(null);
    setOriginDocumentId(null);
    setOriginContext(null);
    setCreationContextTitle('');
  };

  const openCreateModal = () => { resetModal(); setShowModal(true); };
  const toggleFile = (id: string) => setSelectedFiles((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const canNext = () => {
    if (step === 1) return !!selectedTemplate;
    if (step === 3) {
      if (selectedTemplate === '__none__' && !customStructure.trim()) return false;
      const selectedTemplateItem = templates.find((template) => template.id === selectedTemplate);
      if (isWorklogTemplateName(selectedTemplateItem?.name)) {
        return ((selectedTemplateItem?.templateFields ?? [...WORKLOG_FIELDS]) as TemplateFieldDefinition[])
          .filter((field) => field.required)
          .filter((field) => !field.autoFill && !field.aiAssist)
          .every((field) => Boolean(documentInputs[field.key]?.trim()));
      }
      const hasTitle = Boolean(documentInputs.report_title?.trim());
      return hasTitle;
    }
    return true;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedDownloadUrl(null);
    setGeneratedOutline(null);
    try {
      const isCustom = selectedTemplate === '__none__';
      const finalInstructions = isCustom ? `## 문서 구조:\n${customStructure.trim()}\n\n${instructions.trim() ? `## 추가 지시사항:\n${instructions.trim()}` : ''}` : instructions.trim() || undefined;
      const selectedTemplateItem = templates.find((template) => template.id === selectedTemplate);
      const isContract = selectedTemplateItem ? isContractTemplate(selectedTemplateItem.name) : false;
      const allowedFormats = getAllowedOutputFormats(selectedTemplateItem?.templateFile, isContract);
      const actualFormat = allowedFormats.includes(outputFormat as AllowedOutputFormat) ? outputFormat : allowedFormats[0];
      if (actualFormat !== outputFormat) setOutputFormat(actualFormat);
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
          documentInputs,
          aiAssist: aiAssistEnabled,
          aiAssistPrompt: aiAssistPrompt.trim() || undefined,
          ...(isContract && Object.keys(contractFormData).length > 0 ? { contractFormData } : {}),
          ...(newVersionDocId ? { parentId: newVersionDocId } : {}),
          ...(originDocumentId ? { originDocumentId } : {}),
          ...(originContext ? { originContext } : {}),
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

  const startReuseDocument = (doc: Document) => {
    const params = new URLSearchParams({ create: 'true' });
    if (doc.templateId) params.set('template', doc.templateId);
    if ((doc.sourceFileIds ?? []).length > 0) params.set('files', (doc.sourceFileIds ?? []).join(','));
    params.set('instructions', `${doc.title} 문서를 참고해서 후속 문서를 작성하세요.`);
    params.set('originDocumentId', doc.id);
    params.set('originContext', 'document_followup');
    params.set('contextTitle', doc.title);
    router.push(`/documents?${params.toString()}`);
  };

  const openSearchFromDocument = (doc: Document) => {
    const params = new URLSearchParams({ q: doc.title });
    router.push(`/search?${params.toString()}`);
  };

  return {
    router, loading, docs, showModal, step, selectedTemplate, selectedFiles, instructions, customStructure, documentInputs, aiAssistEnabled, aiAssistPrompt, generating, generatedDoc, outputFormat, generatedDownloadUrl, generatedOutline, contractFormData, dateErrors, fileSearch, fileDeptFilter, fileTypeFilter, shareDocId, shareDocTitle, selectedDocIds, viewDoc, editContent, editTitle, saving, qualityCheckDocId, todoExtractOpen, todoExtractInitial, sttModalOpen, showViewerComments, versionPanelDocId, versionItems, versionLoading, confirmState, templates, sourceFiles, selectedFont, downloadFormat, designPrompt, designPromptLang, loadingDesignPrompt, copiedDesignPrompt, isEdited, isDraft, originDocumentId, originContext, creationContextTitle,
    loadDocs, setShareDocId, setShareDocTitle, setTodoExtractOpen, setTodoExtractInitial, setSttModalOpen, setShowViewerComments, setQualityCheckDocId, setVersionPanelDocId, setStep, setSelectedTemplate, setSelectedFiles, setInstructions, setCustomStructure, setDocumentInputs, setAiAssistEnabled, setAiAssistPrompt, setOutputFormat, setContractFormData, setFileSearch, setFileDeptFilter, setFileTypeFilter, setEditContent, setEditTitle, setDownloadFormat, setSelectedFont, resetModal, openCreateModal, toggleFile, canNext, handleGenerate, handleDelete, handleBulkDelete, handleDeleteAll, toggleDocSelect, toggleSelectAll, openVersionPanel, openDocModal, handleSave, handleComplete, handleRevertToDraft, handleDesignPrompt, handleCopyDesignPrompt, handleDownload, handleDownloadAiContext, handleViewerClose, handleDownloadGeneratedFile, handleDateInput, closeConfirm, startReuseDocument, openSearchFromDocument,
    handleVersionNew: (docId: string) => { setNewVersionDocId(docId); setVersionPanelDocId(null); openCreateModal(); },
  };
}
