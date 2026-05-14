import type { RiskItem } from '@/lib/types/contract-risk';

export interface LawResult {
  lawName: string;
  lawId: string;
  articleNo: string;
  articleContent: string;
  promulgationDate: string;
}

export interface ClauseFixState {
  fixId: string | null;
  suggestedFix: string;
  lawResults: LawResult[];
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  finalText: string;
  loading: boolean;
}

export interface ClauseFixModalProps {
  open: boolean;
  onClose: () => void;
  analysisId: string;
  riskItems: RiskItem[];
}

export const RISK_LEVEL_CLS: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border border-red-200',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  low: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

export const RISK_LEVEL_LABEL: Record<string, string> = {
  high: '고위험',
  medium: '중위험',
  low: '저위험',
};
