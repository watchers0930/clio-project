// 하나은행 대량이체 - 서버 입력 검증 (순수 함수)
import { normalizeBankToCode } from './bank-codes';
import type { TransferItemInput, TransferPayeeInput, TransferSourceType } from './types';

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE_TYPES: TransferSourceType[] = ['manual', 'contract'];

function isValidUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** nullable 문자열 필드: 빈값→null, 길이 초과→오류. */
function optStr(v: unknown, max: number, label: string): Result<string | null> {
  const s = str(v);
  if (!s) return { ok: true, value: null };
  if (s.length > max) return { ok: false, error: `${label}이(가) 너무 깁니다. (최대 ${max}자)` };
  return { ok: true, value: s };
}

/** 휴대폰 번호: 숫자만 추출, 9~11자리 허용. 빈값 허용. */
function optPhone(v: unknown): Result<string | null> {
  const s = str(v);
  if (!s) return { ok: true, value: null };
  const digits = s.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 11) {
    return { ok: false, error: '휴대폰 번호 형식이 올바르지 않습니다.' };
  }
  return { ok: true, value: digits };
}

/**
 * 거래처(수취인) 입력 검증.
 * @param opts.accountOptional 수정 시 계좌 미입력(빈값)이면 "기존 유지"로 통과 → value.account=''
 */
export function validatePayeeInput(
  raw: unknown,
  opts: { accountOptional?: boolean } = {},
): Result<TransferPayeeInput> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '요청 본문이 올바르지 않습니다.' };
  const b = raw as Record<string, unknown>;

  const name = str(b.name);
  if (!name) return { ok: false, error: '거래처명은 필수입니다.' };
  if (name.length > 100) return { ok: false, error: '거래처명이 너무 깁니다. (최대 100자)' };

  const bankCode = normalizeBankToCode(str(b.bank_code));
  if (!bankCode) return { ok: false, error: '은행을 정확히 선택/입력해 주세요.' };

  const accountRaw = str(b.account).replace(/[\s-]/g, '');
  let account = '';
  if (accountRaw) {
    if (!/^\d{6,20}$/.test(accountRaw)) {
      return { ok: false, error: '계좌번호는 하이픈 제외 6~20자리 숫자여야 합니다.' };
    }
    account = accountRaw;
  } else if (!opts.accountOptional) {
    return { ok: false, error: '계좌번호는 하이픈 제외 6~20자리 숫자여야 합니다.' };
  }

  const holder = optStr(b.account_holder, 40, '예금주명');
  if (!holder.ok) return holder;
  const phone = optPhone(b.notify_phone);
  if (!phone.ok) return phone;
  const memo = optStr(b.memo, 200, '메모');
  if (!memo.ok) return memo;

  return {
    ok: true,
    value: {
      name,
      bank_code: bankCode,
      account,
      account_holder: holder.value,
      notify_phone: phone.value,
      memo: memo.value,
    },
  };
}

/** 이체 건 입력 검증 */
export function validateItemInput(raw: unknown): Result<TransferItemInput> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '요청 본문이 올바르지 않습니다.' };
  const b = raw as Record<string, unknown>;

  if (!isValidUuid(b.payee_id)) return { ok: false, error: '거래처를 선택해 주세요.' };

  const amount = typeof b.amount === 'number' ? b.amount : Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: '이체 금액은 0보다 큰 숫자여야 합니다.' };
  }
  if (amount > 10_000_000_000) {
    return { ok: false, error: '이체 금액이 한도를 초과했습니다.' };
  }

  const deposit = optStr(b.deposit_display, 20, '입금통장표시');
  if (!deposit.ok) return deposit;
  const withdraw = optStr(b.withdraw_display, 20, '출금통장표시');
  if (!withdraw.ok) return withdraw;
  const memo = optStr(b.memo, 100, '메모');
  if (!memo.ok) return memo;
  const cms = optStr(b.cms_code, 40, 'CMS코드');
  if (!cms.ok) return cms;
  const phone = optPhone(b.notify_phone);
  if (!phone.ok) return phone;

  const sourceType = (str(b.source_type) || 'manual') as TransferSourceType;
  if (!SOURCE_TYPES.includes(sourceType)) return { ok: false, error: '출처 값이 올바르지 않습니다.' };
  const sourceId = b.source_id == null || b.source_id === '' ? null : b.source_id;
  if (sourceId !== null && !isValidUuid(sourceId)) return { ok: false, error: '출처 ID가 올바르지 않습니다.' };

  return {
    ok: true,
    value: {
      payee_id: b.payee_id as string,
      amount: Math.round(amount), // 원 단위 정수
      deposit_display: deposit.value,
      withdraw_display: withdraw.value,
      memo: memo.value,
      cms_code: cms.value,
      notify_phone: phone.value,
      source_type: sourceType,
      source_id: sourceId as string | null,
    },
  };
}
