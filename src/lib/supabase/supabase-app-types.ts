import type {
  ChannelType,
  DocumentStatus,
  EventType,
  FileStatus,
  MemoColor,
  QualityCategory,
  QualitySeverity,
  TemplateScope,
  TemplateType,
  TodoPriority,
  TodoStatus,
  UserRole,
} from './supabase-shared-types';

export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  position: string;
  department_id?: string | null;
  department?: string;
  role: UserRole;
  avatar_url: string | null;
  is_active?: boolean;
  signature_path?: string | null;
  sidebar_menus?: string[] | null;
  created_at: string;
}

export interface FileRecord {
  id: string;
  name: string;
  type?: string | null;
  mime_type?: string;
  size: number;
  department_id: string;
  uploaded_by?: string | null;
  user_id?: string;
  status: FileStatus;
  storage_path: string;
  original_name?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FileChunk {
  id: string;
  file_id: string;
  content: string;
  chunk_index: number;
  embedding: number[];
  token_count: number;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  department_id: string;
  scope?: TemplateScope;
  type?: TemplateType;
  icon?: string | null;
  content: string | { placeholders: string[]; structure: Record<string, unknown> };
  placeholders?: string[];
  is_active?: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  template_id: string;
  source_file_ids: string[];
  instructions?: string | null;
  status: DocumentStatus;
  created_by?: string | null;
  user_id?: string;
  watermark?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target_type?: string;
  target_id?: string;
  resource_type?: string;
  resource_id?: string;
  details: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  department_id: string | null;
  created_at: string;
}

export interface ChannelMember {
  id?: string;
  channel_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id?: string | null;
  user_id?: string;
  content: string;
  attachment_name?: string | null;
  attachment_size?: string | null;
  document_id?: string | null;
  is_read?: boolean;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  event_type: EventType;
  start_at: string;
  end_at: string;
  all_day: boolean;
  department_id?: string | null;
  created_by: string;
  creator_name?: string;
  department_name?: string;
  created_at: string;
  updated_at: string;
}

export interface TodoItem {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority: TodoPriority;
  status: TodoStatus;
  completed_at?: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface MemoItem {
  id: string;
  title: string;
  content?: string | null;
  color: MemoColor;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

export interface SearchResult {
  file_id: string;
  file_name: string;
  chunk_content: string;
  chunk_index: number;
  relevance_score: number;
  department: string;
}

export interface DashboardStats {
  total_files: number;
  total_documents: number;
  total_users: number;
  total_templates: number;
  role?: string;
  department_name?: string;
  scope_label?: string;
  scope_hint?: string;
  accessible_department_count?: number;
  recent_activity: AuditLog[];
  file_type_breakdown: Record<string, number>;
  department_breakdown: Record<string, number>;
  upload_trend?: Array<{ week: string; label: string; count: number }>;
  doc_dept_breakdown?: Record<string, number>;
  derived_document_count?: number;
  flow_kpis?: {
    upload_count_30d: number;
    search_usage_rate_30d: number;
    document_generation_completion_rate_30d: number;
    shared_document_count: number;
    comment_reflect_completion_rate_30d: number;
  };
  document_flow_funnel_30d?: {
    created: number;
    shared: number;
    commented: number;
    reflected: number;
  };
  flow_window_days?: number;
  flow_diagnostics?: {
    active_user_count: number;
    search_user_count: number;
    created_document_count: number;
    completed_document_count: number;
    total_comment_count: number;
    reflected_comment_count: number;
  };
}

export interface WorkLog {
  id: string;
  user_id: string;
  log_date: string;
  done: string | null;
  plan: string | null;
  note: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

export interface WorkLogAttachment {
  id: string;
  log_id: string;
  document_id: string | null;
  file_id: string | null;
  created_at: string;
}

export interface TeamWorkLogEntry {
  user_id: string;
  user_name: string;
  position: string;
  log_date: string;
  has_log: boolean;
  is_locked: boolean;
  log_id: string | null;
}

export interface QualityCheckItem {
  category: QualityCategory;
  severity: QualitySeverity;
  original: string;
  suggestion: string;
  description: string;
}

export interface QualityCheckResult {
  overall_score: number;
  items: QualityCheckItem[];
  summary: string;
}

export interface QualityCheckResponse {
  check_id: string | null;
  document_id: string;
  overall_score: number;
  items: QualityCheckItem[];
  summary: string;
  checked_at: string;
  from_cache: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
