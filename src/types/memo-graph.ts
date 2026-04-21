import type { MemoColor } from '@/lib/supabase/types';

export interface GraphNode {
  id: string;
  title: string;
  content: string | null;
  color: MemoColor;
  hasEmbedding: boolean;
}

/** title: 제목 단어 일치 (실선) | content: 제목 단어가 내용에 포함 (점선) | semantic: 의미 유사도 (점선) */
export type LinkType = 'title' | 'content' | 'semantic';

export interface GraphLink {
  source: string;
  target: string;
  similarity: number;
  type: LinkType;
}

export interface ClusterInfo {
  clusterIds: string[];
  name?: string;
  color?: string;
}

export interface MemoGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  clusters?: ClusterInfo[];
}

export interface ForceGraphNode extends GraphNode {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

export interface ForceGraphLink {
  source: string | ForceGraphNode;
  target: string | ForceGraphNode;
  similarity: number;
  type: LinkType;
}
