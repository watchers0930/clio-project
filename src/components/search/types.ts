export interface SearchResult {
  id: string;
  name: string;
  excerpt: string;
  relevance: number;
  fileType: string;
  department: string;
  date: string;
  aiSummary: string;
  sourceType?: 'file' | 'document';
  dataSource?: 'gmail' | 'upload' | 'local';
  localPath?: string;
  externalId?: string | null;
  relationLabel?: string | null;
  originDocumentId?: string | null;
  originDocumentTitle?: string | null;
  duplicateCount?: number; // 같은 제목 접기 시 묶인 총 건수(대표 포함)
  groupItems?: SearchResult[]; // 접힌 나머지 개별 항목(대표 제외, 최신순)
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type SearchTab = 'file' | 'ai';
