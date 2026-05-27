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
  const [uploadingLocalFiles, setUploadingLocalFiles] = useState(false);
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
  const [referenceDocId, setReferenceDocId] = useState<string | null>(null);
  const [referenceDocuments, setReferenceDocuments] = useState<Document[]>([]);
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; description?: string; onConfirm: () => void }>({ open: false, title: '', onConfirm: () => {} });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [selectedFont, setSelectedFont] = useState('맑은 고딕');
  const [downloadFormat, setDownloadFormat] = useState<string>('docx');
  const [initializedFromQuery, setInitializedFromQuery] = useState(false);
  const [extractingFields, setExtractingFields] = useState(false);
  const [extractedFieldKeys, setExtractedFieldKeys] = useState<Set<string>>(new Set());

  const openConfirm = (title: string, description: string | undefined, onConfirm: () => void) => setConfirmState({ open: true, title, description, onConfirm });
  const closeConfirm = () => setConfirmState((state) => ({ ...state, open: false }));
  const {
    viewDoc,
    editContent,
    editTitle,
    saving,
    qualityCheckDocId,
    showViewerComments,
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

  const loadReferenceDocuments = useCallback(async (templateId: string) => {
    try {
      const res = await fetch(`/api/documents?templateId=${templateId}&status=completed&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setReferenceDocuments(data.documents ?? []);
      }
    } catch {
      setReferenceDocuments([]);
    }
  }, []);

  const uploadLocalFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingLocalFiles(true);
    try {
      const uploadedIds: string[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('scope', 'company');

        const res = await fetch('/api/files', { method: 'POST', body: formData });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.data?.id) {
          throw new Error(data?.error ?? `${file.name} 업로드 실패`);
        }
        uploadedIds.push(data.data.id as string);
      }

      await loadFiles();
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        uploadedIds.forEach((id) => next.add(id));
        return next;
      });
      toast.success(`${uploadedIds.length}개 파일을 업로드하고 참조문서로 선택했습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '로컬 파일 업로드에 실패했습니다.');
    } finally {
      setUploadingLocalFiles(false);
    }
  }, [loadFiles, toast]);

  useEffect(() => {
    loadDocs();
    loadTemplates();
    loadFiles();
  }, [loadDocs, loadTemplates, loadFiles]);

  useEffect(() => {
    if (viewDoc?.template === '제안서' && downloadFormat !== 'pdf') {
      setDownloadFormat('pdf');
    }
  }, [viewDoc?.template, downloadFormat]);

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

    // 제안서 템플릿 선택 시 참조 제안서 목록 로드
    if (selectedTemplate && selectedTemplateItem?.name === '제안서') {
      loadReferenceDocuments(selectedTemplate);
    } else {
      setReferenceDocuments([]);
      setReferenceDocId(null);
    }
  }, [selectedTemplate, templates, outputFormat, loadReferenceDocuments]);

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
    setReferenceDocId(null);
    setReferenceDocuments([]);
    setExtractedFieldKeys(new Set());
  };

  const extractFieldsFromSources = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    const selectedTemplateItem = templates.find((t) => t.id === selectedTemplate);
    if (!selectedTemplateItem) return;
    const resolvedFields = (selectedTemplateItem.templateFields
      ?? (isWorklogTemplateName(selectedTemplateItem.name) ? [...WORKLOG_FIELDS] : [
        { key: 'report_title', label: '문서 제목', type: 'text' as const, required: true, placeholder: '예: 2026년 2분기 사업 보고서' },
        { key: 'subtitle', label: '소제목', type: 'text' as const, placeholder: '예: 경영회의 보고용' },
      ])) as TemplateFieldDefinition[];

    const targetFields = resolvedFields.filter((f) => !f.autoFill && !f.aiAssist);
    if (targetFields.length === 0) return;

    setExtractingFields(true);
    try {
      const res = await fetch('/api/generate/extract-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFileIds: Array.from(selectedFiles),
          fields: targetFields.map((f) => ({ key: f.key, label: f.label, placeholder: f.placeholder })),
          templateName: selectedTemplateItem.name,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const extracted = (data.extractedInputs ?? {}) as Record<string, string>;
        const newKeys = new Set<string>();
        setDocumentInputs((prev) => {
          const next = { ...prev };
          for (const [key, value] of Object.entries(extracted)) {
            if (value && !prev[key]?.trim()) {
              next[key] = value;
              newKeys.add(key);
            }
          }
          return next;
        });
        setExtractedFieldKeys(newKeys);
      }
    } catch {
      // 추출 실패 시 무시 — 사용자가 수동 입력
    } finally {
      setExtractingFields(false);
    }
  }, [selectedFiles, templates, selectedTemplate]);

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
      const resolvedFields = ((selectedTemplateItem?.templateFields
        ?? (isWorklogTemplateName(selectedTemplateItem?.name) ? [...WORKLOG_FIELDS] : [
          { key: 'report_title', label: '문서 제목', type: 'text' as const, required: true, placeholder: '예: 2026년 2분기 사업 보고서' },
          { key: 'subtitle', label: '소제목', type: 'text' as const, placeholder: '예: 경영회의 보고용' },
        ])) as TemplateFieldDefinition[]);

      const requiredManualFields = resolvedFields
        .filter((field) => field.required)
        .filter((field) => !field.autoFill && !field.aiAssist);

      return requiredManualFields.every((field) => Boolean(documentInputs[field.key]?.trim()));
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
          ...(referenceDocId ? { referenceDocId } : {}),
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
    router, loading, docs, showModal, step, selectedTemplate, selectedFiles, instructions, customStructure, documentInputs, aiAssistEnabled, aiAssistPrompt, generating, generatedDoc, outputFormat, generatedDownloadUrl, generatedOutline, contractFormData, dateErrors, fileSearch, fileDeptFilter, fileTypeFilter, uploadingLocalFiles, shareDocId, shareDocTitle, selectedDocIds, viewDoc, editContent, editTitle, saving, qualityCheckDocId, todoExtractOpen, todoExtractInitial, sttModalOpen, showViewerComments, versionPanelDocId, versionItems, versionLoading, confirmState, templates, sourceFiles, selectedFont, downloadFormat, isEdited, isDraft, originDocumentId, originContext, creationContextTitle, referenceDocId, referenceDocuments, extractingFields, extractedFieldKeys,
    loadDocs, setShareDocId, setShareDocTitle, setTodoExtractOpen, setTodoExtractInitial, setSttModalOpen, setShowViewerComments, setQualityCheckDocId, setVersionPanelDocId, setStep, setSelectedTemplate, setSelectedFiles, setInstructions, setCustomStructure, setDocumentInputs, setAiAssistEnabled, setAiAssistPrompt, setOutputFormat, setContractFormData, setFileSearch, setFileDeptFilter, setFileTypeFilter, setEditContent, setEditTitle, setDownloadFormat, setSelectedFont, resetModal, openCreateModal, toggleFile, canNext, handleGenerate, handleDelete, handleBulkDelete, handleDeleteAll, toggleDocSelect, toggleSelectAll, openVersionPanel, openDocModal, handleSave, handleComplete, handleRevertToDraft, handleDownload, handleDownloadAiContext, handleViewerClose, handleDownloadGeneratedFile, handleDateInput, closeConfirm, startReuseDocument, openSearchFromDocument, uploadLocalFiles, setReferenceDocId, extractFieldsFromSources,
    handleVersionNew: (docId: string) => { setNewVersionDocId(docId); setVersionPanelDocId(null); openCreateModal(); },
  };
}
