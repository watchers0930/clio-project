'use client';

import { useMemo } from 'react';
import type { DocumentItem } from '@/components/documents/page-types';
import type { TemplateFieldDefinition } from '@/lib/templates/template-schema';
import { DocumentInputFields } from '@/components/documents/document-input-fields';
import { parseWorkRows } from '@/components/documents/WeeklyWorkRowsEditor';
import {
  resolveDocumentInputForm,
  type ResolveInputFormResult,
} from '@/lib/documents/resolve-input-form';
import { parseEmbeddedInputs, buildContentWithInputs } from '@/lib/documents/embedded-inputs';

/**
 * 뷰어의 `입력값 편집` 모드. 저장된 content의 선두 DOCUMENT_INPUTS를 공용 폼 값으로 복원하고,
 * 필드 변경을 `buildContentWithInputs`로 editContent에 반영한다(본문은 그대로 보존).
 *
 * 단일 책임: 복원 결과·오류 표시와 공용 폼을 뷰어에 연결. 전체 뷰어/다운로드 UI·파싱 로직 자체는
 * 담당하지 않는다(파싱·식별은 lib 순수 유틸, 저장은 저장 훅).
 */
const reasonMessage = (result: ResolveInputFormResult): string => {
  if (result.ok) return '';
  switch (result.reason) {
    case 'not-target':
      return '이 문서는 입력값 편집 대상 양식이 아닙니다. 원문 편집을 사용하세요.';
    case 'ambiguous':
      return '양식 정의가 모호하여 입력값 편집을 열 수 없습니다(제목/템플릿 충돌). 원문 편집을 사용하세요.';
    case 'no-inputs':
      return '입력값 정보(선두 주석)가 없어 복원할 수 없습니다. 원문 편집을 사용하세요.';
    case 'parse-error':
      return '입력값 정보가 손상되어 복원할 수 없습니다. 원문 편집을 사용하세요.';
    default:
      return '입력값 편집을 열 수 없습니다.';
  }
};

/** 뷰어 토글 버튼 활성/비활성 판별용(파싱·식별을 이 모듈에 집약). */
export function getInputEditorAvailability(
  doc: Pick<DocumentItem, 'title' | 'templateId' | 'template' | 'content'>,
  content: string,
): { available: boolean; reason: string } {
  const result = resolveDocumentInputForm({
    title: doc.title,
    templateId: doc.templateId,
    templateName: doc.template,
    content,
  });
  return { available: result.ok, reason: reasonMessage(result) };
}

const isFieldVisible = (field: TemplateFieldDefinition, values: Record<string, string>): boolean => {
  if (!field.showWhen) return true;
  const dep = (values[field.showWhen.field] ?? '').trim();
  if (field.showWhen.equals !== undefined) return dep === field.showWhen.equals;
  if (field.showWhen.notEquals !== undefined) return dep !== field.showWhen.notEquals;
  return true;
};

/**
 * 입력값 검증(필수 누락 + 주간업무 손상)을 공유하는 순수 판정. 입력값 저장 버튼뿐 아니라
 * 모달의 "초안 저장"·"완료 문서로 전환"도 같은 기준을 적용해 검증 우회를 막는다(설계 §6).
 * - applicable:false = 입력값 편집 대상 양식이 아님 → 검증을 적용하지 않음(valid:true).
 */
export function getInputValidationState(
  doc: Pick<DocumentItem, 'title' | 'templateId' | 'template' | 'content'>,
  content: string,
): { applicable: boolean; valid: boolean; missingLabels: string[] } {
  const resolved = resolveDocumentInputForm({
    title: doc.title,
    templateId: doc.templateId,
    templateName: doc.template,
    content,
  });
  if (!resolved.ok) return { applicable: false, valid: true, missingLabels: [] };
  const parsed = parseEmbeddedInputs(content);
  const values = parsed.ok ? parsed.inputs : {};
  const missingLabels = resolved.form.fields
    .filter((field) => field.required && isFieldVisible(field, values) && !values[field.key]?.trim())
    .map((field) => field.label);
  if (resolved.form.kind === 'weekly' && !parseWorkRows(values.work_rows ?? '').ok) {
    missingLabels.push('금주 업무(손상된 데이터)');
  }
  return { applicable: true, valid: missingLabels.length === 0, missingLabels };
}

interface DocumentInputEditorProps {
  viewDoc: DocumentItem;
  editContent: string;
  saving: boolean;
  onChangeContent: (content: string) => void;
  onSaveInputs: () => Promise<boolean> | void;
}

export function DocumentInputEditor({
  viewDoc,
  editContent,
  saving,
  onChangeContent,
  onSaveInputs,
}: DocumentInputEditorProps) {
  // 양식 정의(fields/ui)는 구조 정보라 값(content)에 따라 바뀌지 않는다 → 문서 식별자 기준 메모.
  const resolved = useMemo(
    () =>
      resolveDocumentInputForm({
        title: viewDoc.title,
        templateId: viewDoc.templateId,
        templateName: viewDoc.template,
        content: editContent,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 식별은 제목/템플릿/주석 유무에만 의존
    [viewDoc.id, viewDoc.title, viewDoc.templateId, viewDoc.template],
  );

  // 현재 편집 중 content에서 폼 값을 복원(단일 출처).
  const parsed = useMemo(() => parseEmbeddedInputs(editContent), [editContent]);
  const values = parsed.ok ? parsed.inputs : {};

  if (!resolved.ok) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-border bg-white px-6 py-4 text-sm text-foreground-secondary">
        {reasonMessage(resolved)}
      </div>
    );
  }

  const { form } = resolved;

  const handleChange = (updater: (prev: Record<string, string>) => Record<string, string>) => {
    const current = parsed.ok ? parsed.inputs : {};
    const next = updater(current);
    const result = buildContentWithInputs(editContent, next);
    // ok:false면(주석 없음/손상/제안서) 편집을 반영하지 않는다(본문 보존·오염 방지).
    if (result.ok) onChangeContent(result.content);
  };

  const missingRequired = form.fields.filter(
    (field) => field.required && isFieldVisible(field, values) && !values[field.key]?.trim(),
  );
  // 주간업무 손상 work_rows는 저장을 차단한다(정상 새 행으로 덮어쓰기 방지, 설계 §6 Phase 5).
  const workRowsCorrupt = form.kind === 'weekly' && !parseWorkRows(values.work_rows ?? '').ok;
  const canSave = !saving && missingRequired.length === 0 && !workRowsCorrupt;

  return (
    <div className="flex h-full min-h-[400px] flex-col gap-4 overflow-y-auto">
      <div className="space-y-1.5 rounded-xl bg-primary-tint/60 px-4 py-3 text-xs leading-relaxed text-foreground-secondary">
        <p>입력값은 <strong>초안 저장</strong> 후 레이아웃 보기에 반영됩니다.</p>
        {form.kind === 'leave' && (
          <p>문서 입력값만 변경됩니다. 연결된 휴가 신청은 <strong>휴가 관리</strong>에서 수정하세요.</p>
        )}
        <p>원본 파일(DOCX/HWPX 등) 다운로드 최신화는 후속 범위입니다(레이아웃 미리보기에 우선 반영).</p>
      </div>

      <DocumentInputFields
        mode="edit"
        templateName={form.templateName}
        templateFields={form.fields}
        documentInputs={values}
        onSetDocumentInputs={handleChange}
      />

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-white pt-3">
        {missingRequired.length > 0 && (
          <p className="text-xs text-danger">
            필수 항목을 입력하세요: {missingRequired.map((f) => f.label).join(', ')}
          </p>
        )}
        {workRowsCorrupt && (
          <p className="text-xs text-danger">
            금주 업무 데이터가 손상되어 저장할 수 없습니다. 위 표에서 복구 후 다시 시도하세요.
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSaveInputs()}
            disabled={!canSave}
            className="rounded-xl border border-primary px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary-tint disabled:opacity-40"
          >
            {saving ? '저장 중...' : '입력값 저장'}
          </button>
          <span className="text-xs text-foreground-quaternary">저장하면 레이아웃 보기에서 최신 입력값을 확인할 수 있습니다.</span>
        </div>
      </div>
    </div>
  );
}
