export interface DocumentItem {
  id: string;
  title: string;
  template: string;
  createdAt: string;
  status: '초안' | '완료';
  sourceCount: number;
  content?: string;
  versionNumber?: number;
  parentId?: string | null;
}

export interface VersionItem {
  id: string;
  title: string;
  versionNumber: number;
  createdAt: string;
  status: string;
  createdBy: string;
  isCurrent: boolean;
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
  templateFile: TemplateFile | null;
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
