import { CONTRACT_RISK_ITEMS } from '@/lib/contract-risk-items';
import type { RiskItem, ContractRiskAnalysis } from '@/lib/types/contract-risk';

export type ChangeType = 'improved' | 'worsened' | 'new' | 'resolved' | 'unchanged';

export interface ComparisonItem {
  id: string;
  name: string;
  category: string;
  change: ChangeType;
  before: RiskItem | null;
  after: RiskItem | null;
}

const LEVEL_ORDER: Record<string, number> = { high: 2, medium: 1, low: 0 };

export function compareAnalyses(
  before: ContractRiskAnalysis,
  after: ContractRiskAnalysis,
): ComparisonItem[] {
  const beforeMap = new Map(
    before.risk_result.items.filter(i => i.found).map(i => [i.id, i]),
  );
  const afterMap = new Map(
    after.risk_result.items.filter(i => i.found).map(i => [i.id, i]),
  );

  const allIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const results: ComparisonItem[] = [];

  for (const id of allIds) {
    const def = CONTRACT_RISK_ITEMS.find(d => d.id === id);
    const b = beforeMap.get(id) ?? null;
    const a = afterMap.get(id) ?? null;

    let change: ChangeType;
    if (b && !a) {
      change = 'resolved';
    } else if (!b && a) {
      change = 'new';
    } else if (b && a) {
      const bLevel = LEVEL_ORDER[b.risk_level] ?? 0;
      const aLevel = LEVEL_ORDER[a.risk_level] ?? 0;
      if (aLevel < bLevel) change = 'improved';
      else if (aLevel > bLevel) change = 'worsened';
      else change = 'unchanged';
    } else {
      change = 'unchanged';
    }

    results.push({
      id,
      name: def?.name ?? id,
      category: def?.category ?? '',
      change,
      before: b,
      after: a,
    });
  }

  // 변경된 항목 우선 정렬: worsened > new > improved > resolved > unchanged
  const changeOrder: Record<ChangeType, number> = {
    worsened: 0,
    new: 1,
    improved: 2,
    resolved: 3,
    unchanged: 4,
  };

  return results.sort((a, b) => (changeOrder[a.change] ?? 5) - (changeOrder[b.change] ?? 5));
}
