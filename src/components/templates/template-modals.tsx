'use client';

import type { AutoPlaceholder, TemplateFile } from './types';
import { createTemplateBundle, type TemplateFieldDefinition, type TemplateSectionDefinition } from '@/lib/templates/template-schema';
import { renderTemplatePreviewHtml } from '@/lib/templates/template-preview';

export function TemplateEditModal({
  open,
  editId,
  formName,
  formDescription,
  formDepartmentId,
  formScope,
  formIcon,
  formContent,
  formTemplateHtml,
  formTemplateFields,
  formTemplateSections,
  formFile,
  formExistingFile,
  formRemoveFile,
  saving,
  deptList,
  iconOptions,
  onClose,
  onNameChange,
  onDescriptionChange,
  onDepartmentChange,
  onScopeChange,
  onIconChange,
  onContentChange,
  onTemplateHtmlChange,
  onFileChange,
  onRemoveExistingFile,
  onClearNewFile,
  onSave,
}: {
  open: boolean;
  editId: string | null;
  formName: string;
  formDescription: string;
  formDepartmentId: string;
  formScope: '전사 공용' | '부서 전용';
  formIcon: string;
  formContent: string;
  formTemplateHtml: string;
  formTemplateFields: TemplateFieldDefinition[];
  formTemplateSections: TemplateSectionDefinition[];
  formFile: File | null;
  formExistingFile: TemplateFile | null;
  formRemoveFile: boolean;
  saving: boolean;
  deptList: { id: string; name: string }[];
  iconOptions: string[];
  onClose: () => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onScopeChange: (value: '전사 공용' | '부서 전용') => void;
  onIconChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onTemplateHtmlChange: (value: string) => void;
  onFileChange: (file: File) => void;
  onRemoveExistingFile: () => void;
  onClearNewFile: () => void;
  onSave: () => void;
}) {
  if (!open) return null;

  const previewBundle = {
    ...(createTemplateBundle({ name: formName || '문서', description: formDescription, outline: formContent || undefined })),
    layoutHtml: formTemplateHtml.trim() || createTemplateBundle({ name: formName || '문서', description: formDescription, outline: formContent || undefined }).layoutHtml,
    fields: formTemplateFields.length > 0 ? formTemplateFields : createTemplateBundle({ name: formName || '문서', description: formDescription, outline: formContent || undefined }).fields,
    sections: formTemplateSections.length > 0 ? formTemplateSections : createTemplateBundle({ name: formName || '문서', description: formDescription, outline: formContent || undefined }).sections,
  };
  const previewHtml = renderTemplatePreviewHtml(previewBundle, formName || '문서');
  const previewSrc = editId && formExistingFile && !formRemoveFile && !formFile
    ? `/api/templates/${editId}/preview-html`
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="tmpl-modal-title" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl mx-4 max-h-[88vh] overflow-y-auto">
        <div className="px-8 py-6 border-b border-[#e5e5e7] flex items-center justify-between">
          <h2 id="tmpl-modal-title" className="text-lg font-semibold text-[#1d1d1f]">{editId ? '템플릿 편집' : '새 템플릿 만들기'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
            <CloseIcon />
          </button>
        </div>
        <div className="px-8 py-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="flex flex-col gap-[20px]">
          <div>
            <label className="block text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 5 }}>아이콘</label>
            <div className="flex flex-wrap gap-2.5">
              {iconOptions.map((icon) => (
                <button key={icon} onClick={() => onIconChange(icon)} className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl border transition-colors ${formIcon === icon ? 'border-[#0071e3] bg-[#f5f5f7] ring-2 ring-[#0071e3]/30' : 'border-[#e5e5e7] hover:border-[#0071e3]'}`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <Field label="이름 *">
            <input value={formName} onChange={(e) => onNameChange(e.target.value)} placeholder="템플릿 이름을 입력하세요" className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]" />
          </Field>

          <Field label="설명">
            <textarea value={formDescription} onChange={(e) => onDescriptionChange(e.target.value)} placeholder="템플릿에 대한 설명을 입력하세요" rows={3} className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] resize-none" />
          </Field>

          <Field label="문서 구조">
            <p className="text-xs text-[#6e6e73]" style={{ marginBottom: 8 }}>AI가 이 구조를 따라 문서를 생성합니다. 섹션/항목을 정의하세요.</p>
            <textarea value={formContent} onChange={(e) => onContentChange(e.target.value)} placeholder={'예:\n# 업무일지\n## 오늘의 업무\n- 주요 업무 내용 1\n- 주요 업무 내용 2\n## 문제점 및 해결 방안\n## 내일의 계획'} rows={6} className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] resize-none font-mono" />
          </Field>

          <Field label="HTML 레이아웃">
            <p className="text-xs text-[#6e6e73]" style={{ marginBottom: 8 }}>
              {'`{{report_title}}`, `{{author}}`, `{{section_x_body}}` 같은 치환 키를 사용할 수 있습니다.'}
            </p>
            <textarea value={formTemplateHtml} onChange={(e) => onTemplateHtmlChange(e.target.value)} placeholder="<article>...</article>" rows={12} className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] text-xs text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] resize-none font-mono" />
          </Field>

          <Field label="부서">
            <select value={formDepartmentId} onChange={(e) => onDepartmentChange(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
              {deptList.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
            </select>
          </Field>

          <Field label="범위">
            <div className="flex gap-3">
              {(['전사 공용', '부서 전용'] as const).map((scope) => (
                <button key={scope} onClick={() => onScopeChange(scope)} className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${formScope === scope ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white' : 'border-[#e5e5e7] text-[#6e6e73] hover:border-[#1d1d1f]'}`}>
                  {scope}
                </button>
              ))}
            </div>
          </Field>

          <Field label="표준양식 파일">
            <p className="text-xs text-[#6e6e73] mb-3">HWP, HWPX, DOCX, XLSX, PPTX, PDF 등 표준양식 파일을 첨부하세요</p>

            {formExistingFile && !formRemoveFile && !formFile && (
              <FileRow label={formExistingFile.type} name={formExistingFile.name} size={formExistingFile.size} onRemove={onRemoveExistingFile} />
            )}

            {formFile && (
              <FileRow
                highlighted
                label={formFile.name.split('.').pop()?.toUpperCase() ?? 'FILE'}
                name={formFile.name}
                size={formFile.size < 1024 * 1024 ? `${(formFile.size / 1024).toFixed(0)} KB` : `${(formFile.size / (1024 * 1024)).toFixed(1)} MB`}
                onRemove={onClearNewFile}
              />
            )}

            {!formFile && (!formExistingFile || formRemoveFile) && (
              <label className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-[#e5e5e7] cursor-pointer hover:border-[#0071e3] hover:bg-[#f5f5f7] transition-colors">
                <UploadIcon />
                <span className="text-sm text-[#6e6e73]">파일 선택</span>
                <input type="file" className="hidden" accept=".hwp,.hwpx,.doc,.docx,.dotx,.xls,.xlsx,.ppt,.pptx,.pdf,.md" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFileChange(file); e.target.value = ''; }} />
              </label>
            )}
          </Field>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1d1d1f]">템플릿 미리보기</h3>
              <span className="text-[11px] text-[#6e6e73]">HTML 렌더 기준</span>
            </div>
            <div className="rounded-2xl border border-[#e5e5e7] bg-[#f5f7fb] p-3">
              <iframe
                title="template-preview"
                src={previewSrc}
                srcDoc={previewSrc ? undefined : previewHtml}
                className="h-[680px] w-full rounded-xl border border-[#dfe4ea] bg-white"
              />
            </div>
            <p className="text-[11px] leading-5 text-[#6e6e73]">
              로그인 사용자 정보, 선택한 소스 파일 정보, 문서 입력값이 같은 치환 키로 자동 주입됩니다.
            </p>
          </div>
        </div>
        <div className="px-8 py-5 border-t border-[#e5e5e7] flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors">취소</button>
          <button onClick={onSave} disabled={!formName.trim() || saving} className="px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? '저장 중...' : editId ? '수정' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TemplateAutoRegisterModal({
  open,
  step,
  autoRegFile,
  analyzing,
  detectedPlaceholders,
  autoRegPreview,
  autoRegPreviewHtml,
  autoRegName,
  autoRegDesc,
  autoRegDeptId,
  autoRegScope,
  autoRegSaving,
  deptList,
  onClose,
  onStepChange,
  onFileChange,
  onTogglePlaceholder,
  onRenamePlaceholder,
  onNameChange,
  onDescChange,
  onDeptChange,
  onScopeChange,
  onAnalyze,
  onSubmit,
}: {
  open: boolean;
  step: number;
  autoRegFile: File | null;
  analyzing: boolean;
  detectedPlaceholders: AutoPlaceholder[];
  autoRegPreview: string;
  autoRegPreviewHtml: string;
  autoRegName: string;
  autoRegDesc: string;
  autoRegDeptId: string;
  autoRegScope: '전사 공용' | '부서 전용';
  autoRegSaving: boolean;
  deptList: { id: string; name: string }[];
  onClose: () => void;
  onStepChange: (step: number) => void;
  onFileChange: (file: File) => void;
  onTogglePlaceholder: (index: number) => void;
  onRenamePlaceholder: (index: number, value: string) => void;
  onNameChange: (value: string) => void;
  onDescChange: (value: string) => void;
  onDeptChange: (value: string) => void;
  onScopeChange: (value: '전사 공용' | '부서 전용') => void;
  onAnalyze: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4" style={{ padding: '28px 32px' }}>
        <div className="flex items-center gap-3 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold ${step >= s ? 'bg-[#2E6FF2] text-white' : 'bg-[#f5f5f7] text-[#7C8494]'}`}>{s}</div>
              <span className={`text-[12px] ${step >= s ? 'text-[#1B1F2B] font-medium' : 'text-[#7C8494]'}`}>{s === 1 ? '파일 업로드' : s === 2 ? '빈칸 확인' : '정보 입력'}</span>
              {s < 3 && <div className="w-6 h-px bg-[#E2E5EA]" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <label className="border-2 border-dashed border-[#E2E5EA] rounded-xl p-8 text-center hover:border-[#2E6FF2] transition-colors cursor-pointer block">
              <input type="file" accept=".docx,.dotx,.hwpx" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFileChange(file); }} />
              {autoRegFile ? (
                <div>
                  <SuccessIcon />
                  <p className="text-[14px] font-medium text-[#1B1F2B]">{autoRegFile.name}</p>
                  <p className="text-[12px] text-[#7C8494] mt-1">{(autoRegFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <UploadLargeIcon />
                  <p className="text-[14px] text-[#1B1F2B]">DOCX 또는 HWPX 파일을 드래그하거나 클릭</p>
                  <p className="text-[12px] text-[#7C8494] mt-1">양식 문서의 빈칸을 자동으로 감지합니다</p>
                </div>
              )}
            </label>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#7C8494]">취소</button>
              <button onClick={onAnalyze} disabled={!autoRegFile || analyzing} className="px-5 py-2 text-[13px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1a5ad9] disabled:opacity-40 transition-colors">
                {analyzing ? '분석 중...' : '분석 시작'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-[13px] text-[#7C8494] mb-3">감지된 빈칸/플레이스홀더 ({detectedPlaceholders.length}개)</p>
            {detectedPlaceholders.length === 0 ? (
              <div className="text-center py-8 text-[#7C8494] text-[13px]">
                <p>감지된 빈칸이 없습니다.</p>
                <p className="text-[12px] mt-1">이 파일을 그대로 템플릿으로 등록할 수 있습니다.</p>
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto border border-[#E2E5EA] rounded-lg">
                {detectedPlaceholders.map((placeholder, index) => (
                  <div key={placeholder.key} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#E2E5EA] last:border-0">
                    <input type="checkbox" checked={placeholder.selected} onChange={() => onTogglePlaceholder(index)} className="accent-[#2E6FF2]" />
                    <input type="text" value={placeholder.label} onChange={(e) => onRenamePlaceholder(index, e.target.value)} className="flex-1 text-[13px] text-[#1B1F2B] border-0 border-b border-transparent hover:border-[#E2E5EA] focus:border-[#2E6FF2] focus:outline-none py-0.5" />
                    <PlaceholderType type={placeholder.type} />
                  </div>
                ))}
              </div>
            )}

            {(autoRegPreviewHtml || autoRegPreview) && (
              <details className="mt-3" open={Boolean(autoRegPreviewHtml)}>
                <summary className="text-[12px] text-[#7C8494] cursor-pointer">미리보기</summary>
                {autoRegPreviewHtml ? (
                  <iframe
                    title="auto-register-template-preview"
                    srcDoc={autoRegPreviewHtml}
                    className="mt-2 h-[320px] w-full rounded-lg border border-[#E2E5EA] bg-white"
                  />
                ) : null}
                {autoRegPreview ? (
                  <pre className="mt-2 p-3 bg-[#f9fafb] rounded-lg text-[11px] text-[#7C8494] max-h-[120px] overflow-y-auto whitespace-pre-wrap">{autoRegPreview}</pre>
                ) : null}
              </details>
            )}

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => onStepChange(1)} className="px-4 py-2 text-[13px] text-[#7C8494]">이전</button>
              <button onClick={() => onStepChange(3)} className="px-5 py-2 text-[13px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1a5ad9] transition-colors">다음</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="space-y-4">
              <SimpleField label="템플릿 이름">
                <input type="text" value={autoRegName} onChange={(e) => onNameChange(e.target.value)} className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/30 focus:border-[#2E6FF2]" />
              </SimpleField>
              <SimpleField label="설명">
                <textarea value={autoRegDesc} onChange={(e) => onDescChange(e.target.value)} rows={2} className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/30 focus:border-[#2E6FF2] resize-none" />
              </SimpleField>
              <div className="grid grid-cols-2 gap-4">
                <SimpleField label="부서">
                  <select value={autoRegDeptId} onChange={(e) => onDeptChange(e.target.value)} className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/30">
                    <option value="">전사</option>
                    {deptList.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                  </select>
                </SimpleField>
                <SimpleField label="공개 범위">
                  <select value={autoRegScope} onChange={(e) => onScopeChange(e.target.value as '전사 공용' | '부서 전용')} className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/30">
                    <option value="전사 공용">전사 공용</option>
                    <option value="부서 전용">부서 전용</option>
                  </select>
                </SimpleField>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => onStepChange(2)} className="px-4 py-2 text-[13px] text-[#7C8494]">이전</button>
              <button onClick={onSubmit} disabled={autoRegSaving || !autoRegName.trim()} className="px-5 py-2 text-[13px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1a5ad9] disabled:opacity-40 transition-colors">
                {autoRegSaving ? '등록 중...' : '템플릿 등록'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <label className="block text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function SimpleField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] text-[#7C8494] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function FileRow({
  label,
  name,
  size,
  onRemove,
  highlighted = false,
}: {
  label: string;
  name: string;
  size: string;
  onRemove: () => void;
  highlighted?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${highlighted ? 'border-[#0071e3] bg-[#f0f5ff]' : 'border-[#e5e5e7] bg-[#f5f5f7]'}`}>
      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{label}</span>
      <span className="text-sm text-[#1d1d1f] flex-1 truncate">{name}</span>
      <span className="text-xs text-[#6e6e73]">{size}</span>
      <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-white text-[#ff3b30]">
        <CloseIcon />
      </button>
    </div>
  );
}

function PlaceholderType({ type }: { type: string }) {
  const className =
    type === 'blank' ? 'bg-[#ff9f0a]/10 text-[#ff9f0a]' :
    type === 'placeholder' ? 'bg-[#2E6FF2]/10 text-[#2E6FF2]' :
    type === 'underline' ? 'bg-[#7C8494]/10 text-[#7C8494]' :
    'bg-[#30d158]/10 text-[#30d158]';
  const label = type === 'blank' ? '빈칸' : type === 'placeholder' ? '변수' : type === 'underline' ? '밑줄' : '괄호';
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${className}`}>{label}</span>;
}

function UploadIcon() {
  return <svg className="w-5 h-5 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>;
}

function UploadLargeIcon() {
  return <svg className="w-10 h-10 mx-auto mb-2 text-[#7C8494]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>;
}

function SuccessIcon() {
  return <svg className="w-10 h-10 mx-auto mb-2 text-[#30d158]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}

function CloseIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}
