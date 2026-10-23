'use client';

import { useCallback } from 'react';
import type { TemplateFieldDefinition } from '@/lib/templates/template-schema';
import { LeaveEmployeePicker } from '@/components/documents/LeaveEmployeePicker';
import { EmploymentCertAutofill, type SelfProfile } from '@/components/documents/EmploymentCertAutofill';
import { WeeklyWorkRowsEditor } from '@/components/documents/WeeklyWorkRowsEditor';
import { MeetingContentInput } from '@/components/documents/MeetingContentInput';
import { TemplateFieldInput } from '@/components/documents/TemplateFieldInput';
import { NDA_CLAUSE_TEXT } from '@/lib/templates/standard-labor-contract';

/**
 * 생성·편집 공용 입력폼. 필드 그룹(자동/수동/AI)·조건부 노출(showWhen)·양식별 특수 UI
 * (휴가원 직원선택·재직증명서 프로필·주간업무 행·회의록·근로계약서 서약)를 조합한다.
 *
 * 단일 책임: 입력값 UI만 담당한다. PATCH 저장·뷰어 상태·생성 실행·출력 포맷은 이 컴포넌트의
 * 책임이 아니다(각각 저장 훅 / 뷰어 / 생성 step이 담당). 값 갱신은 함수형 onChange로 위임한다.
 *
 * mode:
 *  - create: 생성 폼(기존 동작 보존). 재직증명서 프로필은 자동 반영.
 *  - edit:   입력값 편집. 저장값을 우선 표시하고, 재직증명서 프로필은 "현재 프로필 반영" 동작으로만.
 */
const AUTO_INPUT_FIELD_KEYS = new Set([
  'author',
  'author_department',
  'author_position',
  'report_date',
  'report_time',
]);

interface DocumentInputFieldsProps {
  mode: 'create' | 'edit';
  templateName?: string | null;
  templateFields: TemplateFieldDefinition[];
  documentInputs: Record<string, string>;
  onSetDocumentInputs: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  extractedFieldKeys?: Set<string>;
  /** 생성 폼에서 "수동 입력" 라벨을 쓰는 양식(업무일지) 여부 */
  manualLabel?: string;
}

export function DocumentInputFields({
  mode,
  templateName,
  templateFields,
  documentInputs,
  onSetDocumentInputs,
  extractedFieldKeys,
  manualLabel,
}: DocumentInputFieldsProps) {
  const name = templateName ?? '';
  const isStandardLaborContract = /근로계약서/.test(name);
  const isWeeklyReport = /주간\s*업무/.test(name);
  const isMeeting = name === '회의록';
  const isEmploymentCert = name === '재직증명서';
  const isLeave = name === '휴가원';

  const autoFields = templateFields.filter((field) => field.autoFill);
  // nda_agree/work_rows/next_week_plan은 일반 수동 그리드가 아니라 별도 특수 UI에서 처리
  const allManualFields = templateFields.filter(
    (field) =>
      !field.autoFill &&
      !field.aiAssist &&
      field.key !== 'nda_agree' &&
      field.key !== 'work_rows' &&
      field.key !== 'next_week_plan',
  );
  const aiFields = templateFields.filter((field) => field.aiAssist);

  // 재직증명서 생성: 본인 정보 자동입력 → 제출용도만 노출(자동입력 안 된 필수 필드는 노출).
  // 편집: 저장된 인적사항을 그대로 보여주고 수정 가능해야 하므로 숨기지 않는다.
  const baseManualFields =
    mode === 'create' && isEmploymentCert
      ? allManualFields.filter(
          (field) => field.key === 'purpose' || (field.required && !documentInputs[field.key]?.trim()),
        )
      : allManualFields;

  // showWhen 조건부 필드: 다른 필드 값에 따라 노출
  const manualFields = baseManualFields.filter((field) => {
    if (!field.showWhen) return true;
    const depValue = (documentInputs[field.showWhen.field] ?? '').trim();
    if (field.showWhen.equals !== undefined) return depValue === field.showWhen.equals;
    if (field.showWhen.notEquals !== undefined) return depValue !== field.showWhen.notEquals;
    return true;
  });

  const nextWeekPlanField = templateFields.find((f) => f.key === 'next_week_plan');

  const handleCertAutofill = useCallback(
    (p: SelfProfile) => {
      onSetDocumentInputs((prev) => ({
        ...prev,
        employee_name: p.name || prev.employee_name || '',
        resident_registration_no: p.resident_no || prev.resident_registration_no || '',
        employee_address: p.address || prev.employee_address || '',
        department: p.department || prev.department || '',
        position: p.position || prev.position || '',
        employment_start_date: p.hire_date || prev.employment_start_date || '',
      }));
    },
    [onSetDocumentInputs],
  );

  return (
    <div className="flex flex-col gap-6">
      {autoFields.length > 0 && (
        <div>
          <p className="text-sm font-medium text-foreground" style={{ marginBottom: 8 }}>자동 입력</p>
          <div className="grid grid-cols-2 gap-3">
            {autoFields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-foreground-secondary" style={{ marginBottom: 6 }}>
                  {field.label}
                </label>
                <div className="w-full px-4 py-2.5 rounded-xl border border-dashed border-border bg-surface-secondary text-sm text-foreground-secondary">
                  {documentInputs[field.key]?.trim() ? (
                    <span className="text-foreground">{documentInputs[field.key]}</span>
                  ) : mode === 'edit' ? (
                    '—'
                  ) : AUTO_INPUT_FIELD_KEYS.has(field.key) ? (
                    '로그인 사용자 정보와 현재 날짜 기준으로 자동 입력됩니다.'
                  ) : (
                    '시스템이 자동 입력합니다.'
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-foreground" style={{ marginBottom: 8 }}>
          {manualLabel ?? '문서 기본 정보'}
        </p>

        {isEmploymentCert && (
          <div style={{ marginBottom: 12 }}>
            <EmploymentCertAutofill mode={mode} onLoaded={handleCertAutofill} />
          </div>
        )}

        {isLeave && (
          <div style={{ marginBottom: 12 }}>
            <LeaveEmployeePicker
              onSelect={(m, deptName) =>
                onSetDocumentInputs((prev) => ({
                  ...prev,
                  department: deptName || prev.department || '',
                  employee_name: m.name,
                  hire_date: m.hire_date ?? prev.hire_date ?? '',
                  emergency_contact: m.phone ?? prev.emergency_contact ?? '',
                }))
              }
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {manualFields.map((field) => (
            <TemplateFieldInput
              key={field.key}
              field={field}
              value={documentInputs[field.key] ?? ''}
              onChange={onSetDocumentInputs}
              extracted={extractedFieldKeys?.has(field.key)}
            />
          ))}
        </div>

        {isWeeklyReport && (
          <div style={{ marginTop: 12 }}>
            <WeeklyWorkRowsEditor
              value={documentInputs.work_rows ?? ''}
              onChange={(json) => onSetDocumentInputs((prev) => ({ ...prev, work_rows: json }))}
            />
          </div>
        )}
        {isWeeklyReport && nextWeekPlanField && (
          <TemplateFieldInput
            field={nextWeekPlanField}
            value={documentInputs.next_week_plan ?? ''}
            onChange={onSetDocumentInputs}
            extracted={extractedFieldKeys?.has('next_week_plan')}
          />
        )}

        {isMeeting && (
          <div style={{ marginTop: 12 }}>
            <MeetingContentInput
              summaryValue={documentInputs.meeting_summary ?? ''}
              resultValue={documentInputs.meeting_result ?? ''}
              onChangeSummary={(v) => onSetDocumentInputs((prev) => ({ ...prev, meeting_summary: v }))}
              onChangeResult={(v) => onSetDocumentInputs((prev) => ({ ...prev, meeting_result: v }))}
            />
          </div>
        )}
      </div>

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
                  {mode === 'edit' && documentInputs[field.key]?.trim()
                    ? documentInputs[field.key]
                    : '선택한 소스 파일 분석과 AI 보강 설정을 기준으로 자동 반영됩니다.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isStandardLaborContract && (
        <div className="rounded-2xl border border-primary/30 bg-primary-tint p-4">
          <p className="text-sm font-medium text-foreground" style={{ marginBottom: 8 }}>비밀유지의무 서약</p>
          <div
            className="max-h-44 overflow-y-auto rounded-lg border border-border bg-white px-3 py-2.5 text-xs leading-relaxed text-foreground-secondary"
            style={{ marginBottom: 12 }}
          >
            {NDA_CLAUSE_TEXT}
          </div>
          <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={documentInputs.nda_agree === '동의'}
              onChange={(e) =>
                onSetDocumentInputs((prev) => ({ ...prev, nda_agree: e.target.checked ? '동의' : '' }))
              }
              className="mt-0.5 rounded border-border text-primary focus:ring-primary"
            />
            <span>위 비밀유지의무에 동의하며 이를 성실히 준수할 것을 서약합니다.</span>
          </label>
        </div>
      )}
    </div>
  );
}
