// 하나은행 대량이체 - DB row ↔ 화면 모델 변환 (계좌번호 마스킹 포함)
import { getBankName } from './bank-codes';
import type { TransferItem, TransferPayee, TransferStatus, TransferSourceType } from './types';

/** 계좌번호 평문을 마스킹 (뒤 4자리만 노출). 화면/목록 표시용. */
export function maskAccount(plain: string): string {
  const digits = (plain ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}

// DB raw 형태 (신규 테이블 — 생성된 타입에 없어 별도 정의)
export interface RawPayee {
  id: string;
  name: string;
  bank_code: string;
  enc_account: string;
  account_holder: string | null;
  notify_phone: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface RawItem {
  id: string;
  payee_id: string | null;
  payee_name: string;
  amount: number | string;
  deposit_display: string | null;
  withdraw_display: string | null;
  memo: string | null;
  cms_code: string | null;
  notify_phone: string | null;
  status: string;
  source_type: string;
  source_id: string | null;
  created_at: string;
  updated_at: string;
  // 조인된 거래처 (select 시 payee:transfer_payees(...) 형태)
  payee?: { bank_code: string; enc_account: string } | null;
}

/**
 * 거래처 raw → 화면 모델. 계좌 마스킹을 위해 복호화 함수를 주입받는다.
 * (복호화는 서버 전용 모듈이라 map은 함수 주입으로 서버/클라 경계를 지킨다.)
 */
export function mapPayee(raw: RawPayee, decrypt: (enc: string) => string): TransferPayee {
  let masked = '';
  try {
    masked = maskAccount(decrypt(raw.enc_account));
  } catch {
    masked = '****';
  }
  return {
    id: raw.id,
    name: raw.name,
    bank_code: raw.bank_code,
    bank_name: getBankName(raw.bank_code),
    account_masked: masked,
    account_holder: raw.account_holder,
    notify_phone: raw.notify_phone,
    memo: raw.memo,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

/** 이체 건 raw → 화면 모델. 조인된 거래처 계좌는 마스킹. */
export function mapItem(raw: RawItem, decrypt: (enc: string) => string): TransferItem {
  let account_masked: string | null = null;
  let bank_name: string | null = null;
  if (raw.payee) {
    bank_name = getBankName(raw.payee.bank_code);
    try {
      account_masked = maskAccount(decrypt(raw.payee.enc_account));
    } catch {
      account_masked = '****';
    }
  }
  return {
    id: raw.id,
    payee_id: raw.payee_id,
    payee_name: raw.payee_name,
    bank_name,
    account_masked,
    amount: typeof raw.amount === 'string' ? Number(raw.amount) : raw.amount,
    deposit_display: raw.deposit_display,
    withdraw_display: raw.withdraw_display,
    memo: raw.memo,
    cms_code: raw.cms_code,
    notify_phone: raw.notify_phone,
    status: raw.status as TransferStatus,
    source_type: raw.source_type as TransferSourceType,
    source_id: raw.source_id,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}
