// ─── 법령 조문 ───────────────────────────────────────────────────────────────

export type LawCategory = 'payment' | 'penalty' | 'termination' | 'privacy' | 'general';

/** law_chunks 테이블 레코드 */
export interface LawChunk {
  id: string;
  law_name: string;
  article_no: string;
  clause_no: string | null;
  content: string;
  category: LawCategory;
  similarity?: number;
}

// ─── 수정 제안 ────────────────────────────────────────────────────────────────

/** 단일 조항에 대한 수정 제안 */
export interface SuggestionItem {
  item_key: string;
  item_name: string;
  original: string;
  laws: (LawChunk & { similarity: number })[];
  revised: string;
  reason: string;
}

/** POST /api/contract-risk/[id]/suggest 요청 바디 */
export interface SuggestRequest {
  item_keys: string[];
}

/** POST /api/contract-risk/[id]/suggest 응답 */
export interface SuggestResponse {
  suggestions: SuggestionItem[];
}

// ─── 적용 ────────────────────────────────────────────────────────────────────

export interface ApplyTarget {
  item_key: string;
  revised: string;
}

/** POST /api/contract-risk/[id]/apply 요청 바디 */
export interface ApplyRequest {
  suggestions: ApplyTarget[];
  outputFormat: 'docx' | 'hwpx';
}

/** POST /api/contract-risk/[id]/apply 응답 */
export interface ApplyResponse {
  signedUrl: string;
  fileName: string;
}

// ─── UI 상태 ─────────────────────────────────────────────────────────────────

export type DecisionStatus = 'pending' | 'accepted' | 'skipped';

export interface SuggestionState extends SuggestionItem {
  decision: DecisionStatus;
}

// ─── 시드 API ────────────────────────────────────────────────────────────────

export interface LawSeedRequest {
  chunks: Omit<LawChunk, 'id' | 'similarity'>[];
}

export interface LawSeedResponse {
  inserted: number;
  failed: number;
  errors?: string[];
}
