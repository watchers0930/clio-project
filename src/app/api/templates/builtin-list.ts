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

type TemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  department: string;
  departmentId: string | null;
  scope: string;
  placeholders: unknown[];
  templateMode: string;
  templateHtml: string;
  templateFields: unknown;
  templateSections: unknown;
  lastUpdated: string;
  usageCount: number;
  templateFile: { id: string; name: string; type: string; size: string } | null;
};

/** GET 핸들러에서 DB 목록에 빌트인 템플릿을 보강해 push한다. */
export function appendBuiltinTemplates(tplList: TemplateListItem[]) {
  if (!tplList.some((template) => template.name === EMPLOYMENT_CERTIFICATE_TEMPLATE_NAME)) {
    const bundle = createEmploymentCertificateTemplateBundle();
    tplList.push({
      id: BUILTIN_EMPLOYMENT_CERTIFICATE_TEMPLATE_ID,
      name: EMPLOYMENT_CERTIFICATE_TEMPLATE_NAME,
      description: '직원 재직 사실 증명서 발급용 템플릿',
      content: bundle.outline,
      department: '전사',
      departmentId: null,
      scope: '전사 공용',
      placeholders: [],
      templateMode: bundle.mode,
      templateHtml: bundle.layoutHtml,
      templateFields: bundle.fields,
      templateSections: bundle.sections,
      lastUpdated: '',
      usageCount: 0,
      templateFile: null,
    });
  }

  if (!tplList.some((template) => template.name === LEAVE_APPLICATION_TEMPLATE_NAME)) {
    const bundle = createLeaveApplicationTemplateBundle();
    tplList.push({
      id: BUILTIN_LEAVE_APPLICATION_TEMPLATE_ID,
      name: LEAVE_APPLICATION_TEMPLATE_NAME,
      description: '휴가 신청서 (남은 휴가일수 자동계산)',
      content: bundle.outline,
      department: '전사',
      departmentId: null,
      scope: '전사 공용',
      placeholders: [],
      templateMode: bundle.mode,
      templateHtml: bundle.layoutHtml,
      templateFields: bundle.fields,
      templateSections: bundle.sections,
      lastUpdated: '',
      usageCount: 0,
      templateFile: null,
    });
  }

  if (!tplList.some((template) => template.name === APPROVAL_REQUEST_TEMPLATE_NAME)) {
    const bundle = createApprovalRequestTemplateBundle();
    tplList.push({
      id: BUILTIN_APPROVAL_REQUEST_TEMPLATE_ID,
      name: APPROVAL_REQUEST_TEMPLATE_NAME,
      description: '기안–검토–승인 결재란 품의서 (기안자 전자서명)',
      content: bundle.outline,
      department: '전사',
      departmentId: null,
      scope: '전사 공용',
      placeholders: [],
      templateMode: bundle.mode,
      templateHtml: bundle.layoutHtml,
      templateFields: bundle.fields,
      templateSections: bundle.sections,
      lastUpdated: '',
      usageCount: 0,
      templateFile: null,
    });
  }

  if (!tplList.some((template) => template.name === STANDARD_LABOR_CONTRACT_TEMPLATE_NAME)) {
    const bundle = createStandardLaborContractTemplateBundle();
    tplList.push({
      id: BUILTIN_STANDARD_LABOR_CONTRACT_TEMPLATE_ID,
      name: STANDARD_LABOR_CONTRACT_TEMPLATE_NAME,
      description: '고용노동부 표준근로계약서(기간의 정함이 없는 경우)',
      content: bundle.outline,
      department: '전사',
      departmentId: null,
      scope: '전사 공용',
      placeholders: [],
      templateMode: bundle.mode,
      templateHtml: bundle.layoutHtml,
      templateFields: bundle.fields,
      templateSections: bundle.sections,
      lastUpdated: '',
      usageCount: 0,
      templateFile: null,
    });
  }

  if (!tplList.some((template) => template.name === WEEKLY_REPORT_TEMPLATE_NAME)) {
    const bundle = createWeeklyReportTemplateBundle();
    tplList.push({
      id: BUILTIN_WEEKLY_REPORT_TEMPLATE_ID,
      name: WEEKLY_REPORT_TEMPLATE_NAME,
      description: '담당–팀장–대표 결재란 주간업무 보고 (작성자 전자서명)',
      content: bundle.outline,
      department: '전사',
      departmentId: null,
      scope: '전사 공용',
      placeholders: [],
      templateMode: bundle.mode,
      templateHtml: bundle.layoutHtml,
      templateFields: bundle.fields,
      templateSections: bundle.sections,
      lastUpdated: '',
      usageCount: 0,
      templateFile: null,
    });
  }
}
