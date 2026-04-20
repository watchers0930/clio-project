// =============================================================================
// Memo Graph Types
// GET /api/memos/graph 응답 및 그래프 컴포넌트 내부 타입
// =============================================================================

import type { MemoColor } from '@/lib/supabase/types';

/** API 응답: 그래프 노드 */
export interface GraphNode {
  id: string;
  title: string;
  color: MemoColor;
  hasEmbedding: boolean;
}

/** API 응답: 그래프 엣지 */
export interface GraphLink {
  source: string;
  target: string;
  /** 0~1 사이 유사도 점수 */
  similarity: number;
}

/** GET /api/memos/graph 응답 */
export interface MemoGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/** react-force-graph-2d 내부 노드 (런타임에 x, y 좌표 추가됨) */
export interface ForceGraphNode extends GraphNode {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  /** 선택된 노드 여부 (하이라이트용) */
  isSelected?: boolean;
}

/** react-force-graph-2d 내부 링크 */
export interface ForceGraphLink {
  source: string | ForceGraphNode;
  target: string | ForceGraphNode;
  similarity: number;
}
