import { Spinner } from '@/components/ui';
import type { DocumentItem, TemplateItem } from '@/components/documents/page-types';
import type { TemplateFieldDefinition } from '@/lib/templates/template-schema';

interface NewDocumentConfirmStepProps {
  selectedTemplate: string | null;
  selectedTemplateItem?: TemplateItem;
  selectedFiles: Set<string>;
  outputFormat: string;
  referenceDocId: string | null;
  referenceDocuments: DocumentItem[];
  documentInputs: Record<string, string>;
  templateFields: TemplateFieldDefinition[];
  instructions: string;
  aiAssistEnabled: boolean;
  aiAssistPrompt: string;
  generating: boolean;
}

/**
 * 새 문서 생성 폼의 "확인" step.
 * 선택한 템플릿·소스·포맷·입력값 요약과 생성 진행 상태를 보여준다.
 */
export function NewDocumentConfirmStep({
  selectedTemplate,
  selectedTemplateItem,
  selectedFiles,
  outputFormat,
  referenceDocId,
  referenceDocuments,
  documentInputs,
  templateFields,
  instructions,
  aiAssistEnabled,
  aiAssistPrompt,
  generating,
}: NewDocumentConfirmStepProps) {
  return (
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
  );
}
