import { useState } from 'react';
import { createTemplateBundle } from '@/lib/templates/template-schema';
import { renderTemplatePreviewHtml } from '@/lib/templates/template-preview';
import type { TemplateItem } from '@/components/documents/page-types';

const AUTO_INPUT_FIELD_KEYS = new Set([
  'author',
  'author_department',
  'author_position',
  'report_date',
  'report_time',
]);

interface NewDocumentGeneralStepProps {
  isWorklogTemplate: boolean;
  selectedTemplate: string | null;
  selectedTemplateItem?: TemplateItem;
  documentInputs: Record<string, string>;
  aiAssistEnabled: boolean;
  aiAssistPrompt: string;
  instructions: string;
  customStructure: string;
  outputFormat: string;
  templateFields: Array<{
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'date';
    required?: boolean;
    placeholder?: string;
    autoFill?: 'user' | 'source' | 'document';
    aiAssist?: boolean;
  }>;
  allowedOutputFormats: readonly string[];
  onSetDocumentInputs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onSetOutputFormat: (value: string) => void;
  onSetInstructions: (value: string) => void;
  onSetAiAssistEnabled: (value: boolean) => void;
  onSetAiAssistPrompt: (value: string) => void;
  onSetCustomStructure: (value: string) => void;
}

export function NewDocumentGeneralStep({
  isWorklogTemplate,
  selectedTemplate,
  selectedTemplateItem,
  documentInputs,
  aiAssistEnabled,
  aiAssistPrompt,
  instructions,
  customStructure,
  outputFormat,
  templateFields,
  allowedOutputFormats,
  onSetDocumentInputs,
  onSetOutputFormat,
  onSetInstructions,
  onSetAiAssistEnabled,
  onSetAiAssistPrompt,
  onSetCustomStructure,
}: NewDocumentGeneralStepProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewBaseBundle = selectedTemplateItem
    ? createTemplateBundle({
        name: selectedTemplateItem.name,
        description: selectedTemplateItem.description,
        outline: selectedTemplateItem.content,
      })
    : null;
  const previewBundle = selectedTemplateItem && previewBaseBundle
    ? {
        ...previewBaseBundle,
        layoutHtml: selectedTemplateItem.templateHtml || previewBaseBundle.layoutHtml,
        fields: selectedTemplateItem.templateFields ?? [],
        sections: selectedTemplateItem.templateSections ?? [],
      }
    : null;
  const previewSrc = selectedTemplateItem?.templateFile ? `/api/templates/${selectedTemplateItem.id}/preview-html` : undefined;
  const previewDoc = selectedTemplateItem && !selectedTemplateItem.templateFile && previewBundle
    ? renderTemplatePreviewHtml(previewBundle, selectedTemplateItem.name)
    : undefined;
  const autoFields = templateFields.filter((field) => field.autoFill);
  const manualFields = templateFields.filter((field) => !field.autoFill && !field.aiAssist);
  const aiFields = templateFields.filter((field) => field.aiAssist);

  return (
    <>
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-foreground" style={{ marginBottom: 8 }}>{isWorklogTemplate ? '수동 입력' : '문서 기본 정보'}</p>
          <div className="grid grid-cols-1 gap-3">
            {manualFields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-foreground-secondary" style={{ marginBottom: 6 }}>
                  {field.label} {field.required && <span className="text-danger">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={documentInputs[field.key] ?? ''}
                    onChange={(e) => onSetDocumentInputs((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    rows={3}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <input
                    type={field.type === 'date' ? 'date' : 'text'}
                    value={documentInputs[field.key] ?? ''}
                    onChange={(e) => onSetDocumentInputs((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {autoFields.length > 0 && (
          <div>
            <p className="text-sm font-medium text-foreground" style={{ marginBottom: 8 }}>자동 입력</p>
            <div className="grid grid-cols-1 gap-3">
              {autoFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-foreground-secondary" style={{ marginBottom: 6 }}>
                    {field.label}
                  </label>
                  <div className="w-full px-4 py-2.5 rounded-xl border border-dashed border-border bg-surface-secondary text-sm text-foreground-secondary">
                    {AUTO_INPUT_FIELD_KEYS.has(field.key)
                      ? '로그인 사용자 정보와 현재 날짜 기준으로 자동 입력됩니다.'
                      : '시스템이 자동 입력합니다.'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aiFields.length > 0 && (
          <div className="rounded-2xl border border-border-tint bg-primary-tint p-4">
            <p className="text-sm font-medium text-foreground">AI 자동 입력</p>
            <div className="mt-3 space-y-3">
              {aiFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-foreground-secondary" style={{ marginBottom: 6 }}>
                    {field.label}
                  </label>
                  <div className="w-full px-4 py-2.5 rounded-xl border border-border-tint bg-white text-sm text-foreground-secondary">
                    선택한 소스 파일 분석과 AI 보강 설정을 기준으로 자동 반영됩니다.
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-foreground" style={{ marginBottom: 8 }}>출력 포맷</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'docx', label: 'DOCX', icon: '📄', desc: '문서 파일' },
              { value: 'hwpx', label: 'HWPX', icon: '📝', desc: '한글 문서' },
              { value: 'pdf', label: 'PDF', icon: '📕', desc: '인쇄용 문서' },
              { value: 'xlsx', label: 'XLSX', icon: '📊', desc: 'Excel 보고서' },
              { value: 'pptx', label: 'PPTX', icon: '📙', desc: '프레젠테이션' },
            ].filter((format) => allowedOutputFormats.includes(format.value)).map((format) => (
              <button
                key={format.value}
                onClick={() => onSetOutputFormat(format.value)}
                className={`p-3 rounded-xl border text-center transition-all ${outputFormat === format.value ? 'border-primary bg-primary-tint ring-2 ring-primary/30' : 'border-border hover:border-primary'}`}
              >
                <span className="text-xl">{format.icon}</span>
                <p className="text-xs font-bold text-foreground mt-1">{format.label}</p>
                <p className="text-[10px] text-foreground-secondary">{format.desc}</p>
              </button>
            ))}
          </div>
          {selectedTemplateItem?.templateFile?.name && (
            <p className="mt-2 text-xs text-foreground-secondary">
              현재 템플릿 파일 형식은 <span className="font-medium text-foreground">{selectedTemplateItem.templateFile.type}</span>이며, 호환되는 출력 포맷만 표시됩니다.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {selectedTemplateItem && (
          <div className="rounded-2xl border border-border bg-surface-secondary px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">템플릿 양식 미리보기</p>
                <p className="mt-1 text-xs text-foreground-secondary">새 문서 미리보기는 팝업에서 확인합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center justify-center rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary"
              >
                미리보기 열기
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col h-full">
          <p className="text-sm text-foreground-secondary" style={{ marginBottom: 10 }}>추가 지시사항 (선택)</p>
          <textarea
            value={instructions}
            onChange={(e) => onSetInstructions(e.target.value)}
            placeholder="예: 핵심 수치 위주로 요약해 주세요. 표 형태로 정리해 주세요."
            rows={14}
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>
        <div className="rounded-2xl border border-border-tint bg-primary-tint p-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={aiAssistEnabled}
              onChange={(e) => onSetAiAssistEnabled(e.target.checked)}
              className="rounded border-primary/30 text-primary focus:ring-primary"
            />
            <div>
              <p className="text-sm font-medium text-foreground">AI 보강 사용</p>
              <p className="text-xs text-foreground-secondary">비어 있는 항목과 서술을 AI가 참조 자료 기준으로 보강합니다.</p>
            </div>
          </label>
          {aiAssistEnabled && (
            <textarea
              value={aiAssistPrompt}
              onChange={(e) => onSetAiAssistPrompt(e.target.value)}
              placeholder="예: 실행안 중심으로 보강하고, 불확실한 값은 [확인필요]로 남겨주세요."
              rows={3}
              className="mt-3 w-full px-4 py-3 rounded-xl border border-border-tint bg-white text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          )}
        </div>
        {selectedTemplate === '__none__' && (
          <div>
            <p className="text-sm font-medium text-foreground" style={{ marginBottom: 5 }}>문서 구조 *</p>
            <p className="text-xs text-foreground-secondary" style={{ marginBottom: 8 }}>AI가 이 구조를 따라 문서를 생성합니다</p>
            <textarea
              value={customStructure}
              onChange={(e) => onSetCustomStructure(e.target.value)}
              placeholder={"예:\n# 업무일지\n## 오늘의 업무\n- 주요 업무 내용 1\n- 주요 업무 내용 2\n## 문제점 및 해결 방안\n## 내일의 계획"}
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
            />
          </div>
        )}
      </div>
    </div>
    {previewOpen && selectedTemplateItem && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-doc-template-preview-title">
        <div className="mx-4 flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-6 py-5">
            <div>
              <h2 id="new-doc-template-preview-title" className="text-lg font-semibold text-foreground">{selectedTemplateItem.name}</h2>
              <p className="mt-1 text-sm text-foreground-secondary">{selectedTemplateItem.description || '템플릿 미리보기'}</p>
            </div>
            <button onClick={() => setPreviewOpen(false)} className="rounded-lg p-1 text-foreground-secondary hover:bg-surface-secondary">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="rounded-2xl border border-border bg-surface-secondary p-3">
              <iframe
                title="selected-template-preview-modal"
                src={previewSrc}
                srcDoc={previewSrc ? undefined : previewDoc}
                className="h-[720px] w-full rounded-xl border border-border bg-white"
              />
            </div>
          </div>
          <div className="flex justify-end border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="rounded-xl border border-border px-5 py-2.5 text-sm text-foreground-secondary transition-colors hover:bg-surface-secondary"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
