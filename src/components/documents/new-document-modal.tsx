import { getContractSchema } from '@/lib/contract-fields';
import type { DocumentItem, SourceFile, TemplateItem } from '@/components/documents/page-types';
import { isWorklogTemplateName, WORKLOG_FIELDS } from '@/lib/templates/worklog';
import { NewDocumentGeneralStep } from '@/components/documents/new-document-general-step';
import { TEMPLATE_ICONS } from '@/components/documents/document-page-constants';
import { originContextLabel } from '@/lib/documents/origin-context';
import { renderProposalDocumentHtml } from '@/lib/templates/proposal-render';
import { NewDocumentSourceStep } from '@/components/documents/new-document-source-step';
import { NewDocumentContractStep } from '@/components/documents/new-document-contract-step';
import { NewDocumentConfirmStep } from '@/components/documents/new-document-confirm-step';
import { NewDocumentResultStep } from '@/components/documents/new-document-result-step';

function getAllowedOutputFormats(templateFile: TemplateItem['templateFile'] | null, isContract: boolean, templateMode?: string, templateName?: string) {
  if (isContract) return ['hwpx'] as const;
  if (templateName && /재직\s*증명서/.test(templateName)) return ['pdf'] as const;
  if (templateMode === 'html-template') return ['docx', 'pdf'] as const;
  if (!templateFile?.name) return ['docx', 'pdf', 'xlsx', 'pptx'] as const;

  const ext = templateFile.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'docx' || ext === 'dotx') return ['docx', 'pdf'] as const;
  if (ext === 'hwpx' || ext === 'hwp') return ['hwpx', 'pdf'] as const;
  if (ext === 'xlsx' || ext === 'xls') return ['xlsx'] as const;
  if (ext === 'pptx' || ext === 'ppt') return ['pptx'] as const;
  return ['docx', 'pdf', 'xlsx', 'pptx'] as const;
}

interface NewDocumentModalProps {
  open: boolean;
  step: number;
  selectedTemplate: string | null;
  selectedFiles: Set<string>;
  instructions: string;
  customStructure: string;
  documentInputs: Record<string, string>;
  aiAssistEnabled: boolean;
  aiAssistPrompt: string;
  generating: boolean;
  generatedDoc: DocumentItem | null;
  outputFormat: string;
  generatedDownloadUrl: string | null;
  generatedDownloadMeta: {
    fileName: string | null;
    extension: string | null;
    mimeType: string | null;
  };
  generatedOutline: Record<string, unknown> | null;
  contractFormData: Record<string, string>;
  dateErrors: Record<string, string>;
  fileSearch: string;
  fileDeptFilter: string;
  fileTypeFilter: string;
  uploadingLocalFiles: boolean;
  templates: TemplateItem[];
  sourceFiles: SourceFile[];
  originDocumentId: string | null;
  originContext: string | null;
  creationContextTitle: string;
  referenceDocId: string | null;
  referenceDocuments: DocumentItem[];
  extractingFields: boolean;
  extractedFieldKeys: Set<string>;
  onSetReferenceDocId: (id: string | null) => void;
  onExtractFieldsFromSources: () => Promise<void>;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
  onGenerate: () => void;
  onOpenGeneratedDocument: (doc: DocumentItem) => void;
  onSetSelectedTemplate: (value: string | null) => void;
  onToggleFile: (id: string) => void;
  onClearSelectedFiles: () => void;
  onSetInstructions: (value: string) => void;
  onSetCustomStructure: (value: string) => void;
  onSetDocumentInputs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onSetAiAssistEnabled: (value: boolean) => void;
  onSetAiAssistPrompt: (value: string) => void;
  onSetOutputFormat: (value: string) => void;
  onSetContractFormData: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onHandleDateInput: (key: string, raw: string) => void;
  onSetFileSearch: (value: string) => void;
  onSetFileDeptFilter: (value: string) => void;
  onSetFileTypeFilter: (value: string) => void;
  onUploadLocalFiles: (files: FileList | null) => Promise<void>;
  onDownloadGeneratedFile: () => void;
  onDownloadAiContext: (docId: string, lang: 'ko' | 'en') => void;
}

export function NewDocumentModal(props: NewDocumentModalProps) {
  const {
    open,
    step,
    selectedTemplate,
    selectedFiles,
    instructions,
    customStructure,
    documentInputs,
    aiAssistEnabled,
    aiAssistPrompt,
    generating,
    generatedDoc,
    outputFormat,
    generatedDownloadUrl,
    generatedDownloadMeta,
    generatedOutline,
    contractFormData,
    dateErrors,
    fileSearch,
    fileDeptFilter,
    fileTypeFilter,
    uploadingLocalFiles,
    templates,
    sourceFiles,
    originDocumentId,
    originContext,
    creationContextTitle,
    referenceDocId,
    referenceDocuments,
    extractingFields,
    extractedFieldKeys,
    onSetReferenceDocId,
    onExtractFieldsFromSources,
    onClose,
    onBack,
    onNext,
    canNext,
    onGenerate,
    onOpenGeneratedDocument,
    onSetSelectedTemplate,
    onToggleFile,
    onClearSelectedFiles,
    onSetInstructions,
    onSetCustomStructure,
    onSetDocumentInputs,
    onSetAiAssistEnabled,
    onSetAiAssistPrompt,
    onSetOutputFormat,
    onSetContractFormData,
    onHandleDateInput,
    onSetFileSearch,
    onSetFileDeptFilter,
    onSetFileTypeFilter,
    onUploadLocalFiles,
    onDownloadGeneratedFile,
    onDownloadAiContext,
  } = props;

  if (!open) return null;

  const selectedTemplateItem = templates.find((template) => template.id === selectedTemplate);
  const isWorklogTemplate = isWorklogTemplateName(selectedTemplateItem?.name);
  const isProposalTemplate = selectedTemplateItem?.name === '제안서';
  const contractSchema = selectedTemplateItem ? getContractSchema(selectedTemplateItem.name) : null;
  const allowedOutputFormats = getAllowedOutputFormats(selectedTemplateItem?.templateFile ?? null, Boolean(contractSchema), selectedTemplateItem?.templateMode, selectedTemplateItem?.name);
  const templateFields = selectedTemplateItem?.templateFields
    ?? (isWorklogTemplate ? [...WORKLOG_FIELDS] : [
    { key: 'report_title', label: '문서 제목', type: 'text' as const, required: true, placeholder: '예: 2026년 2분기 사업 보고서' },
    { key: 'subtitle', label: '소제목', type: 'text' as const, placeholder: '예: 경영회의 보고용' },
  ]);
  const departments = Array.from(new Set(sourceFiles.map((file) => file.department)));
  const types = Array.from(new Set(sourceFiles.map((file) => file.type)));
  const filteredFiles = sourceFiles.filter((file) => {
    if (fileSearch && !file.name.toLowerCase().includes(fileSearch.toLowerCase())) return false;
    if (fileDeptFilter !== '전체' && file.department !== fileDeptFilter) return false;
    if (fileTypeFilter !== '전체' && file.type !== fileTypeFilter) return false;
    return true;
  });
  const relationLabel = originContextLabel(originContext);
  const generatedProposalHtml = selectedTemplateItem?.name === '제안서' && generatedDoc
    ? renderProposalDocumentHtml({
        title: generatedDoc.title,
        content: generatedDoc.content ?? '',
        documentInputs,
      })
    : '';
  const generatedUsesPrintWindow = generatedDownloadMeta.extension === 'html' || generatedDownloadMeta.mimeType?.startsWith('text/html');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-doc-title">
      <div className="mx-4 max-h-[92vh] w-full max-w-4xl flex flex-col rounded-2xl bg-white shadow-xl">
        <div className="shrink-0 flex items-center justify-between rounded-t-2xl border-b border-border bg-white px-4 py-4 sm:px-6 sm:py-5">
          <h2 id="new-doc-title" className="text-[15px] font-semibold text-foreground">새 문서 생성</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-secondary text-foreground-secondary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
        {step <= 4 && (
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            {originDocumentId && creationContextTitle && relationLabel ? (
              <div className="mb-5 rounded-2xl border border-border-tint bg-primary-tint px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Document Relation</p>
                <p className="mt-2 text-[14px] font-semibold text-foreground">{relationLabel}</p>
                <p className="mt-1 text-[12px] leading-5 text-foreground-secondary">
                  이 문서는 <span className="font-medium text-foreground">{creationContextTitle}</span> 문서와 연결된 후속 문서로 생성됩니다.
                </p>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${step >= s ? 'bg-foreground text-white' : 'bg-surface-secondary text-foreground-secondary'}`}>
                    {step > s ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> : s}
                  </div>
                  {s < 4 && <div className={`h-0.5 flex-1 rounded ${step > s ? 'bg-foreground' : 'bg-border'}`} />}
                </div>
              ))}
            </div>
            <div className="mt-2 hidden justify-between text-xs text-foreground-secondary sm:flex">
              <span>템플릿 선택</span>
              <span>소스 파일</span>
              <span>추가 지시</span>
              <span>확인</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-[20px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          {step === 1 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onSetSelectedTemplate(template.id)}
                  className={`p-5 rounded-xl border text-left transition-all ${selectedTemplate === template.id ? 'border-primary bg-surface-secondary ring-2 ring-primary/30' : 'border-border hover:border-primary'}`}
                >
                  <span className="text-2xl">{TEMPLATE_ICONS[template.name] ?? '📄'}</span>
                  <h4 className="font-medium text-foreground text-sm mt-2">{template.name}</h4>
                  <p className="text-xs text-foreground-secondary mt-1 line-clamp-2">{template.description}</p>
                  {template.templateFile && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-1 rounded-md bg-blue-50 text-blue-600">{template.templateFile.type}</span>
                      <span className="text-[10px] text-foreground-secondary truncate">{template.templateFile.name}</span>
                    </div>
                  )}
                </button>
              ))}
              <button
                onClick={() => { onSetSelectedTemplate('__none__'); onSetCustomStructure(''); }}
                className={`p-5 rounded-xl border text-left transition-all ${selectedTemplate === '__none__' ? 'border-primary bg-surface-secondary ring-2 ring-primary/30' : 'border-dashed border-border hover:border-primary'}`}
              >
                <span className="text-2xl">✏️</span>
                <h4 className="font-medium text-foreground text-sm mt-2">직접 작성</h4>
                <p className="text-xs text-foreground-secondary mt-1">문서 구조를 직접 입력하여 생성</p>
              </button>
            </div>
          )}

          {step === 2 && (
            <NewDocumentSourceStep
              selectedFiles={selectedFiles}
              uploadingLocalFiles={uploadingLocalFiles}
              fileSearch={fileSearch}
              fileDeptFilter={fileDeptFilter}
              fileTypeFilter={fileTypeFilter}
              departments={departments}
              types={types}
              sourceFiles={sourceFiles}
              filteredFiles={filteredFiles}
              isProposalTemplate={isProposalTemplate}
              referenceDocId={referenceDocId}
              referenceDocuments={referenceDocuments}
              onUploadLocalFiles={onUploadLocalFiles}
              onSetFileSearch={onSetFileSearch}
              onSetFileDeptFilter={onSetFileDeptFilter}
              onSetFileTypeFilter={onSetFileTypeFilter}
              onClearSelectedFiles={onClearSelectedFiles}
              onToggleFile={onToggleFile}
              onSetReferenceDocId={onSetReferenceDocId}
            />
          )}

          {step === 3 && contractSchema && (
            <NewDocumentContractStep
              contractSchema={contractSchema}
              contractFormData={contractFormData}
              dateErrors={dateErrors}
              onSetContractFormData={onSetContractFormData}
              onHandleDateInput={onHandleDateInput}
            />
          )}

          {step === 3 && !contractSchema && (
            <NewDocumentGeneralStep
              isWorklogTemplate={isWorklogTemplate}
              selectedTemplate={selectedTemplate}
              selectedTemplateItem={selectedTemplateItem}
              documentInputs={documentInputs}
              aiAssistEnabled={aiAssistEnabled}
              aiAssistPrompt={aiAssistPrompt}
              instructions={instructions}
              customStructure={customStructure}
              outputFormat={outputFormat}
              templateFields={templateFields}
              allowedOutputFormats={allowedOutputFormats}
              extractedFieldKeys={extractedFieldKeys}
              onSetDocumentInputs={onSetDocumentInputs}
              onSetOutputFormat={onSetOutputFormat}
              onSetInstructions={onSetInstructions}
              onSetAiAssistEnabled={onSetAiAssistEnabled}
              onSetAiAssistPrompt={onSetAiAssistPrompt}
              onSetCustomStructure={onSetCustomStructure}
            />
          )}

          {step === 4 && (
            <NewDocumentConfirmStep
              selectedTemplate={selectedTemplate}
              selectedTemplateItem={selectedTemplateItem}
              selectedFiles={selectedFiles}
              outputFormat={outputFormat}
              referenceDocId={referenceDocId}
              referenceDocuments={referenceDocuments}
              documentInputs={documentInputs}
              templateFields={templateFields}
              instructions={instructions}
              aiAssistEnabled={aiAssistEnabled}
              aiAssistPrompt={aiAssistPrompt}
              generating={generating}
            />
          )}

          {step === 5 && generatedDoc && (
            <NewDocumentResultStep
              generatedDoc={generatedDoc}
              outputFormat={outputFormat}
              selectedTemplateItem={selectedTemplateItem}
              generatedProposalHtml={generatedProposalHtml}
              generatedOutline={generatedOutline}
              generatedDownloadUrl={generatedDownloadUrl}
              generatedUsesPrintWindow={generatedUsesPrintWindow}
              onDownloadGeneratedFile={onDownloadGeneratedFile}
              onDownloadAiContext={onDownloadAiContext}
            />
          )}
        </div>
        </div>

        <div className="shrink-0 flex flex-col gap-2 border-t border-border bg-white rounded-b-2xl px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button onClick={onBack} className="px-5 py-2 rounded-xl border border-border text-[13px] text-foreground-secondary hover:bg-surface-secondary transition-colors">
            {step === 1 || step === 5 ? '닫기' : '이전'}
          </button>
          {step < 4 && (
            <button
              disabled={!canNext || extractingFields}
              onClick={step === 2 ? async () => { await onExtractFieldsFromSources(); onNext(); } : onNext}
              className="px-5 py-2 rounded-xl bg-foreground text-white text-[13px] font-medium hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {extractingFields ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  참조파일 분석 중...
                </span>
              ) : '다음'}
            </button>
          )}
          {step === 4 && (
            <button disabled={generating} onClick={onGenerate} className="px-5 py-2 rounded-xl bg-foreground text-white text-[13px] font-medium hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {generating ? '생성 중...' : '문서 생성'}
            </button>
          )}
          {step === 5 && generatedDoc && (
            <button onClick={() => onOpenGeneratedDocument(generatedDoc)} className="px-5 py-2 rounded-xl bg-foreground text-white text-[13px] font-medium hover:bg-primary transition-colors">
              문서 편집
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
