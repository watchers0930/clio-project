export interface TemplateFile {
  id: string;
  name: string;
  type: string;
  size: string;
}

export interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  content: string;
  templateMode?: 'html-template';
  templateHtml?: string;
  templateFields?: { key: string; label: string; type: 'text' | 'textarea' | 'date' | 'checkbox' | 'select'; required?: boolean; placeholder?: string; autoFill?: 'user' | 'source' | 'document'; aiAssist?: boolean; options?: string[]; showWhen?: { field: string; equals?: string; notEquals?: string } }[];
  templateSections?: { key: string; title: string; prompt: string }[];
  department: string;
  departmentId: string;
  scope: '전사 공용' | '부서 전용';
  usageCount: number;
  lastUpdated: string;
  placeholders: string[];
  templateFile: TemplateFile | null;
}

export interface AutoPlaceholder {
  key: string;
  label: string;
  type: string;
  location: string;
  context?: string;
  selected: boolean;
}
