import type { TemplateItem } from '@/components/documents/page-types';
import type { TemplateFieldDefinition } from '@/lib/templates/template-schema';
import { DocumentInputFields } from '@/components/documents/document-input-fields';
import { useDocumentInputAutofill } from '@/components/documents/use-document-input-autofill';

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
  templateFields: TemplateFieldDefinition[];
  allowedOutputFormats: readonly string[];
  extractedFieldKeys?: Set<string>;
  onSetDocumentInputs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onSetOutputFormat: (value: string) => void;
  onSetInstructions: (value: string) => void;
  onSetAiAssistEnabled: (value: boolean) => void;
  onSetAiAssistPrompt: (value: string) => void;
  onSetCustomStructure: (value: string) => void;
}

/**
 * 새 문서 생성 폼의 "기본 정보" step.
 * 입력값 영역은 생성·편집 공용 `DocumentInputFields`로 위임하고,
 * 이 컴포넌트는 생성 전용 설정(출력 포맷·커스텀 구조)과 생성 자동채움 정책만 조합한다.
 */
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
  extractedFieldKeys,
  onSetDocumentInputs,
  onSetOutputFormat,
  onSetInstructions,
  onSetAiAssistEnabled,
  onSetAiAssistPrompt,
  onSetCustomStructure,
}: NewDocumentGeneralStepProps) {
  // 미사용(과거 보조 입력 UI) — 인터페이스/상위 호출 호환을 위해 수신만 한다.
  void aiAssistEnabled;
  void aiAssistPrompt;
  void instructions;
  void onSetInstructions;
  void onSetAiAssistEnabled;
  void onSetAiAssistPrompt;

  const templateName = selectedTemplateItem?.name;
  const isWeeklyReport = Boolean(templateName && /주간\s*업무/.test(templateName));

  // 생성 자동채움: 본인 정보 프리필 + 주간업무 보고기간 이번 주 설정(비어 있을 때만)
  useDocumentInputAutofill({
    mode: 'create',
    templateName,
    templateFields,
    isWeeklyReport,
    reportPeriod: documentInputs.report_period,
    onSetDocumentInputs,
  });

  return (
    <div className="flex flex-col gap-6">
      <DocumentInputFields
        mode="create"
        templateName={templateName}
        templateFields={templateFields}
        documentInputs={documentInputs}
        onSetDocumentInputs={onSetDocumentInputs}
        extractedFieldKeys={extractedFieldKeys}
        manualLabel={isWorklogTemplate ? '수동 입력' : '문서 기본 정보'}
      />

      <div>
        <p className="text-sm font-medium text-foreground" style={{ marginBottom: 8 }}>출력 포맷</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'docx', label: 'DOCX', icon: '📄', desc: '문서 파일' },
            { value: 'hwpx', label: 'HWPX', icon: '📝', desc: '한글 문서' },
            { value: 'pdf', label: 'PDF', icon: '📕', desc: '인쇄용 문서' },
            { value: 'xlsx', label: 'XLSX', icon: '📊', desc: 'Excel 보고서' },
            { value: 'pptx', label: 'PPTX', icon: '📙', desc: '프레젠테이션' },
          ]
            .filter((format) => allowedOutputFormats.includes(format.value))
            .map((format) => (
              <button
                key={format.value}
                onClick={() => onSetOutputFormat(format.value)}
                className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center text-center ${
                  outputFormat === format.value
                    ? 'border-primary bg-primary-tint ring-2 ring-primary/30'
                    : 'border-border hover:border-primary'
                }`}
              >
                <span className="text-xl leading-none">{format.icon}</span>
                <p className="text-xs font-bold text-foreground mt-1">{format.label}</p>
                <p className="text-[10px] text-foreground-secondary">{format.desc}</p>
              </button>
            ))}
        </div>
        {selectedTemplateItem?.templateFile?.name && (
          <p className="mt-2 text-xs text-foreground-secondary">
            현재 템플릿 파일 형식은{' '}
            <span className="font-medium text-foreground">{selectedTemplateItem.templateFile.type}</span>이며, 호환되는
            출력 포맷만 표시됩니다.
          </p>
        )}
      </div>

      {selectedTemplate === '__none__' && (
        <div>
          <p className="text-sm font-medium text-foreground" style={{ marginBottom: 5 }}>문서 구조 *</p>
          <p className="text-xs text-foreground-secondary" style={{ marginBottom: 8 }}>AI가 이 구조를 따라 문서를 생성합니다</p>
          <textarea
            value={customStructure}
            onChange={(e) => onSetCustomStructure(e.target.value)}
            placeholder={'예:\n# 업무일지\n## 오늘의 업무\n- 주요 업무 내용 1\n- 주요 업무 내용 2\n## 문제점 및 해결 방안\n## 내일의 계획'}
            rows={6}
            className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
          />
        </div>
      )}
    </div>
  );
}
