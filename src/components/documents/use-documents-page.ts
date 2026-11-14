'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentItem as Document } from '@/components/documents/page-types';
import type { ExtractedTodo } from '@/lib/ai/extract-todos';
import { useToast } from '@/components/ui/toast';
import { formatDateInput, validateDateInput } from '@/components/documents/date-input';
import { isWorklogTemplateName, WORKLOG_FIELDS } from '@/lib/templates/worklog';
import type { TemplateFieldDefinition } from '@/lib/templates/template-schema';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useDocumentViewerActions } from '@/components/documents/use-document-viewer-actions';
import { useDocumentsData } from '@/components/documents/use-documents-data';
import { useDocumentGeneration } from '@/components/documents/use-document-generation';
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

export function useDocumentsPage() {
  const toast = useToast();
  const router = useRouter();
  const {
    docs, setDocs, loading, templates, sourceFiles, referenceDocuments, setReferenceDocuments,
    loadDocs, loadFiles, loadReferenceDocuments,
  } = useDocumentsData();
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [instructions, setInstructions] = useState('');
  const [customStructure, setCustomStructure] = useState('');
  const [documentInputs, setDocumentInputs] = useState<Record<string, string>>({});
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [aiAssistPrompt, setAiAssistPrompt] = useState('');
  const [outputFormat, setOutputFormat] = useState<string>('docx');
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
  const [selectedFont, setSelectedFont] = useState('맑은 고딕');
  const [downloadFormat, setDownloadFormat] = useState<string>('docx');
  const [initializedFromQuery, setInitializedFromQuery] = useState(false);
  const [leavePrefillDone, setLeavePrefillDone] = useState(false);

  const { confirmState, openConfirm, closeConfirm } = useConfirmDialog();
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

  const {
    generating, setGenerating, generatedDoc, setGeneratedDoc,
    generatedDownloadUrl, setGeneratedDownloadUrl, generatedDownloadMeta, setGeneratedDownloadMeta,
    generatedOutline, setGeneratedOutline, handleGenerate,
  } = useDocumentGeneration({
    selectedTemplate,
    customStructure,
    instructions,
    templates,
    outputFormat,
    setOutputFormat,
    selectedFiles,
    selectedFont,
    documentInputs,
    aiAssistEnabled,
    aiAssistPrompt,
    contractFormData,
    newVersionDocId,
    setNewVersionDocId,
    originDocumentId,
    originContext,
    referenceDocId,
    setDocs,
    setStep,
    toast,
  });

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
  // 버전 패널(useVersionPanel)이 이벤트 핸들러에서 최신 openCreateModal을 부르도록 렌더마다 갱신한다(HEAD와 동일 동작).
  // eslint-disable-next-line react-hooks/refs -- latest-ref 패턴. 렌더 중 읽지 않고 이벤트에서만 호출된다.
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
