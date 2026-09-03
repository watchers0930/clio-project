/**
 * 개인정보 포맷·마스킹 유틸
 */

/**
 * 주민등록번호 마스킹: 앞 6자리 + 성별 1자리만 노출, 나머지는 ******
 * 입력이 이미 마스킹돼 있으면 그대로 반환. 예: 9001011234567 → 900101-1******
 */
export function maskResidentNo(raw: string): string {
  if (!raw) return '';
  if (raw.includes('*')) return raw; // 이미 마스킹됨
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 7) return raw; // 불완전 입력은 그대로
  return `${digits.slice(0, 6)}-${digits[6]}******`;
}

/**
 * 전화번호 자동 하이픈 포맷 (nnn-nnnn-nnnn 등 자릿수 기준)
 * 010-1234-5678 / 02-123-4567 등 한국 번호 대응
 */
export function formatKoreanPhone(raw: string): string {
  const d = raw.replace(/[^0-9]/g, '').slice(0, 11);
  if (d.length < 4) return d;
  // 서울(02): 2자리 국번
  if (d.startsWith('02')) {
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  // 그 외(010, 031 등): 3자리 국번
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
