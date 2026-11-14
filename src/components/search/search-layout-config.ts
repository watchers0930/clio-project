/**
 * 파일 검색 탭 카드들의 여백·간격 설정 타입과 기본값.
 */

export interface ResumeCardSpacingConfig {
  descriptionMarginTop: number;
  descriptionMarginBottom: number;
  excerptMarginTop: number;
  actionsMarginTop: number;
}

interface SearchContextCardLayoutConfig {
  outerPaddingX: number;
  outerPaddingY: number;
  chipGap: number;
  descriptionMarginTop: number;
  descriptionSecondaryMarginTop: number;
  helperBoxMarginTop: number;
  helperBoxPaddingX: number;
  helperBoxPaddingY: number;
}

interface RelatedDocsCardLayoutConfig {
  outerPadding: number;
  contentMarginTop: number;
  listGap: number;
  itemPaddingX: number;
  itemPaddingY: number;
}

interface RecentFlowCardLayoutConfig {
  outerPadding: number;
  contentMarginTop: number;
  chipGap: number;
}

export type LayoutStore = {
  resumeDocument: ResumeCardSpacingConfig;
  resumeFile: ResumeCardSpacingConfig;
  searchContext: SearchContextCardLayoutConfig;
  relatedDocs: RelatedDocsCardLayoutConfig;
  recentFlow: RecentFlowCardLayoutConfig;
};

const DEFAULT_RESUME_CARD_SPACING: ResumeCardSpacingConfig = {
  descriptionMarginTop: 12,
  descriptionMarginBottom: 14,
  excerptMarginTop: 20,
  actionsMarginTop: 20,
};

const DEFAULT_SEARCH_CONTEXT_LAYOUT: SearchContextCardLayoutConfig = {
  outerPaddingX: 20,
  outerPaddingY: 16,
  chipGap: 8,
  descriptionMarginTop: 12,
  descriptionSecondaryMarginTop: 4,
  helperBoxMarginTop: 12,
  helperBoxPaddingX: 16,
  helperBoxPaddingY: 12,
};

const DEFAULT_RELATED_DOCS_LAYOUT: RelatedDocsCardLayoutConfig = {
  outerPadding: 20,
  contentMarginTop: 16,
  listGap: 12,
  itemPaddingX: 16,
  itemPaddingY: 12,
};

const DEFAULT_RECENT_FLOW_LAYOUT: RecentFlowCardLayoutConfig = {
  outerPadding: 20,
  contentMarginTop: 16,
  chipGap: 8,
};

export const DEFAULT_RESUME_CARD_LAYOUTS: LayoutStore = {
  resumeDocument: { ...DEFAULT_RESUME_CARD_SPACING },
  resumeFile: { ...DEFAULT_RESUME_CARD_SPACING },
  searchContext: { ...DEFAULT_SEARCH_CONTEXT_LAYOUT },
  relatedDocs: { ...DEFAULT_RELATED_DOCS_LAYOUT },
  recentFlow: { ...DEFAULT_RECENT_FLOW_LAYOUT },
};
