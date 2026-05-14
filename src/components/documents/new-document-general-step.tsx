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
    <div className="grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-6">
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 8 }}>{isWorklogTemplate ? '수동 입력' : '문서 기본 정보'}</p>
          <div className="grid grid-cols-1 gap-3">
            {manualFields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-[#6e6e73]" style={{ marginBottom: 6 }}>
                  {field.label} {field.required && <span className="text-[#ff3b30]">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={documentInputs[field.key] ?? ''}
                    onChange={(e) => onSetDocumentInputs((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    rows={3}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                  />
                ) : (
                  <input
                    type={field.type === 'date' ? 'date' : 'text'}
                    value={documentInputs[field.key] ?? ''}
                    onChange={(e) => onSetDocumentInputs((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#c7c7cc] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {autoFields.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 8 }}>자동 입력</p>
            <div className="grid grid-cols-1 gap-3">
              {autoFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-[#6e6e73]" style={{ marginBottom: 6 }}>
                    {field.label}
                  </label>
                  <div className="w-full px-4 py-2.5 rounded-xl border border-dashed border-[#d1d1d6] bg-[#f5f5f7] text-sm text-[#6e6e73]">
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
          <div className="rounded-2xl border border-[#d7e7ff] bg-[#f5f8ff] p-4">
            <p className="text-sm font-medium text-[#1d1d1f]">AI 자동 입력</p>
            <div className="mt-3 space-y-3">
              {aiFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-[#6e6e73]" style={{ marginBottom: 6 }}>
                    {field.label}
                  </label>
                  <div className="w-full px-4 py-2.5 rounded-xl border border-[#d7e7ff] bg-white text-sm text-[#6e6e73]">
                    선택한 소스 파일 분석과 AI 보강 설정을 기준으로 자동 반영됩니다.
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 8 }}>출력 포맷</p>
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
                className={`p-3 rounded-xl border text-center transition-all ${outputFormat === format.value ? 'border-[#0071e3] bg-[#f0f5ff] ring-2 ring-[#0071e3]/30' : 'border-[#e5e5e7] hover:border-[#0071e3]'}`}
              >
                <span className="text-xl">{format.icon}</span>
                <p className="text-xs font-bold text-[#1d1d1f] mt-1">{format.label}</p>
                <p className="text-[10px] text-[#6e6e73]">{format.desc}</p>
              </button>
            ))}
          </div>
          {selectedTemplateItem?.templateFile?.name && (
            <p className="mt-2 text-xs text-[#6e6e73]">
              현재 템플릿 파일 형식은 <span className="font-medium text-[#1d1d1f]">{selectedTemplateItem.templateFile.type}</span>이며, 호환되는 출력 포맷만 표시됩니다.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex flex-col h-full">
          <p className="text-sm text-[#6e6e73]" style={{ marginBottom: 10 }}>추가 지시사항 (선택)</p>
          <textarea
            value={instructions}
            onChange={(e) => onSetInstructions(e.target.value)}
            placeholder="예: 핵심 수치 위주로 요약해 주세요. 표 형태로 정리해 주세요."
            rows={14}
            className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] resize-none"
          />
        </div>
        <div className="rounded-2xl border border-[#d7e7ff] bg-[#f5f8ff] p-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={aiAssistEnabled}
              onChange={(e) => onSetAiAssistEnabled(e.target.checked)}
              className="rounded border-[#c7d7f7] text-[#2e6ff2] focus:ring-[#2e6ff2]"
            />
            <div>
              <p className="text-sm font-medium text-[#1d1d1f]">AI 보강 사용</p>
              <p className="text-xs text-[#5e6573]">비어 있는 항목과 서술을 AI가 참조 자료 기준으로 보강합니다.</p>
            </div>
          </label>
          {aiAssistEnabled && (
            <textarea
              value={aiAssistPrompt}
              onChange={(e) => onSetAiAssistPrompt(e.target.value)}
              placeholder="예: 실행안 중심으로 보강하고, 불확실한 값은 [확인필요]로 남겨주세요."
              rows={3}
              className="mt-3 w-full px-4 py-3 rounded-xl border border-[#d7e7ff] bg-white text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] resize-none"
            />
          )}
        </div>
        {selectedTemplate === '__none__' && (
          <div>
            <p className="text-sm font-medium text-[#1d1d1f]" style={{ marginBottom: 5 }}>문서 구조 *</p>
            <p className="text-xs text-[#6e6e73]" style={{ marginBottom: 8 }}>AI가 이 구조를 따라 문서를 생성합니다</p>
            <textarea
              value={customStructure}
              onChange={(e) => onSetCustomStructure(e.target.value)}
              placeholder={"예:\n# 업무일지\n## 오늘의 업무\n- 주요 업무 내용 1\n- 주요 업무 내용 2\n## 문제점 및 해결 방안\n## 내일의 계획"}
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-[#e5e5e7] bg-white text-sm text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3] resize-none font-mono"
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[#1d1d1f]">템플릿 양식 미리보기</p>
          <p className="text-xs text-[#6e6e73]">입력값은 생성 시 양식 기준으로 반영됩니다.</p>
        </div>
        {selectedTemplateItem ? (
          <div className="rounded-2xl border border-[#e5e5e7] bg-[#f5f7fb] p-3">
            <iframe
              title="selected-template-preview"
              src={previewSrc}
              srcDoc={previewSrc ? undefined : previewDoc}
              className="h-[720px] w-full rounded-xl border border-[#dfe4ea] bg-white"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d1d1d6] bg-[#fafafa] px-4 py-10 text-center text-sm text-[#6e6e73]">
            직접 작성 문서는 템플릿 양식 미리보기가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
