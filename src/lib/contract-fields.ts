/**
 * 계약서 템플릿 입력 필드 정의
 * 계약서 템플릿 선택 시 Step 3에 구조화된 입력 폼 표시
 */

export interface ContractField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select' | 'address';
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
  { key: 'startDate', label: '계약 시작일', type: 'text', placeholder: 'yyyy/mm/dd', required: true, group: '기본정보', half: true },
  { key: 'endDate', label: '계약 종료일', type: 'text', placeholder: 'yyyy/mm/dd', required: true, group: '기본정보', half: true },
  { key: 'signDate', label: '계약 체결일', type: 'text', placeholder: 'yyyy/mm/dd', required: true, group: '기본정보' },
  // 금액
  { key: 'totalAmount', label: '계약금액 (원)', type: 'number', placeholder: '500000000', required: true, group: '금액' },
  { key: 'supplyAmount', label: '공급가액 (원) — 자동계산', type: 'number', placeholder: '자동 계산됨', group: '금액', half: true },
  { key: 'vatAmount', label: '부가가치세 (원) — 자동계산', type: 'number', placeholder: '자동 계산됨', group: '금액', half: true },
  // 대금 지급
  { key: 'advanceRate', label: '선급금 비율 (%)', type: 'number', placeholder: '20', group: '대금지급', half: true },
  { key: 'progressRate', label: '중도금 총 비율 (%)', type: 'number', placeholder: '60', group: '대금지급', half: true },
  { key: 'progressCount', label: '중도금 지급회수', type: 'number', placeholder: '3', group: '대금지급', half: true },
  { key: 'finalRate', label: '잔금 비율 (%)', type: 'number', placeholder: '20', group: '대금지급', half: true },
  { key: 'advancePayDate', label: '선급금 지급기일', type: 'text', placeholder: 'yyyy/mm/dd', group: '대금지급', half: true },
  { key: 'finalPayDate', label: '잔금 지급기일', type: 'text', placeholder: 'yyyy/mm/dd', group: '대금지급', half: true },
  // 발주자
  { key: 'clientName', label: '상호 또는 명칭', type: 'text', placeholder: '(주)OO기업', required: true, group: '발주자', half: true },
  { key: 'clientPhone', label: '전화번호', type: 'text', placeholder: '02-1234-5678', group: '발주자', half: true },
  { key: 'clientAddress', label: '주소', type: 'address', placeholder: '클릭하여 주소 검색', group: '발주자' },
  { key: 'clientCeo', label: '대표자 성명', type: 'text', placeholder: '홍길동', required: true, group: '발주자' },
  // 공급자
  { key: 'supplierName', label: '상호 또는 명칭', type: 'text', placeholder: '(주)OO소프트', required: true, group: '공급자', half: true },
  { key: 'supplierPhone', label: '전화번호', type: 'text', placeholder: '02-9876-5432', group: '공급자', half: true },
  { key: 'supplierAddress', label: '주소', type: 'address', placeholder: '클릭하여 주소 검색', group: '공급자' },
  { key: 'supplierCeo', label: '대표자 성명', type: 'text', placeholder: '김철수', required: true, group: '공급자' },
];

/** 유지보수계약서 필드 */
const MAINTENANCE_CONTRACT_FIELDS: ContractField[] = [
  // 기본정보
  { key: 'contractName', label: '계약명', type: 'text', placeholder: 'OO시스템 유지보수 사업', required: true, group: '기본정보' },
  { key: 'systemName', label: '유지보수 대상 시스템', type: 'text', placeholder: 'OO정보시스템', required: true, group: '기본정보' },
  { key: 'startDate', label: '유지보수 시작일', type: 'text', placeholder: 'yyyy/mm/dd', required: true, group: '기본정보', half: true },
  { key: 'endDate', label: '유지보수 종료일', type: 'text', placeholder: 'yyyy/mm/dd', required: true, group: '기본정보', half: true },
  { key: 'signDate', label: '계약 체결일', type: 'text', placeholder: 'yyyy/mm/dd', required: true, group: '기본정보' },
  // 금액
  { key: 'totalAmount', label: '연간 유지보수 금액 (원)', type: 'number', placeholder: '120000000', required: true, group: '금액' },
  { key: 'supplyAmount', label: '공급가액 (원) — 자동계산', type: 'number', placeholder: '자동 계산됨', group: '금액', half: true },
  { key: 'vatAmount', label: '부가가치세 (원) — 자동계산', type: 'number', placeholder: '자동 계산됨', group: '금액', half: true },
  // 대금 지급
  { key: 'paymentCycle', label: '대금 지급 주기', type: 'select', options: ['월별', '분기별', '반기별', '연간 일시'], group: '대금지급' },
  { key: 'paymentDay', label: '지급일 (매월/분기 N일)', type: 'text', placeholder: '25', group: '대금지급' },
  // 발주자
  { key: 'clientName', label: '상호 또는 명칭', type: 'text', placeholder: '(주)OO기업', required: true, group: '발주자', half: true },
  { key: 'clientPhone', label: '전화번호', type: 'text', placeholder: '02-1234-5678', group: '발주자', half: true },
  { key: 'clientAddress', label: '주소', type: 'address', placeholder: '클릭하여 주소 검색', group: '발주자' },
  { key: 'clientCeo', label: '대표자 성명', type: 'text', placeholder: '홍길동', required: true, group: '발주자' },
  // 공급자
  { key: 'supplierName', label: '상호 또는 명칭', type: 'text', placeholder: '(주)OO소프트', required: true, group: '공급자', half: true },
  { key: 'supplierPhone', label: '전화번호', type: 'text', placeholder: '02-9876-5432', group: '공급자', half: true },
  { key: 'supplierAddress', label: '주소', type: 'address', placeholder: '클릭하여 주소 검색', group: '공급자' },
  { key: 'supplierCeo', label: '대표자 성명', type: 'text', placeholder: '김철수', required: true, group: '공급자' },
];

/** 소프트웨어구축계약서 필드 */
const SOFTWARE_CONTRACT_FIELDS: ContractField[] = [
  // 기본정보
  { key: 'contractName', label: '계약명', type: 'text', placeholder: 'OO소프트웨어 개발 사업', required: true, group: '기본정보' },
  { key: 'softwareName', label: '소프트웨어명', type: 'text', placeholder: 'OO관리시스템', required: true, group: '기본정보' },
  { key: 'startDate', label: '개발 시작일', type: 'text', placeholder: 'yyyy/mm/dd', required: true, group: '기본정보', half: true },
  { key: 'endDate', label: '납품 기한일', type: 'text', placeholder: 'yyyy/mm/dd', required: true, group: '기본정보', half: true },
  { key: 'signDate', label: '계약 체결일', type: 'text', placeholder: 'yyyy/mm/dd', required: true, group: '기본정보' },
  // 금액
  { key: 'totalAmount', label: '계약금액 (원)', type: 'number', placeholder: '300000000', required: true, group: '금액' },
  { key: 'supplyAmount', label: '공급가액 (원) — 자동계산', type: 'number', placeholder: '자동 계산됨', group: '금액', half: true },
  { key: 'vatAmount', label: '부가가치세 (원) — 자동계산', type: 'number', placeholder: '자동 계산됨', group: '금액', half: true },
  // 대금 지급
  { key: 'advanceRate', label: '선급금 비율 (%)', type: 'number', placeholder: '30', group: '대금지급', half: true },
  { key: 'progressRate', label: '중도금 총 비율 (%)', type: 'number', placeholder: '50', group: '대금지급', half: true },
  { key: 'progressCount', label: '중도금 지급회수', type: 'number', placeholder: '2', group: '대금지급', half: true },
  { key: 'finalRate', label: '잔금 비율 (%)', type: 'number', placeholder: '20', group: '대금지급', half: true },
  { key: 'advancePayDate', label: '선급금 지급기일', type: 'text', placeholder: 'yyyy/mm/dd', group: '대금지급', half: true },
  { key: 'finalPayDate', label: '잔금 지급기일 (납품 후)', type: 'text', placeholder: 'yyyy/mm/dd', group: '대금지급', half: true },
  // 납품물
  { key: 'deliverables', label: '납품물 목록', type: 'text', placeholder: '소스코드, 설치파일, 매뉴얼, 교육 1회', group: '납품물' },
  { key: 'warrantyPeriod', label: '하자보증 기간', type: 'select', options: ['3개월', '6개월', '1년', '2년', '3년'], group: '납품물' },
  // 발주자
  { key: 'clientName', label: '상호 또는 명칭', type: 'text', placeholder: '(주)OO기업', required: true, group: '발주자', half: true },
  { key: 'clientPhone', label: '전화번호', type: 'text', placeholder: '02-1234-5678', group: '발주자', half: true },
  { key: 'clientAddress', label: '주소', type: 'address', placeholder: '클릭하여 주소 검색', group: '발주자' },
  { key: 'clientCeo', label: '대표자 성명', type: 'text', placeholder: '홍길동', required: true, group: '발주자' },
  // 공급자
  { key: 'supplierName', label: '상호 또는 명칭', type: 'text', placeholder: '(주)OO소프트', required: true, group: '공급자', half: true },
  { key: 'supplierPhone', label: '전화번호', type: 'text', placeholder: '02-9876-5432', group: '공급자', half: true },
  { key: 'supplierAddress', label: '주소', type: 'address', placeholder: '클릭하여 주소 검색', group: '공급자' },
  { key: 'supplierCeo', label: '대표자 성명', type: 'text', placeholder: '김철수', required: true, group: '공급자' },
];

/** 모든 계약서 스키마 */
const CONTRACT_SCHEMAS: ContractSchema[] = [
  { templateName: '시스템구축계약서', fields: SYSTEM_CONTRACT_FIELDS },
  { templateName: '유지보수계약서', fields: MAINTENANCE_CONTRACT_FIELDS },
  { templateName: '소프트웨어구축계약서', fields: SOFTWARE_CONTRACT_FIELDS },
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

/** 날짜 포맷 (yyyy/mm/dd 또는 yyyy-mm-dd → { year, month, day }) */
export function parseDate(dateStr: string): { year: string; month: string; day: string } {
  const [y, m, d] = dateStr.split(/[\/\-]/);
  return { year: y, month: String(parseInt(m)), day: String(parseInt(d)) };
}
