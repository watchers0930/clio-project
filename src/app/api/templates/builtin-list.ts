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
import {
  createWeeklyReportTemplateBundle,
  WEEKLY_REPORT_TEMPLATE_NAME,
} from '@/lib/templates/weekly-report';
import {
  BUILTIN_EMPLOYMENT_CERTIFICATE_TEMPLATE_ID,
  BUILTIN_LEAVE_APPLICATION_TEMPLATE_ID,
  BUILTIN_APPROVAL_REQUEST_TEMPLATE_ID,
  BUILTIN_STANDARD_LABOR_CONTRACT_TEMPLATE_ID,
  BUILTIN_WEEKLY_REPORT_TEMPLATE_ID,
} from '@/lib/templates/builtin';
import type { TemplateBundle } from '@/lib/templates/template-schema';
import { templateBundleFields, type TemplateListItem } from './template-io';

/** 목록에 보강하는 빌트인 양식(순서 = 목록 노출 순서). 번들은 실제로 추가할 때만 만든다. */
const BUILTIN_TEMPLATES: ReadonlyArray<{ id: string; name: string; description: string; createBundle: () => TemplateBundle }> = [
  { id: BUILTIN_EMPLOYMENT_CERTIFICATE_TEMPLATE_ID, name: EMPLOYMENT_CERTIFICATE_TEMPLATE_NAME, description: '직원 재직 사실 증명서 발급용 템플릿', createBundle: createEmploymentCertificateTemplateBundle },
  { id: BUILTIN_LEAVE_APPLICATION_TEMPLATE_ID, name: LEAVE_APPLICATION_TEMPLATE_NAME, description: '휴가 신청서 (남은 휴가일수 자동계산)', createBundle: createLeaveApplicationTemplateBundle },
  { id: BUILTIN_APPROVAL_REQUEST_TEMPLATE_ID, name: APPROVAL_REQUEST_TEMPLATE_NAME, description: '기안–검토–승인 결재란 품의서 (기안자 전자서명)', createBundle: createApprovalRequestTemplateBundle },
  { id: BUILTIN_STANDARD_LABOR_CONTRACT_TEMPLATE_ID, name: STANDARD_LABOR_CONTRACT_TEMPLATE_NAME, description: '고용노동부 표준근로계약서(기간의 정함이 없는 경우)', createBundle: createStandardLaborContractTemplateBundle },
  { id: BUILTIN_WEEKLY_REPORT_TEMPLATE_ID, name: WEEKLY_REPORT_TEMPLATE_NAME, description: '담당–팀장–대표 결재란 주간업무 보고 (작성자 전자서명)', createBundle: createWeeklyReportTemplateBundle },
];

/** GET 핸들러에서 DB 목록에 빌트인 템플릿을 보강해 push한다(같은 이름의 DB 템플릿이 있으면 건너뜀). */
export function appendBuiltinTemplates(tplList: TemplateListItem[]) {
  for (const builtin of BUILTIN_TEMPLATES) {
    if (tplList.some((template) => template.name === builtin.name)) continue;
    tplList.push({
      id: builtin.id,
      name: builtin.name,
      description: builtin.description,
      ...templateBundleFields(builtin.createBundle()),
      department: '전사',
      departmentId: null,
      scope: '전사 공용',
      placeholders: [],
      lastUpdated: '',
      usageCount: 0,
      templateFile: null,
    });
  }
}
