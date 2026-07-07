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
  dataSource?: 'gmail' | 'upload';
  externalId?: string | null;
  relationLabel?: string | null;
  originDocumentId?: string | null;
  originDocumentTitle?: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type SearchTab = 'file' | 'ai';
