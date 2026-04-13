import type { RiskItemDefinition } from './types/contract-risk';

export const CONTRACT_RISK_ITEMS: RiskItemDefinition[] = [
  // ─── 카테고리 A: 불리한 조항 탐지 ───────────────────────────────────────
  {
    id: 'A-01',
    category: 'unfavorable',
    name: '일방적 계약 해지권 (발주자만 보유)',
    default_risk_level: 'medium',
    description: '발주자만 일방적으로 계약을 해지할 수 있는 조항이 있는지 확인',
  },
  {
    id: 'A-02',
    category: 'unfavorable',
    name: '손해배상 무제한 책임 조항',
    default_risk_level: 'high',
    description: '공급자의 손해배상 책임 상한이 없거나 계약금액을 초과하는 배상이 가능한 조항',
  },
  {
    id: 'A-03',
    category: 'unfavorable',
    name: '지체상금률 과다 (일반 0.1% 초과)',
    default_risk_level: 'medium',
    description: '일 지체상금률이 업계 표준(0.1%) 초과 여부 확인',
  },
  {
    id: 'A-04',
    category: 'unfavorable',
    name: '납기 불명확 또는 일방적 변경 허용',
    default_risk_level: 'medium',
    description: '발주자가 일방적으로 납기를 변경할 수 있는 조항 또는 납기 기준이 모호한 경우',
  },
  {
    id: 'A-05',
    category: 'unfavorable',
    name: '대금 지급 기한 과도하게 긴 조항 (60일 초과)',
    default_risk_level: 'medium',
    description: '납품 완료 후 대금 지급 기한이 60일을 초과하는 경우',
  },
  {
    id: 'A-06',
    category: 'unfavorable',
    name: '개발 결과물 지식재산권 전량 발주자 이전',
    default_risk_level: 'high',
    description: '공급자가 개발한 모든 결과물(소스코드, 저작권 등)이 무조건 발주자에게 귀속되는 조항',
  },
  {
    id: 'A-07',
    category: 'unfavorable',
    name: '재하도급 금지 + 페널티 과다',
    default_risk_level: 'medium',
    description: '재하도급을 전면 금지하거나 재하도급 시 과도한 페널티를 부과하는 조항',
  },
  {
    id: 'A-08',
    category: 'unfavorable',
    name: '비밀유지 기간 무제한 또는 과도하게 긴 경우',
    default_risk_level: 'low',
    description: '비밀유지 의무 기간이 계약 종료 후 5년 초과이거나 무기한인 경우',
  },
  {
    id: 'A-09',
    category: 'unfavorable',
    name: '분쟁 관할 법원 발주자 소재지 일방 지정',
    default_risk_level: 'low',
    description: '분쟁 발생 시 관할 법원을 발주자 소재지 법원으로만 지정한 경우',
  },
  {
    id: 'A-10',
    category: 'unfavorable',
    name: '유지보수 범위 과도하게 광범위하게 정의',
    default_risk_level: 'medium',
    description: '유지보수 대상 범위가 명확히 한정되지 않아 공급자 부담이 과도하게 커질 수 있는 조항',
  },
  // ─── 카테고리 B: 필수 조항 누락 탐지 ───────────────────────────────────
  {
    id: 'B-01',
    category: 'missing',
    name: '계약 목적물 (시스템 범위) 명세 누락',
    default_risk_level: 'high',
    description: '구축할 시스템의 범위와 기능이 구체적으로 정의되지 않은 경우',
  },
  {
    id: 'B-02',
    category: 'missing',
    name: '납기/완료 기준 정의 누락',
    default_risk_level: 'high',
    description: '납기일 또는 프로젝트 완료 기준이 명확히 정의되지 않은 경우',
  },
  {
    id: 'B-03',
    category: 'missing',
    name: '검수 기준 및 기간 미정의',
    default_risk_level: 'medium',
    description: '검수(납품 확인) 기준, 방법, 기간이 구체적으로 정의되지 않은 경우',
  },
  {
    id: 'B-04',
    category: 'missing',
    name: '대금 지급 조건 및 시기 미정의',
    default_risk_level: 'high',
    description: '계약 대금의 지급 조건(선급금/중도금/잔금)과 지급 시기가 명시되지 않은 경우',
  },
  {
    id: 'B-05',
    category: 'missing',
    name: '하자담보책임 기간 미정의',
    default_risk_level: 'medium',
    description: '납품 후 하자가 발생했을 때 책임 기간이 정의되지 않은 경우',
  },
  {
    id: 'B-06',
    category: 'missing',
    name: '변경관리(추가개발) 절차 미정의',
    default_risk_level: 'medium',
    description: '계약 범위 변경 또는 추가 개발 요청 처리 절차가 정의되지 않은 경우',
  },
  {
    id: 'B-07',
    category: 'missing',
    name: '개인정보 처리 위탁 조항 누락',
    default_risk_level: 'medium',
    description: '개인정보를 처리하는 시스템 개발 계약에서 개인정보 처리 위탁 조항이 없는 경우',
  },
  {
    id: 'B-08',
    category: 'missing',
    name: '계약 해지 절차 및 귀책 사유 미정의',
    default_risk_level: 'medium',
    description: '계약 해지 시 절차와 귀책 사유별 처리 방법이 정의되지 않은 경우',
  },
  {
    id: 'B-09',
    category: 'missing',
    name: '지식재산권 귀속 조항 누락',
    default_risk_level: 'high',
    description: '개발 결과물의 저작권·특허권 등 지식재산권 귀속 방식이 명시되지 않은 경우',
  },
  {
    id: 'B-10',
    category: 'missing',
    name: '보안/기밀유지 의무 조항 누락',
    default_risk_level: 'low',
    description: '프로젝트 수행 중 취득한 정보의 기밀유지 의무 조항이 없는 경우',
  },
  // ─── 카테고리 C: 모호한 표현 탐지 ──────────────────────────────────────
  {
    id: 'C-01',
    category: 'ambiguous',
    name: '"성실히 이행한다" 등 정량화되지 않은 의무 표현',
    default_risk_level: 'low',
    description: '의무 이행 기준이 주관적이거나 정량화되지 않은 표현 사용',
  },
  {
    id: 'C-02',
    category: 'ambiguous',
    name: '"협의하여 결정한다" 협의 불발 시 처리 기준 없음',
    default_risk_level: 'medium',
    description: '협의가 이루어지지 않을 경우 처리 방법이 정의되지 않은 경우',
  },
  {
    id: 'C-03',
    category: 'ambiguous',
    name: '완료 기준이 주관적으로 정의 ("만족스러운 수준")',
    default_risk_level: 'medium',
    description: '납품 완료 또는 검수 합격 기준이 주관적 판단에 의존하는 경우',
  },
  {
    id: 'C-04',
    category: 'ambiguous',
    name: '금액/기간이 별도 문서 참조인데 첨부 없음',
    default_risk_level: 'high',
    description: '계약서가 별도 문서를 참조하지만 해당 문서가 첨부되지 않은 경우',
  },
  {
    id: 'C-05',
    category: 'ambiguous',
    name: '적용 법률/버전이 미정의된 기술 명세 참조',
    default_risk_level: 'low',
    description: '기술 표준·규정을 참조하면서 버전이나 시점이 명시되지 않은 경우',
  },
];

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  system: '시스템구축계약서',
  maintenance: '유지보수계약서',
  software: '소프트웨어개발계약서',
  general: '용역계약서 (범용)',
};

export const PERSPECTIVE_LABELS: Record<string, string> = {
  seller_side: '을 (공급자)',
  buyer_side: '갑 (발주자)',
};

export const CATEGORY_LABELS: Record<string, string> = {
  unfavorable: '불리한 조항',
  missing: '필수 항목 누락',
  ambiguous: '모호한 표현',
};

export const RISK_LEVEL_LABELS: Record<string, string> = {
  high: '상',
  medium: '중',
  low: '하',
};
