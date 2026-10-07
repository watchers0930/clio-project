import type { DbTemplate } from '@/lib/supabase/types';
import { parseTemplateBundle, type TemplateBundle } from '@/lib/templates/template-schema';
import {
  createEmploymentCertificateTemplateBundle,
  EMPLOYMENT_CERTIFICATE_TEMPLATE_NAME,
} from '@/lib/templates/employment-certificate';
import {
  createLeaveApplicationTemplateBundle,
  LEAVE_APPLICATION_TEMPLATE_NAME,
} from '@/lib/templates/leave-application';
import {
  createApprovalRequestTemplateBundle,
  APPROVAL_REQUEST_TEMPLATE_NAME,
} from '@/lib/templates/approval-request';
import {
  createStandardLaborContractTemplateBundle,
  STANDARD_LABOR_CONTRACT_TEMPLATE_NAME,
} from '@/lib/templates/standard-labor-contract';

/**
 * 빌트인(코드 내장) 템플릿 — DB `templates` 테이블에 없고 코드에서 생성한다.
 * 생성(generate/route-helpers)과 다운로드(documents/[id]/download)가 동일한 번들을 써야
 * PDF가 템플릿 양식(표·조항·결재란)으로 렌더된다. 단일 소스로 두어 경로 간 불일치를 막는다.
 */
export const BUILTIN_EMPLOYMENT_CERTIFICATE_TEMPLATE_ID = '__builtin_employment_certificate__';
export const BUILTIN_LEAVE_APPLICATION_TEMPLATE_ID = '__builtin_leave_application__';
export const BUILTIN_APPROVAL_REQUEST_TEMPLATE_ID = '__builtin_approval_request__';
export const BUILTIN_STANDARD_LABOR_CONTRACT_TEMPLATE_ID = '__builtin_standard_labor_contract__';

type BuiltinTemplateRecord = Pick<
  DbTemplate,
  'name' | 'content' | 'description' | 'placeholders' | 'template_file_id'
>;

/** 빌트인 템플릿 ID면 tmpl 레코드(content=번들 JSON) 반환, 아니면 null. */
export function resolveBuiltinTemplate(
  templateId: string | undefined | null,
): BuiltinTemplateRecord | null {
  switch (templateId) {
    case BUILTIN_EMPLOYMENT_CERTIFICATE_TEMPLATE_ID:
      return {
        name: EMPLOYMENT_CERTIFICATE_TEMPLATE_NAME,
        content: JSON.stringify(createEmploymentCertificateTemplateBundle()),
        description: '직원 재직 사실 증명서 발급용 템플릿',
        placeholders: [],
        template_file_id: null,
      };
    case BUILTIN_LEAVE_APPLICATION_TEMPLATE_ID:
      return {
        name: LEAVE_APPLICATION_TEMPLATE_NAME,
        content: JSON.stringify(createLeaveApplicationTemplateBundle()),
        description: '휴가 신청서 (남은 휴가일수 자동계산)',
        placeholders: [],
        template_file_id: null,
      };
    case BUILTIN_APPROVAL_REQUEST_TEMPLATE_ID:
      return {
        name: APPROVAL_REQUEST_TEMPLATE_NAME,
        content: JSON.stringify(createApprovalRequestTemplateBundle()),
        description: '기안-검토-승인 결재란 품의서 (기안자 전자서명)',
        placeholders: [],
        template_file_id: null,
      };
    case BUILTIN_STANDARD_LABOR_CONTRACT_TEMPLATE_ID:
      return {
        name: STANDARD_LABOR_CONTRACT_TEMPLATE_NAME,
        content: JSON.stringify(createStandardLaborContractTemplateBundle()),
        description: '고용노동부 표준근로계약서(기간의 정함이 없는 경우)',
        placeholders: [],
        template_file_id: null,
      };
    default:
      return null;
  }
}

/** 빌트인 템플릿 ID면 파싱된 번들+이름 반환(다운로드/PDF 렌더 경로용), 아니면 null. */
export function resolveBuiltinTemplateBundle(
  templateId: string | undefined | null,
): { name: string; bundle: TemplateBundle } | null {
  const rec = resolveBuiltinTemplate(templateId);
  if (!rec) return null;
  const bundle = parseTemplateBundle(rec.content, {
    name: rec.name,
    description: rec.description,
    placeholders: rec.placeholders,
  });
  return bundle ? { name: rec.name, bundle } : null;
}
