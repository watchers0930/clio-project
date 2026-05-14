import { Spinner } from '@/components/ui';
import { getContractSchema } from '@/lib/contract-fields';
import type { DocumentItem, SourceFile, TemplateItem } from '@/components/documents/page-types';
import { isWorklogTemplateName, WORKLOG_FIELDS } from '@/lib/templates/worklog';
import { NewDocumentGeneralStep } from '@/components/documents/new-document-general-step';
import { DOCUMENT_RELATION_LABELS, TEMPLATE_ICONS } from '@/components/documents/document-page-constants';

function getAllowedOutputFormats(templateFile: TemplateItem['templateFile'] | null, isContract: boolean) {
  if (isContract) return ['hwpx'] as const;
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
  generatedOutline: Record<string, unknown> | null;
  contractFormData: Record<string, string>;
  dateErrors: Record<string, string>;
  fileSearch: string;
  fileDeptFilter: string;
  fileTypeFilter: string;
  templates: TemplateItem[];
  sourceFiles: SourceFile[];
  originDocumentId: string | null;
  originContext: string | null;
  creationContextTitle: string;
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
    generatedOutline,
    contractFormData,
    dateErrors,
    fileSearch,
    fileDeptFilter,
    fileTypeFilter,
    templates,
    sourceFiles,
    originDocumentId,
    originContext,
    creationContextTitle,
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
    onDownloadGeneratedFile,
    onDownloadAiContext,
  } = props;

  if (!open) return null;

  const selectedTemplateItem = templates.find((template) => template.id === selectedTemplate);
  const isWorklogTemplate = isWorklogTemplateName(selectedTemplateItem?.name);
  const contractSchema = selectedTemplateItem ? getContractSchema(selectedTemplateItem.name) : null;
  const allowedOutputFormats = getAllowedOutputFormats(selectedTemplateItem?.templateFile ?? null, Boolean(contractSchema));
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-doc-title">
      <div className="mx-4 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-[#e5e5e7] bg-white px-4 py-4 sm:px-6 sm:py-5">
          <h2 id="new-doc-title" className="text-[15px] font-semibold text-[#1B1F2B]">새 문서 생성</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {step <= 4 && (
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            {originDocumentId && creationContextTitle && relationLabel ? (
              <div className="mb-5 rounded-2xl border border-[#D7E7FF] bg-[#F3F8FF] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2E6FF2]">Document Relation</p>
                <p className="mt-2 text-[14px] font-semibold text-[#1B1F2B]">{relationLabel}</p>
                <p className="mt-1 text-[12px] leading-5 text-[#5E6573]">
                  이 문서는 <span className="font-medium text-[#1B1F2B]">{creationContextTitle}</span> 문서와 연결된 후속 문서로 생성됩니다.
                </p>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${step >= s ? 'bg-[#1d1d1f] text-white' : 'bg-[#f5f5f7] text-[#6e6e73]'}`}>
                    {step > s ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> : s}
                  </div>
                  {s < 4 && <div className={`h-0.5 flex-1 rounded ${step > s ? 'bg-[#1d1d1f]' : 'bg-[#e5e5e7]'}`} />}
                </div>
              ))}
            </div>
            <div className="mt-2 hidden justify-between text-xs text-[#6e6e73] sm:flex">
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
              <button
                onClick={() => { onSetSelectedTemplate('__none__'); onSetCustomStructure(''); }}
                className={`p-5 rounded-xl border text-left transition-all ${selectedTemplate === '__none__' ? 'border-[#0071e3] bg-[#f5f5f7] ring-2 ring-[#0071e3]/30' : 'border-dashed border-[#d1d1d6] hover:border-[#0071e3]'}`}
              >
                <span className="text-2xl">✏️</span>
                <h4 className="font-medium text-[#1d1d1f] text-sm mt-2">직접 작성</h4>
                <p className="text-xs text-[#6e6e73] mt-1">문서 구조를 직접 입력하여 생성</p>
              </button>
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onSetSelectedTemplate(template.id)}
                  className={`p-5 rounded-xl border text-left transition-all ${selectedTemplate === template.id ? 'border-[#0071e3] bg-[#f5f5f7] ring-2 ring-[#0071e3]/30' : 'border-[#e5e5e7] hover:border-[#0071e3]'}`}
                >
                  <span className="text-2xl">{TEMPLATE_ICONS[template.name] ?? '📄'}</span>
                  <h4 className="font-medium text-[#1d1d1f] text-sm mt-2">{template.name}</h4>
                  <p className="text-xs text-[#6e6e73] mt-1 line-clamp-2">{template.description}</p>
                  {template.templateFile && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-1 rounded-md bg-blue-50 text-blue-600">{template.templateFile.type}</span>
                      <span className="text-[10px] text-[#6e6e73] truncate">{template.templateFile.name}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[#6e6e73]">참조할 소스 파일을 선택하세요 (선택사항)</p>
                <span className="text-xs font-medium text-[#0071e3]">{selectedFiles.size}개 선택됨</span>
              </div>
              {selectedFiles.size === 0 && (
                <p className="text-xs text-[#ff9f0a] bg-[#fff8f0] px-3.5 py-2.5 rounded-lg">파일 없이도 템플릿 양식 기반으로 문서를 생성할 수 있습니다.</p>
              )}
              <div className="relative" style={{ marginTop: 10, marginBottom: 15 }}>
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  value={fileSearch}
                  onChange={(e) => onSetFileSearch(e.target.value)}
                  placeholder="파일명 검색..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                />
              </div>
              <div className="mb-3 flex flex-wrap gap-2.5">
                <select value={fileDeptFilter} onChange={(e) => onSetFileDeptFilter(e.target.value)} className="px-3.5 py-2 rounded-lg border border-[#e5e5e7] text-xs text-[#1d1d1f] bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
                  <option value="전체">전체 부서</option>
                  {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                </select>
                <select value={fileTypeFilter} onChange={(e) => onSetFileTypeFilter(e.target.value)} className="px-3.5 py-2 rounded-lg border border-[#e5e5e7] text-xs text-[#1d1d1f] bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
                  <option value="전체">전체 타입</option>
                  {types.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                {selectedFiles.size > 0 && (
                  <button onClick={onClearSelectedFiles} className="px-3.5 py-2 rounded-lg text-xs text-[#ff3b30] hover:bg-red-50 transition-colors">
                    선택 해제
                  </button>
                )}
              </div>
              {sourceFiles.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm font-medium text-[#1d1d1f]">등록된 파일이 없습니다</p>
                  <p className="text-xs text-[#6e6e73] mt-1">파일 관리에서 먼저 파일을 업로드해 주세요</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-[#6e6e73]">검색 결과가 없습니다</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredFiles.map((file) => (
                    <label
                      key={file.id}
                      className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${selectedFiles.has(file.id) ? 'border-[#0071e3] bg-[#f0f5ff]' : 'border-[#e5e5e7] hover:bg-[#f5f5f7]'}`}
                    >
                      <input type="checkbox" checked={selectedFiles.has(file.id)} onChange={() => onToggleFile(file.id)} className="rounded border-[#e5e5e7] text-[#0071e3] focus:ring-[#0071e3] shrink-0" />
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 bg-gray-50 text-gray-600">{file.type}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#1d1d1f] truncate">{file.name}</p>
                        <p className="text-[11px] text-[#6e6e73] mt-0.5">{file.department} · {file.size} · {file.uploadDate}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && contractSchema && (
            <div className="flex flex-col gap-[20px]">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#f0f5ff] border border-[#d0e2ff]">
                <div>
                  <p className="text-sm font-semibold text-[#1d1d1f]">계약서 자동 작성</p>
                  <p className="text-xs text-[#6e6e73]">아래 항목을 입력하면 표준계약서 양식에 자동으로 반영됩니다. AI 토큰을 사용하지 않습니다.</p>
                </div>
              </div>
              {[...new Set(contractSchema.fields.map((field) => field.group))].map((group) => {
                const fields = contractSchema.fields.filter((field) => field.group === group);
                return (
                  <div key={group}>
                    <h4 className="text-sm font-semibold text-[#1d1d1f] mb-3 flex items-center gap-2" style={{ marginTop: 10 }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3]" />
                      {group}
                    </h4>
                    <div className="mb-[10px] grid grid-cols-1 gap-x-4 md:grid-cols-2">
                      {fields.map((field) => (
                        <div key={field.key} className={field.half ? '' : 'md:col-span-2'} style={{ paddingTop: 5, paddingBottom: 15 }}>
                          <label className="block text-xs text-[#6e6e73]" style={{ marginBottom: 8 }}>
                            {field.label} {field.required && <span className="text-[#ff3b30]">*</span>}
                          </label>
                          {field.type === 'select' ? (
                            <select value={contractFormData[field.key] ?? ''} onChange={(e) => onSetContractFormData((prev) => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-shadow cursor-pointer">
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
                                className={`w-full px-4 py-2.5 rounded-xl border text-sm text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none focus:ring-2 transition-shadow ${dateErrors[field.key] ? 'border-[#ff3b30] focus:ring-[#ff3b30]/30 bg-[#fff5f5]' : 'border-[#e5e5e7] focus:ring-[#0071e3] bg-white'}`}
                              />
                              {dateErrors[field.key] && <p className="text-[11px] text-[#ff3b30] mt-0.5">{dateErrors[field.key]}</p>}
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
              <div className="flex flex-col gap-[10px] rounded-xl bg-[#f5f5f7] p-4 text-sm sm:p-6">
                <div className="flex justify-between">
                  <span className="text-[#6e6e73]">템플릿</span>
                  <span className="text-[#1d1d1f] font-medium">{selectedTemplate === '__none__' ? '직접 작성' : selectedTemplateItem?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6e6e73]">소스 파일</span>
                  <span className="text-[#1d1d1f] font-medium">{selectedFiles.size}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6e6e73]">출력 포맷</span>
                  <span className="text-[#1d1d1f] font-medium">{outputFormat.toUpperCase()}</span>
                </div>
                {Object.entries(documentInputs).filter(([, value]) => value).length > 0 && (
                  <div>
                    <span className="text-[#6e6e73]">기본 정보</span>
                    <div className="mt-1 text-[#1d1d1f] space-y-1">
                      {templateFields.filter((field) => documentInputs[field.key]).map((field) => (
                        <p key={field.key}>{field.label}: {documentInputs[field.key]}</p>
                      ))}
                    </div>
                  </div>
                )}
                {instructions && (
                  <div>
                    <span className="text-[#6e6e73]">추가 지시사항</span>
                    <p className="text-[#1d1d1f] mt-1">{instructions}</p>
                  </div>
                )}
                {aiAssistEnabled && (
                  <div>
                    <span className="text-[#6e6e73]">AI 보강</span>
                    <p className="text-[#1d1d1f] mt-1">{aiAssistPrompt || '기본 보강 규칙 사용'}</p>
                  </div>
                )}
              </div>
              {generating ? (
                <div className="flex flex-col items-center py-6 gap-3">
                  <Spinner size="lg" />
                  <p className="text-sm text-[#6e6e73]">AI가 문서를 생성하고 있습니다...</p>
                </div>
              ) : (
                <p className="text-xs text-[#6e6e73] text-center">생성 버튼을 누르면 AI가 문서를 생성합니다.</p>
              )}
            </div>
          )}

          {step === 5 && generatedDoc && (
            <div className="flex flex-col gap-[20px]">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#f5f5f7] border border-[#e5e5e7]">
                <div>
                  <h4 className="font-semibold text-[#1d1d1f]">{outputFormat.toUpperCase()} 문서가 생성되었습니다!</h4>
                  <p className="text-sm text-[#6e6e73]">{generatedDoc.title}</p>
                </div>
              </div>
              {(outputFormat === 'docx' || outputFormat === 'pdf' || outputFormat === 'hwpx') && (
                <div className="bg-[#f5f5f7] rounded-xl p-4 max-h-60 overflow-y-auto">
                  <div className="text-sm text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">
                    {generatedDoc.content ?? '내용 없음'}
                  </div>
                </div>
              )}
              {outputFormat === 'xlsx' && generatedOutline && (generatedOutline as { sheets?: { sheetName: string; headers: string[]; rows: unknown[][] }[] }).sheets && (
                <div className="bg-[#f5f5f7] rounded-xl p-4 max-h-60 overflow-y-auto space-y-3">
                  {((generatedOutline as { sheets: { sheetName: string; headers: string[]; rows: unknown[][] }[] }).sheets).map((sheet, index) => (
                    <div key={index} className="bg-white rounded-lg p-3 border border-[#e5e5e7]">
                      <p className="text-sm font-medium text-[#1d1d1f]">{sheet.sheetName} ({sheet.rows?.length ?? 0}행)</p>
                      <p className="text-xs text-[#6e6e73] mt-1">컬럼: {sheet.headers?.join(', ')}</p>
                    </div>
                  ))}
                </div>
              )}
              {outputFormat === 'pptx' && generatedOutline && (generatedOutline as { slides?: { title: string; bullets?: string[] }[] }).slides && (
                <div className="bg-[#f5f5f7] rounded-xl p-4 max-h-60 overflow-y-auto space-y-2">
                  {((generatedOutline as { slides: { title: string; bullets?: string[] }[] }).slides).map((slide, index) => (
                    <div key={index} className="bg-white rounded-lg p-3 border border-[#e5e5e7]">
                      <p className="text-sm font-medium text-[#1d1d1f]">{index + 1}. {slide.title}</p>
                      {slide.bullets && (
                        <ul className="text-xs text-[#6e6e73] mt-1 ml-4 list-disc">
                          {slide.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {generatedDownloadUrl && (
                <button onClick={onDownloadGeneratedFile} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0071e3] text-white text-sm font-medium hover:bg-[#005bb5] transition-colors">
                  {outputFormat.toUpperCase()} 파일 다운로드
                </button>
              )}
              {selectedTemplateItem?.name === '제안서' && generatedDoc.id && (
                <div className="mt-4 p-4 rounded-xl bg-[#f0faf2] border border-[#d1f0d9]">
                  <div className="flex gap-2">
                    <button onClick={() => onDownloadAiContext(generatedDoc.id, 'ko')} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#34c759] text-[#34c759] hover:bg-white transition-colors">
                      국문
                    </button>
                    <button onClick={() => onDownloadAiContext(generatedDoc.id, 'en')} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#30d158] text-[#30d158] hover:bg-white transition-colors">
                      English
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[#e5e5e7] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button onClick={onBack} className="px-5 py-2 rounded-xl border border-[#e5e5e7] text-[13px] text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">
            {step === 1 || step === 5 ? '닫기' : '이전'}
          </button>
          {step < 4 && (
            <button disabled={!canNext} onClick={onNext} className="px-5 py-2 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              다음
            </button>
          )}
          {step === 4 && (
            <button disabled={generating} onClick={onGenerate} className="px-5 py-2 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {generating ? '생성 중...' : '문서 생성'}
            </button>
          )}
          {step === 5 && generatedDoc && (
            <button onClick={() => onOpenGeneratedDocument(generatedDoc)} className="px-5 py-2 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors">
              문서 편집
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
