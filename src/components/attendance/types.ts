// 근태·휴가 프론트엔드 공용 타입 (설계서 §2.3 enum · §2.4 뷰 타입 · §5 요청 바디)
//
// 설계서 §1.2는 이 타입의 이상적 위치를 `src/types/attendance.ts`로 두지만,
// 이번 작업의 수정 허용 경로가 components/·app/·hooks/ 로 한정되어 types/ 를 만들 수 없다.
// → feature 폴더에 co-locate 한다. 백엔드(Codex)가 반환하는 응답 형태와 1:1 계약이다.
// 런타임 없는 타입 선언만 포함하므로 hooks→components 임포트 방향 문제 없음(import type).

export type LeaveType = 'annual' | 'monthly' | 'half_day' | 'menstrual';
export type LeaveStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type HalfDaySlot = 'am' | 'pm';

// ── 조회 뷰 (서버 → 화면) ─────────────────────────────────────────────
export interface AttendanceDayView {
  workDate: string; // KST 'YYYY-MM-DD'
  effectiveCheckIn: string | null; // ISO UTC — 유효 출근(보정>heartbeat)
  effectiveCheckOut: string | null; // 유효 퇴근
  source: 'auto' | 'manual' | 'mixed' | 'none';
  firstHeartbeatAt: string | null;
  lastHeartbeatAt: string | null;
  heartbeatCount: number;
  isCorrected: boolean;
  correctionReason: string | null;
  isSingleSignal: boolean; // 당일 1회만 수신(최초=마지막)
  isToday: boolean; // true면 퇴근 '갱신 중'
  version: number;
}

export interface LeaveRequestView {
  id: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  halfDaySlot: HalfDaySlot | null;
  requestedDays: number;
  deductDays: number;
  status: LeaveStatus;
  reason: string | null;
  documentId: string | null;
  approvalRequestId: string | null;
  createdAt: string;
}

export interface LeaveGrant {
  grantedOn: string;
  expiresOn: string;
  grantedDays: number;
  deductedDays: number;
  remainingDays: number;
}

export interface LeaveBalanceView {
  hireDate: string | null;
  asOf: string; // 기준일 KST
  computable: boolean; // 입사일 없음/미래/오류 시 false
  reason?: 'no_hire_date' | 'future_hire_date' | 'invalid_date';
  policyVersion: string;
  grants: LeaveGrant[];
  totalGranted: number;
  totalDeducted: number; // 승인(전결 포함, 예정 포함) 차감 합
  reservedDays: number; // 대기(pending) 예약량
  remainingDays: number; // totalGranted - totalDeducted
  requestableDays: number; // remainingDays - reservedDays
  assumptionNote: string;
}

// admin 전직원 조회 행 (GET /api/attendance/admin)
export interface AdminAttendanceRow {
  userId: string;
  userName: string;
  department: string | null;
  days: AttendanceDayView[];
}

export interface AdminAttendanceResult {
  rows: AdminAttendanceRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ── 요청 바디 (화면 → 서버, 설계서 §5) ───────────────────────────────
export interface AttendanceCorrectionInput {
  mode: 'correct' | 'restore';
  checkInAt?: string | null; // ISO, mode='correct'
  checkOutAt?: string | null;
  reason: string; // 필수, ≤500
  version: number; // 낙관적 잠금(없는 날 생성 시 0)
}

export interface LeaveCreateInput {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  halfDaySlot?: HalfDaySlot;
  reason?: string;
  idempotencyKey: string;
  documentId?: string;
}

export interface LeaveUpdateInput {
  action: 'update' | 'link_document' | 'submit';
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;
  halfDaySlot?: HalfDaySlot;
  reason?: string;
  documentId?: string;
}

// ── 화면 라벨 (공용) ──────────────────────────────────────────────────
export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  annual: '연차',
  monthly: '월차',
  half_day: '반차',
  menstrual: '생리휴가',
};

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  draft: '초안',
  pending: '결재 대기',
  approved: '승인',
  rejected: '반려',
};
