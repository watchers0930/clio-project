// 하나은행 대량이체 - 타입 정의

export type TransferStatus = 'pending' | 'exported' | 'done';
export type TransferSourceType = 'manual' | 'contract';

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  pending: '대기',
  exported: '파일생성',
  done: '이체완료',
};

// 거래처(수취인) — 화면 모델. 계좌번호는 절대 평문으로 내려보내지 않고 마스킹만 노출.
export interface TransferPayee {
  id: string;
  name: string;
  bank_code: string;
  bank_name: string; // 코드→명칭 파생
  account_masked: string; // 예: '******7890'
  account_holder: string | null;
  notify_phone: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

// 거래처 생성/수정 입력 (account는 평문 — 서버에서 즉시 암호화)
export interface TransferPayeeInput {
  name: string;
  bank_code: string;
  account: string; // 하이픈 제외 숫자
  account_holder: string | null;
  notify_phone: string | null;
  memo: string | null;
}

// 이체 예정 건 — 화면 모델
export interface TransferItem {
  id: string;
  payee_id: string | null;
  payee_name: string;
  bank_name: string | null; // 조인 파생 (거래처 은행)
  account_masked: string | null; // 조인 파생 (거래처 계좌 마스킹)
  amount: number;
  deposit_display: string | null;
  withdraw_display: string | null;
  memo: string | null;
  cms_code: string | null;
  notify_phone: string | null;
  status: TransferStatus;
  source_type: TransferSourceType;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

// 이체 건 생성/수정 입력
export interface TransferItemInput {
  payee_id: string;
  amount: number;
  deposit_display: string | null;
  withdraw_display: string | null;
  memo: string | null;
  cms_code: string | null;
  notify_phone: string | null;
  source_type?: TransferSourceType;
  source_id?: string | null;
}

// 하나은행 대량이체 파일 1행 (Sheet1 컬럼과 1:1 매핑)
export interface HanaBulkRow {
  bankCode: string; // 입금은행 (3자리 코드)
  account: string; // 입금계좌번호 (하이픈 제외 숫자, 복호화 평문)
  amount: number; // 입금액(원)
  accountHolder?: string | null; // 예상예금주
  depositDisplay?: string | null; // 입금통장표시
  withdrawDisplay?: string | null; // 출금통장표시
  memo?: string | null; // 메모
  cmsCode?: string | null; // CMS코드
  notifyPhone?: string | null; // 받는분 휴대폰번호
}
