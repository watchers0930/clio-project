/**
 * CLIO 만료일 알림 기능 관련 타입 정의
 * 기능: clio-expiry-alert (모달 팝업 방식)
 */

/** schedules 테이블 레코드 (만료일 관련 필드 포함) */
export interface ScheduleRecord {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;        // ISO 8601: 'YYYY-MM-DD'
  end_date: string;          // 만료일 (ISO 8601)
  source_type: 'document_expiry' | null;
  source_id: string | null;  // files.id
  expiry_confidence: 'high' | 'low' | 'none' | null;
  created_at: string;
}

/** 만료 임박 문서 요약 (API 응답 단위) */
export interface ExpiryItem {
  schedule_id: string;
  file_id: string;
  file_name: string;
  expiry_date: string;       // 'YYYY-MM-DD'
  days_remaining: number;    // 0 이상: 남은 일수, 음수: 이미 만료
  confidence: 'high' | 'low' | 'none';
  owner_name: string | null; // 담당자명
}

/** AI 추출 결과 스키마 (GPT-4o 응답) */
export interface ExpiryExtractResult {
  expiry_date: string | null;        // 'YYYY-MM-DD'
  contract_period: string | null;    // 'YYYY-MM-DD ~ YYYY-MM-DD'
  document_type: string;
  confidence: 'high' | 'low' | 'none';
  reason: string;
}

/** /api/dashboard/expiry-summary 응답 */
export interface ExpirySummaryResponse {
  items: ExpiryItem[];
  total: number;
  has_expired: boolean;
}

/** /api/files/[id]/extract-expiry 응답 */
export interface ExtractExpiryResponse {
  success: true;
  schedule_id: string | null;
  expiry_date: string | null;
  confidence: 'high' | 'low' | 'none';
  document_type: string;
  reason: string;
}
