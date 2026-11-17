// 검색 화면 상단 안내(검색 범위·부서 필터 문구) — 권한 규칙(lib/search/document-search)과 같은 범위를 설명한다.
export interface SearchContext {
  role: string;
  departmentName: string;
  documentScopeLabel: string;
  departmentFilterLabel: string;
  availableDepartments: string[];
}

export function buildSearchContext(
  roleInfo: { role: string; department_id: string | null },
  deptMap: Map<string, string>,
): SearchContext {
  const isAdmin = roleInfo.role === 'admin';
  return {
    role: roleInfo.role,
    departmentName: deptMap.get(roleInfo.department_id ?? '') ?? '미배정',
    documentScopeLabel: isAdmin
      ? '관리자 권한으로 접근 가능한 전체 문서 범위에서 검색합니다.'
      : roleInfo.department_id
        ? `본인 문서와 ${deptMap.get(roleInfo.department_id) ?? '소속 부서'}에 공유된 문서만 검색합니다.`
        : '본인 문서와 직접 공유된 문서만 검색합니다.',
    departmentFilterLabel: isAdmin
      ? '전체 부서를 기준으로 결과를 다시 좁힐 수 있습니다.'
      : '검색 후 접근 가능한 부서만 필터에 남습니다.',
    availableDepartments: ['전체'],
  };
}
