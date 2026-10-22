// 직원 주간업무 조회 화면 공용 타입 (CEO/관리자 전용)

/** GET /api/weekly-reports/overview 가 반환하는 리포트 1건 */
export interface WeeklyReport {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorRank: string;
  authorDeptId: string | null;
  authorDept: string;
}

export interface OverviewResponse {
  success: boolean;
  reports?: WeeklyReport[];
  error?: string;
}

/** GET /api/org/members 반환 구조 */
export interface OrgDepartment {
  id: string;
  name: string;
}

export interface OrgMember {
  id: string;
  name: string;
  department_id: string | null;
  hire_date?: string | null;
  phone?: string | null;
}

export interface OrgMembersResponse {
  success: boolean;
  departments?: OrgDepartment[];
  members?: OrgMember[];
  error?: string;
}

export interface WeeklyReportFilters {
  employeeId: string;
  departmentId: string;
  dateFrom: string;
  dateTo: string;
}
