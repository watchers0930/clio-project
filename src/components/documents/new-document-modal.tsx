import { Spinner } from '@/components/ui';
import { HtmlPreviewFrame } from '@/components/documents/html-preview-frame';
import { getContractSchema } from '@/lib/contract-fields';
import type { DocumentItem, SourceFile, TemplateItem } from '@/components/documents/page-types';
import { isWorklogTemplateName, WORKLOG_FIELDS } from '@/lib/templates/worklog';
import { NewDocumentGeneralStep } from '@/components/documents/new-document-general-step';
import { DOCUMENT_RELATION_LABELS, TEMPLATE_ICONS } from '@/components/documents/document-page-constants';
import { renderProposalDocumentHtml } from '@/lib/templates/proposal-render';
import { ReferenceDocumentPicker } from '@/components/documents/reference-document-picker';

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
  const relationLabel = DOCUMENT_RELATION_LABELS[originContext ?? ''] ?? null;
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
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-foreground-secondary">참조할 소스 파일을 선택하세요 (선택사항)</p>
                <span className="text-xs font-medium text-primary">{selectedFiles.size}개 선택됨</span>
              </div>
              <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">로컬 파일 추가</p>
                    <p className="text-xs text-foreground-secondary">문서허브에 없는 파일은 여기서 바로 업로드하고 참조문서로 선택합니다.</p>
                  </div>
                  <label className={`inline-flex cursor-pointer items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${uploadingLocalFiles ? 'bg-border text-foreground-secondary' : 'bg-foreground text-white hover:bg-primary'}`}>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      disabled={uploadingLocalFiles}
                      onChange={(e) => {
                        void onUploadLocalFiles(e.target.files);
                        e.currentTarget.value = '';
                      }}
                    />
                    {uploadingLocalFiles ? '업로드 중...' : '로컬 파일 선택'}
                  </label>
                </div>
              </div>
              {selectedFiles.size === 0 && (
                <p className="text-xs text-warning bg-warning/5 px-3.5 py-2.5 rounded-lg">파일 없이도 템플릿 양식 기반으로 문서를 생성할 수 있습니다.</p>
              )}
              <div className="relative" style={{ marginTop: 10, marginBottom: 15 }}>
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  value={fileSearch}
                  onChange={(e) => onSetFileSearch(e.target.value)}
                  placeholder="파일명 검색..."
                  style={{ paddingLeft: '2.5rem' }}
                  className="w-full pr-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="mb-3 flex flex-wrap gap-2.5">
                <select value={fileDeptFilter} onChange={(e) => onSetFileDeptFilter(e.target.value)} className="px-3.5 py-2 rounded-lg border border-border text-xs text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="전체">전체 부서</option>
                  {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                </select>
                <select value={fileTypeFilter} onChange={(e) => onSetFileTypeFilter(e.target.value)} className="px-3.5 py-2 rounded-lg border border-border text-xs text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="전체">전체 타입</option>
                  {types.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                {selectedFiles.size > 0 && (
                  <button onClick={onClearSelectedFiles} className="px-3.5 py-2 rounded-lg text-xs text-danger hover:bg-red-50 transition-colors">
                    선택 해제
                  </button>
                )}
              </div>
              {sourceFiles.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm font-medium text-foreground">등록된 파일이 없습니다</p>
                  <p className="text-xs text-foreground-secondary mt-1">파일 관리에서 먼저 파일을 업로드해 주세요</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-foreground-secondary">검색 결과가 없습니다</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto flex flex-col gap-2">
                  {filteredFiles.map((file) => (
                    <label
                      key={file.id}
                      className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${selectedFiles.has(file.id) ? 'border-primary bg-primary-tint' : 'border-border hover:bg-surface-secondary'}`}
                    >
                      <input type="checkbox" checked={selectedFiles.has(file.id)} onChange={() => onToggleFile(file.id)} className="rounded border-border text-primary focus:ring-primary shrink-0" />
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 bg-gray-50 text-gray-600">{file.type}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{file.name}</p>
                        <p className="text-[11px] text-foreground-secondary mt-0.5">{file.department} · {file.size} · {file.uploadDate}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {isProposalTemplate && (
                <ReferenceDocumentPicker
                  referenceDocId={referenceDocId}
                  referenceDocuments={referenceDocuments}
                  onSetReferenceDocId={onSetReferenceDocId}
                />
              )}
            </div>
          )}

          {step === 3 && contractSchema && (
            <div className="flex flex-col gap-[20px]">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary-tint border border-primary/30">
                <div>
                  <p className="text-sm font-semibold text-foreground">계약서 자동 작성</p>
                  <p className="text-xs text-foreground-secondary">아래 항목을 입력하면 표준계약서 양식에 자동으로 반영됩니다. AI 토큰을 사용하지 않습니다.</p>
                </div>
              </div>
              {[...new Set(contractSchema.fields.map((field) => field.group))].map((group) => {
                const fields = contractSchema.fields.filter((field) => field.group === group);
                return (
                  <div key={group}>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2" style={{ marginTop: 10 }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {group}
                    </h4>
                    <div className="mb-[10px] grid grid-cols-1 gap-x-4 md:grid-cols-2">
                      {fields.map((field) => (
                        <div key={field.key} className={field.half ? '' : 'md:col-span-2'} style={{ paddingTop: 5, paddingBottom: 15 }}>
                          <label className="block text-xs text-foreground-secondary" style={{ marginBottom: 8 }}>
                            {field.label} {field.required && <span className="text-danger">*</span>}
                          </label>
                          {field.type === 'select' ? (
                            <select value={contractFormData[field.key] ?? ''} onChange={(e) => onSetContractFormData((prev) => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow cursor-pointer">
                              <option value="">선택하세요</option>
                              {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                          ) : field.placeholder === 'yyyy/mm/dd' ? (
                            <>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={contractFormData[field.key] ?? ''}
                                onChange={(e) => onHandleDateInput(field.key, e.target.value)}
                                placeholder="yyyy/mm/dd"
                                maxLength={10}
                                className={`w-full px-4 py-2.5 rounded-xl border text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 transition-shadow ${dateErrors[field.key] ? 'border-danger focus:ring-danger/30 bg-danger/5' : 'border-border focus:ring-primary bg-white'}`}
                              />
                              {dateErrors[field.key] && <p className="text-[11px] text-danger mt-0.5">{dateErrors[field.key]}</p>}
                            </>
                          ) : (
                            <input
                              type="text"
                              inputMode={field.type === 'number' ? 'numeric' : undefined}
                              value={field.type === 'number' && contractFormData[field.key] ? Number(contractFormData[field.key]).toLocaleString('ko-KR') : (contractFormData[field.key] ?? '')}
                              onChange={(e) => {
                                let value = e.target.value;
                                if (field.type === 'number') value = value.replace(/[^0-9]/g, '');
                                onSetContractFormData((prev) => {
                                  const next = { ...prev, [field.key]: value };
                                  if (field.key === 'totalAmount' && value) {
                                    const total = Number(value);
                                    next.supplyAmount = String(Math.round(total / 1.1));
                                    next.vatAmount = String(total - Math.round(total / 1.1));
                                  }
                                  return next;
                                });
                              }}
                              placeholder={field.placeholder}
                              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
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
            <div className="flex flex-col gap-[20px]">
              <div className="flex flex-col gap-[10px] rounded-xl bg-surface-secondary p-4 text-sm sm:p-6">
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">템플릿</span>
                  <span className="text-foreground font-medium">{selectedTemplate === '__none__' ? '직접 작성' : selectedTemplateItem?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">소스 파일</span>
                  <span className="text-foreground font-medium">{selectedFiles.size}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">출력 포맷</span>
                  <span className="text-foreground font-medium">{outputFormat.toUpperCase()}</span>
                </div>
                {referenceDocId && (
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">참조 제안서</span>
                    <span className="text-foreground font-medium truncate ml-4 max-w-[240px]">
                      {referenceDocuments.find((d) => d.id === referenceDocId)?.title ?? '선택됨'}
                    </span>
                  </div>
                )}
                {Object.entries(documentInputs).filter(([, value]) => value).length > 0 && (
                  <div>
                    <span className="text-foreground-secondary">기본 정보</span>
                    <div className="mt-1 text-foreground space-y-1">
                      {templateFields.filter((field) => documentInputs[field.key]).map((field) => (
                        <p key={field.key}>{field.label}: {documentInputs[field.key]}</p>
                      ))}
                    </div>
                  </div>
                )}
                {instructions && (
                  <div>
                    <span className="text-foreground-secondary">추가 지시사항</span>
                    <p className="text-foreground mt-1">{instructions}</p>
                  </div>
                )}
                {aiAssistEnabled && (
                  <div>
                    <span className="text-foreground-secondary">AI 보강</span>
                    <p className="text-foreground mt-1">{aiAssistPrompt || '기본 보강 규칙 사용'}</p>
                  </div>
                )}
              </div>
              {generating ? (
                <div className="flex flex-col items-center py-6 gap-3">
                  <Spinner size="lg" />
                  <p className="text-sm text-foreground-secondary">AI가 문서를 생성하고 있습니다...</p>
                </div>
              ) : (
                <p className="text-xs text-foreground-secondary text-center">생성 버튼을 누르면 AI가 문서를 생성합니다.</p>
              )}
            </div>
          )}

          {step === 5 && generatedDoc && (
            <div className="flex flex-col gap-[20px]">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-secondary border border-border">
                <div>
                  <h4 className="font-semibold text-foreground">{outputFormat.toUpperCase()} 문서가 생성되었습니다!</h4>
                  <p className="text-sm text-foreground-secondary">{generatedDoc.title}</p>
                </div>
              </div>
              {(outputFormat === 'docx' || outputFormat === 'pdf' || outputFormat === 'hwpx') && (
                <div className={`bg-surface-secondary rounded-xl p-4 ${selectedTemplateItem?.name === '제안서' ? '' : 'max-h-60 overflow-y-auto'}`}>
                  {selectedTemplateItem?.name === '제안서' ? (
                    <HtmlPreviewFrame
                      title="generated-proposal-preview"
                      html={generatedProposalHtml}
                      className="h-[480px] w-full rounded-lg border border-border bg-white"
                    />
                  ) : (
                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {generatedDoc.content ?? '내용 없음'}
                    </div>
                  )}
                </div>
              )}
              {outputFormat === 'xlsx' && generatedOutline && (generatedOutline as { sheets?: { sheetName: string; headers: string[]; rows: unknown[][] }[] }).sheets && (
                <div className="bg-surface-secondary rounded-xl p-4 max-h-60 overflow-y-auto space-y-3">
                  {((generatedOutline as { sheets: { sheetName: string; headers: string[]; rows: unknown[][] }[] }).sheets).map((sheet, index) => (
                    <div key={index} className="bg-white rounded-lg p-3 border border-border">
                      <p className="text-sm font-medium text-foreground">{sheet.sheetName} ({sheet.rows?.length ?? 0}행)</p>
                      <p className="text-xs text-foreground-secondary mt-1">컬럼: {sheet.headers?.join(', ')}</p>
                    </div>
                  ))}
                </div>
              )}
              {outputFormat === 'pptx' && generatedOutline && (generatedOutline as { slides?: { title: string; bullets?: string[] }[] }).slides && (
                <div className="bg-surface-secondary rounded-xl p-4 max-h-60 overflow-y-auto space-y-2">
                  {((generatedOutline as { slides: { title: string; bullets?: string[] }[] }).slides).map((slide, index) => (
                    <div key={index} className="bg-white rounded-lg p-3 border border-border">
                      <p className="text-sm font-medium text-foreground">{index + 1}. {slide.title}</p>
                      {slide.bullets && (
                        <ul className="text-xs text-foreground-secondary mt-1 ml-4 list-disc">
                          {slide.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {(generatedDownloadUrl || generatedDoc.id) && (
                <button onClick={onDownloadGeneratedFile} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors">
                  {generatedUsesPrintWindow ? 'PDF 저장창 열기' : `${outputFormat.toUpperCase()} 파일 다운로드`}
                </button>
              )}
              {selectedTemplateItem?.name === '제안서' && generatedDoc.id && (
                <div className="mt-4 p-4 rounded-xl bg-success/5 border border-success/30">
                  <div className="flex gap-2">
                    <button onClick={() => onDownloadAiContext(generatedDoc.id, 'ko')} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-success text-success hover:bg-white transition-colors">
                      국문
                    </button>
                    <button onClick={() => onDownloadAiContext(generatedDoc.id, 'en')} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-success text-success hover:bg-white transition-colors">
                      English
                    </button>
                  </div>
                </div>
              )}
            </div>
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
