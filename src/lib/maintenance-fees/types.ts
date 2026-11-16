// 관리비 - 타입 정의 (시스템 관리자 전용 공용 장부)

// 관리비 항목 — 화면 모델
export interface FeeItem {
  id: string;
  name: string; // 항목명 (예: 전기, 수도)
  unit: string | null; // 단위 (예: kWh, ㎥)
  default_unit_price: number | null; // 기본 단가(원)
  sort_order: number;
  is_active: boolean; // false = 숨김 (지난 기록은 보존, 새 입력 선택지에서 제외)
}

// 월별 기록 — 화면 모델
export interface FeeEntry {
  id: string;
  item_id: string;
  month: string; // 'YYYY-MM'
  usage: number | null;
  unit_price: number | null;
  amount: number; // 원, 음수 = 정산 환급
  amount_overridden: boolean; // 고지서 금액으로 직접 고침
  memo: string | null;
  updated_at: string;
}

// 항목 생성/수정 입력
export interface FeeItemInput {
  name: string;
  unit: string | null;
  default_unit_price: number | null;
  sort_order: number;
  is_active: boolean;
}

// 월별 기록 입력 칸 (생성·수정 공통)
export interface FeeEntryFields {
  usage: number | null;
  unit_price: number | null;
  amount: number | null; // null = 서버가 사용량 × 단가로 계산
  amount_overridden: boolean;
  memo: string | null;
}

// 월별 기록 수정 입력 — 항목·월은 바꾸지 않고, updated_at 으로 동시 수정 충돌을 잡는다
export interface FeeEntryUpdateInput extends FeeEntryFields {
  updated_at: string; // 불러온 시점의 값
}

// 월별 기록 생성 입력
export interface FeeEntryCreateInput extends FeeEntryFields {
  item_id: string;
  month: string;
}

export interface MonthlyRow {
  item: FeeItem;
  entry: FeeEntry;
  prevAmount: number | null; // 전월 같은 항목 금액
  diff: number | null; // 이번 달 - 전월
}

export interface MonthlyView {
  rows: MonthlyRow[];
  total: number;
  prevTotal: number | null; // 전월 기록이 하나도 없으면 null
}

export interface YearlyRow {
  item: FeeItem;
  months: (number | null)[]; // 1~12월 금액, 기록 없으면 null
  usageTotal: number | null;
  avgUnitPrice: number | null; // 사용량 있는 기록의 금액 합 ÷ 사용량 합
  amountTotal: number;
}

export interface YearlyView {
  rows: YearlyRow[];
  monthTotals: number[]; // 12칸
  grandTotal: number;
}
