// 리스크 수준
export type RiskLevel = 'high' | 'medium' | 'low';

// 분석 카테고리
export type Category = 'unfavorable' | 'missing' | 'ambiguous';

// 계약서 유형
export type ContractType = 'system' | 'maintenance' | 'software' | 'general' | 'consulting' | 'licensing' | 'construction' | 'outsourcing';

// 분석 입장
export type Perspective = 'seller_side' | 'buyer_side';

// 분석 상태
export type AnalysisStatus = 'pending' | 'processing' | 'done' | 'error';

// 분석 파일 형식
export type ContractRiskFileType = 'docx' | 'hwpx' | 'pdf' | 'txt';

// 개별 리스크 항목 (AI 분석 결과)
export interface RiskItem {
  id: string;           // 'A-01', 'B-03', 'C-02' 등
  found: boolean;       // 해당 리스크가 계약서에서 탐지되었는지 여부
  risk_level: RiskLevel;
  excerpt: string;      // 원문 발췌 (최대 200자, 미탐지 시 빈 문자열)
  explanation: string;  // AI 분석 설명
  recommendation: string; // 권고사항
  legal_basis?: string; // 판단 근거 법령/조항 요약
}

// 전체 분석 결과
export interface RiskResult {
  items: RiskItem[];
  summary: string;
}

// 리스크 건수 요약
export interface RiskCount {
  high: number;
  medium: number;
  low: number;
}

// DB 레코드 (contract_risk_analyses 테이블 매핑)
export interface ContractRiskAnalysis {
  id: string;
  user_id: string;
  file_name: string;
  file_type: ContractRiskFileType;
  contract_type: ContractType;
  perspective: Perspective;
  raw_text: string | null;
  risk_result: RiskResult;
  risk_count: RiskCount;
  status: AnalysisStatus;
  created_at: string;
  updated_at: string;
}

// 분석 항목 정의 (contract-risk-items.ts에서 사용)
export interface RiskItemDefinition {
  id: string;
  category: Category;
  name: string;
  default_risk_level: RiskLevel;
  description: string;
}

// 필터 상태
export interface RiskFilterState {
  level: RiskLevel | 'all';
  category: Category | 'all';
}

// 목록 조회용 (raw_text, risk_result 제외)
export interface ContractRiskListItem {
  id: string;
  file_name: string;
  file_type: string;
  contract_type: ContractType;
  perspective: Perspective;
  risk_count: RiskCount;
  status: AnalysisStatus;
  created_at: string;
}
