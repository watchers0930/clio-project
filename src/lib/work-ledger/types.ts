// 작업내역(프로젝트 수금 대장) 타입 정의

export type WorkProjectStatus = 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
export type PaymentType = 'down' | 'interim' | 'balance';

export const STATUS_LABELS: Record<WorkProjectStatus, string> = {
  in_progress: '진행중',
  completed: '완료',
  on_hold: '보류',
  cancelled: '취소',
};

export const STATUS_COLORS: Record<WorkProjectStatus, string> = {
  in_progress: '#2E6FF2',
  completed: '#12805C',
  on_hold: '#B7791F',
  cancelled: '#8A8F99',
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  down: '계약금',
  interim: '중도금',
  balance: '잔금',
};

export interface WorkPayment {
  id?: string;
  type: PaymentType;
  seq: number;
  amount: number;
  due_date: string | null;
  paid: boolean;
  paid_date: string | null;
  sort_order: number;
}

export interface WorkProject {
  id: string;
  name: string;
  status: WorkProjectStatus;
  client_name: string | null;
  manager_id: string | null;
  manager_name?: string | null;
  contract_date: string | null;
  due_date: string | null;
  contract_amount: number;
  margin_rate: number;
  visible_department_ids: string[];
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  payments: WorkPayment[];
}

// 생성/수정 요청 본문
export interface WorkProjectInput {
  name: string;
  status: WorkProjectStatus;
  client_name: string | null;
  manager_id: string | null;
  contract_date: string | null;
  due_date: string | null;
  contract_amount: number;
  margin_rate: number;
  visible_department_ids: string[];
  note: string | null;
  payments: WorkPayment[];
}

export interface WorkLedgerSummary {
  activeCount: number;
  totalContract: number;
  totalExpectedProfit: number;
  thisMonthDue: number;
  overdueCount: number;
}

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface ManagerOption {
  id: string;
  name: string;
}
