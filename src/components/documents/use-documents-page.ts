'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isContractTemplate } from '@/lib/contract-fields';
import type {
  DocumentItem as Document,
  SourceFile,
  TemplateItem as Template,
  TemplateFile,
} from '@/components/documents/page-types';
import type { ExtractedTodo } from '@/lib/ai/extract-todos';
import { useToast } from '@/components/ui/toast';
import { formatDateInput, validateDateInput } from '@/components/documents/date-input';
import { isWorklogTemplateName, WORKLOG_FIELDS } from '@/lib/templates/worklog';
import type { TemplateFieldDefinition } from '@/lib/templates/template-schema';
import { useDocumentViewerActions } from '@/components/documents/use-document-viewer-actions';
import { csrfFetch } from '@/hooks/csrf-client';
import { getAllowedOutputFormats, type AllowedOutputFormat } from '@/components/documents/document-output-formats';
import { useVersionPanel } from '@/components/documents/use-version-panel';
import { useDocumentDeletion } from '@/components/documents/use-document-deletion';
import { useFileUpload } from '@/components/documents/use-file-upload';
import { useGeneratedFileDownload } from '@/components/documents/use-generated-file-download';
import { useTemplateFieldDefaults } from '@/components/documents/use-template-field-defaults';
import { useFieldExtraction } from '@/components/documents/use-field-extraction';
export {
  statusColor,
  statusDot,
  FONT_OPTIONS,
  DOWNLOAD_FORMAT_OPTIONS,
} from '@/components/documents/document-page-constants';
import { TEMPLATE_DISPLAY_ORDER } from '@/components/documents/document-page-constants';

type GeneratedDownloadMeta = {
  fileName: string | null;
  extension: string | null;
  mimeType: string | null;
};

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
  const [generatedDownloadMeta, setGeneratedDownloadMeta] = useState<GeneratedDownloadMeta>({
    fileName: null,
    extension: null,
    mimeType: null,
  });
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
  const [leavePrefillDone, setLeavePrefillDone] = useState(false);

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
    handleSaveInputs,
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
        // 새 문서 생성에서 노출할 템플릿 (DB 데이터는 보존)
        const ALLOWED_TEMPLATES = ['재직증명서', '회의록', '휴가원', '품의서', '표준근로계약서', '주간업무'];
        const mapped = templateData
          .filter((template: Record<string, unknown>) => ALLOWED_TEMPLATES.includes(template.name as string))
          .map((template: Record<string, unknown>) => ({
            id: template.id as string,
            name: template.name as string,
            description: template.description as string,
            templateMode: (template.templateMode as Template['templateMode']) ?? 'html-template',
            templateHtml: (template.templateHtml as string | undefined) ?? '',
            templateFile: (template.templateFile as TemplateFile | null) ?? null,
            templateFields: (template.templateFields as Template['templateFields']) ?? [],
            templateSections: (template.templateSections as Template['templateSections']) ?? [],
          }));
        mapped.sort((a: { name: string }, b: { name: string }) => {
          const ai = TEMPLATE_DISPLAY_ORDER.indexOf(a.name);
          const bi = TEMPLATE_DISPLAY_ORDER.indexOf(b.name);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        setTemplates(mapped);
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

  const { uploadingLocalFiles, uploadLocalFiles, toggleFile } = useFileUpload({
    selectedFiles,
    setSelectedFiles,
    loadFiles,
    toast,
  });

  const openCreateModalRef = useRef<() => void>(() => {});
  const { versionPanelDocId, versionItems, versionLoading, newVersionDocId, setVersionPanelDocId, setNewVersionDocId, openVersionPanel, handleVersionNew } = useVersionPanel({
    openCreateModal: () => openCreateModalRef.current(),
  });

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
    // 근태 휴가원 작성 흐름(templateName 기반)은 아래 전용 effect가 처리한다.
    const shouldOpenCreate = params.get('create') === 'true' && !params.get('templateName');
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

  // 근태 '휴가원 작성' 진입(F02): 템플릿 ID 대신 templateName으로 들어오므로
  // 로드된 템플릿에서 이름으로 실제 ID를 찾아 선택하고, 신청 내용을 문서 입력에
  // 프리필한다. 이 값들(leave_type·기간·반차·사유)은 서버가 생성 문서를 기존
  // 휴가 초안에 자동 연결할 때의 매칭 키이므로, 누락 시 중복 초안이 생성될 수 있다.
  useEffect(() => {
    if (leavePrefillDone || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const templateName = params.get('templateName');
    if (!templateName) {
      setLeavePrefillDone(true);
      return;
    }
    if (templates.length === 0) return; // 템플릿 로드 대기
    const matched = templates.find((template) => template.name === templateName);
    if (matched) {
      setSelectedTemplate(matched.id);
      const prefill: Record<string, string> = {};
      for (const key of ['leave_type', 'leave_start_date', 'leave_end_date', 'half_day_slot', 'leave_reason']) {
        const value = params.get(key);
        if (value) prefill[key] = value;
      }
      if (Object.keys(prefill).length > 0) {
        setDocumentInputs((prev) => ({ ...prev, ...prefill }));
      }
      setShowModal(true);
      setStep(2); // 템플릿 선택 완료 → 입력 단계로 진입
    }
    setLeavePrefillDone(true);
  }, [leavePrefillDone, templates]);

  const { resetDefaults } = useTemplateFieldDefaults({
    selectedTemplate,
    templates,
    outputFormat,
    documentInputs,
    setDocumentInputs,
    setOutputFormat,
    loadReferenceDocuments,
    setReferenceDocuments,
    setReferenceDocId,
  });

  const resetModal = () => {
    setShowModal(false);
    setStep(1);
    setSelectedTemplate(null);
    resetDefaults();
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
    setGeneratedDownloadMeta({ fileName: null, extension: null, mimeType: null });
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

  const { extractingFields, extractedFieldKeys, setExtractedFieldKeys, extractFieldsFromSources } = useFieldExtraction({
    selectedFiles,
    templates,
    selectedTemplate,
    setDocumentInputs,
    toast,
  });

  const openCreateModal = () => { resetModal(); setShowModal(true); };
  openCreateModalRef.current = openCreateModal;

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
    setGeneratedDownloadMeta({ fileName: null, extension: null, mimeType: null });
    setGeneratedOutline(null);
    try {
      const isCustom = selectedTemplate === '__none__';
      const finalInstructions = isCustom ? `## 문서 구조:\n${customStructure.trim()}\n\n${instructions.trim() ? `## 추가 지시사항:\n${instructions.trim()}` : ''}` : instructions.trim() || undefined;
      const selectedTemplateItem = templates.find((template) => template.id === selectedTemplate);
      const isContract = selectedTemplateItem ? isContractTemplate(selectedTemplateItem.name) : false;
      const allowedFormats = getAllowedOutputFormats(selectedTemplateItem?.templateFile, isContract, selectedTemplateItem?.templateMode, selectedTemplateItem?.name);
      const actualFormat = allowedFormats.includes(outputFormat as AllowedOutputFormat) ? outputFormat : allowedFormats[0];
      if (actualFormat !== outputFormat) setOutputFormat(actualFormat);
      const res = await csrfFetch('/api/generate', {
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
      setGeneratedDownloadMeta({
        fileName: typeof data.downloadFileName === 'string' ? data.downloadFileName : null,
        extension: typeof data.downloadExtension === 'string' ? data.downloadExtension : null,
        mimeType: typeof data.downloadMimeType === 'string' ? data.downloadMimeType : null,
      });
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

  const { handleDelete, handleBulkDelete, handleDeleteAll, toggleDocSelect, toggleSelectAll } = useDocumentDeletion({
    docs,
    setDocs,
    selectedDocIds,
    setSelectedDocIds,
    openConfirm,
    closeConfirm,
    toast,
  });

  const { handleDownloadGeneratedFile } = useGeneratedFileDownload({
    generatedDoc,
    generatedDownloadUrl,
    generatedDownloadMeta,
    outputFormat,
    toast,
  });

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
    router, loading, docs, showModal, step, selectedTemplate, selectedFiles, instructions, customStructure, documentInputs, aiAssistEnabled, aiAssistPrompt, generating, generatedDoc, outputFormat, generatedDownloadUrl, generatedDownloadMeta, generatedOutline, contractFormData, dateErrors, fileSearch, fileDeptFilter, fileTypeFilter, uploadingLocalFiles, shareDocId, shareDocTitle, selectedDocIds, viewDoc, editContent, editTitle, saving, qualityCheckDocId, todoExtractOpen, todoExtractInitial, sttModalOpen, showViewerComments, versionPanelDocId, versionItems, versionLoading, confirmState, templates, sourceFiles, selectedFont, downloadFormat, isEdited, isDraft, originDocumentId, originContext, creationContextTitle, referenceDocId, referenceDocuments, extractingFields, extractedFieldKeys,
    loadDocs, setShareDocId, setShareDocTitle, setTodoExtractOpen, setTodoExtractInitial, setSttModalOpen, setShowViewerComments, setQualityCheckDocId, setVersionPanelDocId, setStep, setSelectedTemplate, setSelectedFiles, setInstructions, setCustomStructure, setDocumentInputs, setAiAssistEnabled, setAiAssistPrompt, setOutputFormat, setContractFormData, setFileSearch, setFileDeptFilter, setFileTypeFilter, setEditContent, setEditTitle, setDownloadFormat, setSelectedFont, resetModal, openCreateModal, toggleFile, canNext, handleGenerate, handleDelete, handleBulkDelete, handleDeleteAll, toggleDocSelect, toggleSelectAll, openVersionPanel, openDocModal, handleSave, handleSaveInputs, handleComplete, handleRevertToDraft, handleDownload, handleDownloadAiContext, handleViewerClose, handleDownloadGeneratedFile, handleDateInput, closeConfirm, startReuseDocument, openSearchFromDocument, uploadLocalFiles, setReferenceDocId, extractFieldsFromSources,
    handleVersionNew,
  };
}
