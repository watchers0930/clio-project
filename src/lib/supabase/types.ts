// =============================================================================
// CLIO Database Types
// =============================================================================

export type UserRole = 'admin' | 'manager' | 'user';
export type FileStatus = 'uploading' | 'processing' | 'indexed' | 'error';
export type TemplateType = 'department' | 'company';
export type DocumentStatus = 'draft' | 'completed';
export type ChannelType = 'department' | 'direct' | 'group';

// ---------------------------------------------------------------------------
// Table Row Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name: string;
  department: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface FileRecord {
  id: string;
  user_id: string;
  department_id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size: number;
  storage_path: string;
  status: FileStatus;
  metadata: Record<string, unknown>;
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
  type: TemplateType;
  content: {
    placeholders: string[];
    structure: Record<string, unknown>;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  template_id: string;
  title: string;
  content: string;
  source_file_ids: string[];
  status: DocumentStatus;
  watermark: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  department_id: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Supabase Database Schema (for createClient generic)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      users: { Row: User; Insert: Omit<User, 'id' | 'created_at'>; Update: Partial<Omit<User, 'id'>> };
      departments: { Row: Department; Insert: Omit<Department, 'id' | 'created_at'>; Update: Partial<Omit<Department, 'id'>> };
      files: { Row: FileRecord; Insert: Omit<FileRecord, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<FileRecord, 'id'>> };
      file_chunks: { Row: FileChunk; Insert: Omit<FileChunk, 'id' | 'created_at'>; Update: Partial<Omit<FileChunk, 'id'>> };
      templates: { Row: Template; Insert: Omit<Template, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Template, 'id'>> };
      documents: { Row: Document; Insert: Omit<Document, 'id' | 'created_at'>; Update: Partial<Omit<Document, 'id'>> };
      audit_logs: { Row: AuditLog; Insert: Omit<AuditLog, 'id' | 'created_at'>; Update: Partial<Omit<AuditLog, 'id'>> };
      channels: { Row: Channel; Insert: Omit<Channel, 'id' | 'created_at'>; Update: Partial<Omit<Channel, 'id'>> };
      messages: { Row: Message; Insert: Omit<Message, 'id' | 'created_at'>; Update: Partial<Omit<Message, 'id'>> };
    };
  };
}

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
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
  recent_activity: AuditLog[];
  file_type_breakdown: Record<string, number>;
  department_breakdown: Record<string, number>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
