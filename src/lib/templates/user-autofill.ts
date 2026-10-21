/**
 * 새 문서 작성 시 로그인 사용자 본인 정보로 필드를 자동 채우기 위한 매핑.
 *
 * - 서버(generate-document.ts)는 기안자(author/소속/직급)를 항상 본인으로 확정 주입한다.
 * - 이 모듈은 클라이언트 모달에서 "비어 있는" 입력 필드를 본인 정보로 미리 채워(prefill)
 *   사용자가 값을 보고 필요 시 수정할 수 있게 한다.
 * - 근로계약서처럼 '상대방(근로자)' 신원을 담는 양식은 본인 신원 필드를 채우지 않는다.
 */

export interface UserProfile {
  name: string;
  resident_no: string;
  address: string;
  department: string;
  position: string;
  hire_date: string;
  phone: string;
}

/** 모든 양식 공통: 기안자(작성자) 필드 → 본인 정보 */
const COMMON_MAP: Record<string, keyof UserProfile> = {
  author: 'name',
  author_department: 'department',
  author_position: 'position',
};

/**
 * 본인이 문서의 주체인 양식(재직증명서·휴가원 등)에서만 채우는 신원 필드.
 * 필드명이 템플릿별로 제각각이라(employee_name vs author 등) key별로 매핑한다.
 */
const SELF_SUBJECT_MAP: Record<string, keyof UserProfile> = {
  employee_name: 'name',
  department: 'department',
  position: 'position',
  hire_date: 'hire_date',
  employment_start_date: 'hire_date',
  emergency_contact: 'phone',
  phone: 'phone',
  employee_address: 'address',
  address: 'address',
  resident_registration_no: 'resident_no',
  resident_no: 'resident_no',
};

/** 상대방(채용 대상 등) 신원을 담는 양식 — 본인 신원 프리필에서 제외 */
function isCounterpartyDoc(templateName?: string | null): boolean {
  return !!templateName && /근로계약서/.test(templateName);
}

/**
 * 템플릿 필드 중 매핑 대상이면서 프로필 값이 있는 것만 { key: value }로 반환.
 * 호출 측에서 "비어 있는 필드만" 적용하므로 사용자가 입력한 값은 덮지 않는다.
 */
export function buildUserAutofill(
  profile: UserProfile | null | undefined,
  fields: ReadonlyArray<{ key: string }>,
  templateName?: string | null,
): Record<string, string> {
  if (!profile) return {};
  const map = isCounterpartyDoc(templateName)
    ? COMMON_MAP
    : { ...COMMON_MAP, ...SELF_SUBJECT_MAP };
  const fieldKeys = new Set(fields.map((f) => f.key));
  const result: Record<string, string> = {};
  for (const [fieldKey, profileKey] of Object.entries(map)) {
    if (!fieldKeys.has(fieldKey)) continue;
    const value = profile[profileKey];
    if (typeof value === 'string' && value.trim()) result[fieldKey] = value;
  }
  return result;
}
