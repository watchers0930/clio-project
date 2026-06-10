export interface DocumentItem {
  id: string;
  title: string;
  template: string;
  templateId?: string | null;
  createdAt: string;
  status: '초안' | '완료';
  sourceCount: number;
  sourceFileIds?: string[];
  content?: string;
  versionNumber?: number;
  parentId?: string | null;
  originDocumentId?: string | null;
  originContext?: string | null;
}

export interface VersionItem {
  id: string;
  title: string;
  versionNumber: number;
  createdAt: string;
  status: string;
  createdBy: string;
  isCurrent: boolean;
  appliedComments?: {
    id: string;
    content: string;
    userName: string;
    appliedAt: string | null;
  }[];
}

export interface TemplateFile {
  id: string;
  name: string;
  type: string;
  size: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  description: string;
  content?: string;
  templateMode?: 'html-template';
  templateHtml?: string;
  templateFile: TemplateFile | null;
  templateFields?: { key: string; label: string; type: 'text' | 'textarea' | 'date'; required?: boolean; placeholder?: string; defaultValue?: string; autoFill?: 'user' | 'source' | 'document'; aiAssist?: boolean }[];
  templateSections?: { key: string; title: string; prompt: string }[];
}

export interface SourceFile {
  id: string;
  name: string;
  type: string;
  department: string;
  size: string;
  uploadDate: string;
  status: string;
}
