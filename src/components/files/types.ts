export interface FileItem {
  id: string;
  name: string;
  type: string;
  department: string;
  size: string;
  sizeBytes?: number;
  uploadDate: string;
  status: '완료' | '처리중' | '오류';
  scope: 'company' | 'department';
  isOwner: boolean;
  sourceType?: 'file' | 'document';
  sourceFileIds?: string[];
  linkedDocumentId?: string | null;
  linkedDocumentTitle?: string | null;
}

export interface ScrapeResult {
  success: boolean;
  message: string;
  linkCount?: number;
}

export interface FileOpsSpotlightItem {
  id: string;
  title: string;
  type: 'file' | 'document';
  href: string;
  meta: string;
}

export interface FileOpsSummary {
  sharePendingCount: number;
  commentPendingCount: number;
  recentUpdateCount: number;
  sharePendingItems: FileOpsSpotlightItem[];
  commentPendingItems: FileOpsSpotlightItem[];
  recentUpdatedItems: FileOpsSpotlightItem[];
}
