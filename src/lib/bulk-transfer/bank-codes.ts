// 하나은행 대량이체 - 은행코드 매핑 (금융결제원 표준 3자리 코드)
// 출처: 하나은행 대량이체 양식 동봉 은행코드표 (data/bulk-transfer/은행코드.pdf)
// 하나은행 안내: '입금은행' 칸에는 은행코드(081) 또는 은행명(하나/하나은행) 모두 허용.
//   → 표기 흔들림 방지를 위해 파일 생성 시에는 3자리 코드로 통일한다.

export interface BankCode {
  code: string; // 3자리 표준 코드 (예: '081')
  name: string; // 정식 은행명
  aliases: string[]; // 사용자 입력 흔들림 허용용 별칭
}

export const BANK_CODES: BankCode[] = [
  { code: '081', name: '하나은행', aliases: ['하나', 'KEB하나', 'KEB하나은행', '케이이비하나'] },
  { code: '039', name: '경남은행', aliases: ['경남'] },
  { code: '034', name: '광주은행', aliases: ['광주'] },
  { code: '004', name: '국민은행', aliases: ['국민', 'KB', 'KB국민', 'KB국민은행'] },
  { code: '003', name: '기업은행', aliases: ['기업', 'IBK', 'IBK기업', 'IBK기업은행'] },
  { code: '011', name: '농협은행', aliases: ['농협', 'NH', 'NH농협', '단위농협', '농협중앙회'] },
  { code: '031', name: 'iM뱅크(대구)', aliases: ['iM뱅크', 'iM', '대구', '대구은행', 'DGB', 'DGB대구'] },
  { code: '055', name: '도이치은행', aliases: ['도이치'] },
  { code: '032', name: '부산은행', aliases: ['부산', 'BNK부산'] },
  { code: '002', name: '산업은행', aliases: ['산업', 'KDB', 'KDB산업'] },
  { code: '050', name: '저축은행', aliases: ['저축', 'SBI', '상호저축'] },
  { code: '045', name: '새마을금고중앙회', aliases: ['새마을금고', '새마을', 'MG', 'MG새마을금고'] },
  { code: '007', name: '수협은행', aliases: ['수협', 'Sh수협'] },
  { code: '048', name: '신협', aliases: ['신협중앙회', '신용협동조합'] },
  { code: '088', name: '신한은행', aliases: ['신한', '신한금융'] },
  { code: '020', name: '우리은행', aliases: ['우리'] },
  { code: '071', name: '우체국', aliases: ['우정사업본부', '우체국예금'] },
  { code: '037', name: '전북은행', aliases: ['전북', 'JB전북'] },
  { code: '090', name: '카카오뱅크', aliases: ['카카오', '카뱅'] },
  { code: '089', name: '케이뱅크', aliases: ['케이', 'K뱅크', 'KBANK'] },
  { code: '035', name: '제주은행', aliases: ['제주'] },
  { code: '027', name: '한국씨티은행', aliases: ['씨티', '씨티은행', 'Citi', '한국씨티'] },
  { code: '060', name: 'BOA', aliases: ['뱅크오브아메리카', 'Bank of America'] },
  { code: '054', name: 'HSBC', aliases: ['에이치에스비씨'] },
  { code: '057', name: '제이피모건체이스은행', aliases: ['JP모건', 'JPMorgan', '제이피모건'] },
  { code: '023', name: 'SC제일은행', aliases: ['SC', '제일', 'SC제일', '스탠다드차타드'] },
  { code: '064', name: '산림조합중앙회', aliases: ['산림조합', '산림'] },
  { code: '062', name: '중국공상은행', aliases: ['공상은행', 'ICBC'] },
  { code: '063', name: '중국은행', aliases: ['BOC'] },
  { code: '067', name: '중국건설은행', aliases: ['건설은행', 'CCB'] },
  { code: '061', name: '비엔피파리바은행', aliases: ['BNP', 'BNP파리바', '파리바'] },
  { code: '092', name: '토스뱅크', aliases: ['토스', 'Toss'] },
];

// 빠른 조회용 인덱스
const CODE_TO_BANK = new Map(BANK_CODES.map((b) => [b.code, b]));

/** UI 셀렉트박스용 옵션 목록 (하나은행 우선 노출) */
export const BANK_OPTIONS = BANK_CODES.map((b) => ({ code: b.code, name: b.name }));

/** 은행 코드가 유효한지 확인 */
export function isValidBankCode(code: string): boolean {
  return CODE_TO_BANK.has(code);
}

/** 코드 → 은행명 */
export function getBankName(code: string): string {
  return CODE_TO_BANK.get(code)?.name ?? code;
}

/**
 * 사용자 입력(은행명/별칭/코드)을 표준 3자리 코드로 정규화.
 * 매칭 실패 시 null 반환 → 호출부에서 검증 오류 처리.
 */
export function normalizeBankToCode(input: string): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  // 이미 3자리 코드 형태
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 3 && CODE_TO_BANK.has(digits)) return digits;
  if (digits.length === 2 && CODE_TO_BANK.has('0' + digits)) return '0' + digits; // 앞자리 0 생략 표기 보정

  // 은행명/별칭 매칭 (공백·'은행' 접미사 무시, 대소문자 무시)
  const norm = (s: string) => s.replace(/\s+/g, '').replace(/은행$/, '').toLowerCase();
  const target = norm(raw);
  for (const b of BANK_CODES) {
    if (norm(b.name) === target) return b.code;
    if (b.aliases.some((a) => norm(a) === target)) return b.code;
  }
  return null;
}
