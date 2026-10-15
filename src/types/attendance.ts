import type { LeaveType, LeaveStatus, HalfDaySlot } from "@/lib/supabase/types";
export type { LeaveType, LeaveStatus, HalfDaySlot };
// 화면에 내려주는 '유효 출퇴근'은 보정값 우선, 없으면 heartbeat.
export interface AttendanceDayView {
  workDate: string; // KST 'YYYY-MM-DD'
  effectiveCheckIn: string | null; // ISO UTC — 유효 출근(보정>heartbeat)
  effectiveCheckOut: string | null; // 유효 퇴근
  source: "auto" | "manual" | "mixed" | "none";
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
  userId?: string; // 관리자 범위 조회의 소유자
  inconsistent?: boolean; // 연결 결재 누락 또는 상태 불일치
}

// 연차 집계 응답 (GET /api/leave-requests/balance)
export interface LeaveBalanceView {
  hireDate: string | null;
  asOf: string; // 기준일 KST
  computable: boolean; // 입사일 없음/미래/오류 시 false
  reason?: "no_hire_date" | "future_hire_date" | "invalid_date";
  policyVersion: string;
  grants: Array<{
    // 유효 부여 구간
    grantedOn: string;
    expiresOn: string;
    grantedDays: number;
    deductedDays: number; // 이 구간에 배분된 승인 차감
    remainingDays: number;
  }>;
  totalGranted: number;
  totalDeducted: number; // 승인(전결 포함, 예정 포함) 차감 합
  reservedDays: number; // 대기(pending) 예약량
  remainingDays: number; // totalGranted - totalDeducted
  requestableDays: number; // remainingDays - reservedDays
  assumptionNote: string; // '개근·출근율80% 충족 전제' 등 계산 전제
}
