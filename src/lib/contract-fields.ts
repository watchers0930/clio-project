/**
 * 계약서 템플릿 입력 필드 정의
 * 계약서 템플릿 선택 시 Step 3에 구조화된 입력 폼 표시
 */

export interface ContractField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: string[]; // select용
  group: string; // 그룹핑 (기본정보, 금액, 발주자, 공급자 등)
  half?: boolean; // true면 2열 중 반칸
}

export interface ContractSchema {
  templateName: string;
  fields: ContractField[];
}

/** 계약서 템플릿인지 판별 */
export function isContractTemplate(name: string): boolean {
  return name.includes('계약서') || name.includes('계약');
}

/** 시스템구축계약서 필드 */
const SYSTEM_CONTRACT_FIELDS: ContractField[] = [
  // 기본정보
  { key: 'contractName', label: '계약명', type: 'text', placeholder: 'OO시스템 구축 사업', required: true, group: '기본정보' },
  { key: 'startDate', label: '계약 시작일', type: 'date', required: true, group: '기본정보', half: true },
  { key: 'endDate', label: '계약 종료일', type: 'date', required: true, group: '기본정보', half: true },
  { key: 'deliveryDate', label: '납기일', type: 'date', required: true, group: '기본정보' },
  { key: 'signDate', label: '계약 체결일', type: 'date', required: true, group: '기본정보' },
  // 금액
  { key: 'totalAmount', label: '계약금액 (원)', type: 'number', placeholder: '500000000', required: true, group: '금액' },
  { key: 'supplyAmount', label: '공급가액 (원)', type: 'number', placeholder: '454545455', group: '금액', half: true },
  { key: 'vatAmount', label: '부가가치세 (원)', type: 'number', placeholder: '45454545', group: '금액', half: true },
  // 대금 지급
  { key: 'advanceRate', label: '선급금 비율 (%)', type: 'number', placeholder: '20', group: '대금지급', half: true },
  { key: 'progressRate', label: '중도금 비율 (%)', type: 'number', placeholder: '40', group: '대금지급', half: true },
  { key: 'progressCount', label: '중도금 지급회수', type: 'number', placeholder: '2', group: '대금지급', half: true },
  { key: 'finalRate', label: '잔금 비율 (%)', type: 'number', placeholder: '40', group: '대금지급', half: true },
  // 보증
  { key: 'performanceBond', label: '계약이행보증금 (원)', type: 'number', placeholder: '50000000', group: '보증', half: true },
  { key: 'warrantyBond', label: '하자보수보증금 (원)', type: 'number', placeholder: '50000000', group: '보증', half: true },
  { key: 'warrantyPeriod', label: '하자담보책임기간', type: 'text', placeholder: '1년', group: '보증' },
  // 발주자
  { key: 'clientName', label: '상호 또는 명칭', type: 'text', placeholder: '(주)OO기업', required: true, group: '발주자', half: true },
  { key: 'clientPhone', label: '전화번호', type: 'text', placeholder: '02-1234-5678', group: '발주자', half: true },
  { key: 'clientAddress', label: '주소', type: 'text', placeholder: '서울시 강남구 ...', group: '발주자' },
  { key: 'clientCeo', label: '대표자 성명', type: 'text', placeholder: '홍길동', required: true, group: '발주자' },
  // 공급자
  { key: 'supplierName', label: '상호 또는 명칭', type: 'text', placeholder: '(주)OO소프트', required: true, group: '공급자', half: true },
  { key: 'supplierPhone', label: '전화번호', type: 'text', placeholder: '02-9876-5432', group: '공급자', half: true },
  { key: 'supplierAddress', label: '주소', type: 'text', placeholder: '서울시 서초구 ...', group: '공급자' },
  { key: 'supplierCeo', label: '대표자 성명', type: 'text', placeholder: '김철수', required: true, group: '공급자' },
];

/** 모든 계약서 스키마 */
const CONTRACT_SCHEMAS: ContractSchema[] = [
  { templateName: '시스템구축계약서', fields: SYSTEM_CONTRACT_FIELDS },
  // 추후 다른 계약서도 여기에 추가
];

/** 템플릿명으로 계약서 스키마 조회 */
export function getContractSchema(templateName: string): ContractSchema | null {
  return CONTRACT_SCHEMAS.find(s => templateName.includes(s.templateName)) ?? null;
}

/** 금액 포맷 (12345678 → "12,345,678") */
export function formatAmount(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 금액 한글 표기 */
export function amountToKorean(n: number): string {
  if (n === 0) return '영';
  const units = ['', '만', '억', '조'];
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const subUnits = ['', '십', '백', '천'];

  let result = '';
  let unitIdx = 0;

  while (n > 0) {
    const chunk = n % 10000;
    if (chunk > 0) {
      let chunkStr = '';
      let c = chunk;
      for (let i = 0; i < 4 && c > 0; i++) {
        const d = c % 10;
        if (d > 0) {
          chunkStr = digits[d] + subUnits[i] + chunkStr;
        }
        c = Math.floor(c / 10);
      }
      result = chunkStr + units[unitIdx] + result;
    }
    n = Math.floor(n / 10000);
    unitIdx++;
  }

  return result;
}

/** 날짜 포맷 (2026-05-01 → { year: "2026", month: "5", day: "1" }) */
export function parseDate(dateStr: string): { year: string; month: string; day: string } {
  const [y, m, d] = dateStr.split('-');
  return { year: y, month: String(parseInt(m)), day: String(parseInt(d)) };
}
