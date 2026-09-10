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
  duplicateCount?: number; // 같은 제목 중복 알림 접기 시 묶인 총 건수(대표 포함)
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type SearchTab = 'file' | 'ai';
