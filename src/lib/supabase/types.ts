// =============================================================================
// CLIO Database Types
// DB 스키마에 맞는 TypeScript 타입 정의
// =============================================================================

// ---------------------------------------------------------------------------
// 열거형 타입
// ---------------------------------------------------------------------------

/** 사용자 역할 */
export type UserRole = 'admin' | 'manager' | 'user';

/** 파일 처리 상태 */
export type FileStatus = 'uploading' | 'processing' | 'completed' | 'indexed' | 'error';

/** 템플릿 공개 범위 */
export type TemplateScope = 'department' | 'company';
/** 레거시 호환 alias */
export type TemplateType = TemplateScope;

/** 문서 작성 상태 */
export type DocumentStatus = 'draft' | 'completed';

/** 채널 유형 */
export type ChannelType = 'department' | 'direct' | 'group';

// ---------------------------------------------------------------------------
// DB Row 타입 (Supabase 제네릭용 — optional 필드 없이 엄격하게 정의)
// ---------------------------------------------------------------------------

/** 부서 (DB Row) */
export interface DbDepartment {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

/** 사용자 (DB Row) */
export interface DbUser {
  id: string;
  email: string;
  name: string;
  department_id: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

/** 파일 (DB Row) */
export interface DbFileRecord {
  id: string;
  name: string;
  type: string | null;
  size: number;
  department_id: string | null;
  uploaded_by: string | null;
  status: string;
  storage_path: string | null;
  created_at: string;
  updated_at: string;
}

/** 템플릿 (DB Row) */
export interface DbTemplate {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  scope: string;
  icon: string | null;
  content: string | null;
  placeholders: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 문서 (DB Row) */
export interface DbDocument {
  id: string;
  title: string;
  content: string | null;
  template_id: string | null;
  source_file_ids: string[];
  instructions: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
}

/** 채널 (DB Row) */
export interface DbChannel {
  id: string;
  name: string;
  type: string;
  department_id: string | null;
  created_at: string;
}

/** 채널 멤버 (DB Row) */
export interface DbChannelMember {
  channel_id: string;
  user_id: string;
  joined_at: string;
}

/** 메시지 (DB Row) */
export interface DbMessage {
  id: string;
  channel_id: string;
  sender_id: string | null;
  content: string;
  attachment_name: string | null;
  attachment_size: string | null;
  document_id: string | null;
  created_at: string;
}

/** 감사 로그 (DB Row) */
export interface DbAuditLog {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

/** 파일 청크 (DB Row) */
export interface DbFileChunk {
  id: string;
  file_id: string;
  content: string;
  chunk_index: number;
  embedding: number[];
  token_count: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Supabase Database 스키마 (createClient 제네릭용)
// Row 타입에 optional 필드가 있으면 Supabase 내부 타입 추론이 깨지므로
// 모든 필드를 required로 정의
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: DbDepartment;
        Insert: { id?: string; name: string; code: string; created_at?: string };
        Update: { name?: string; code?: string };
        Relationships: [];
      };
      users: {
        Row: DbUser;
        Insert: { id: string; email: string; name: string; department_id?: string | null; role?: string; avatar_url?: string | null; created_at?: string };
        Update: { email?: string; name?: string; department_id?: string | null; role?: string; avatar_url?: string | null };
        Relationships: [];
      };
      files: {
        Row: DbFileRecord;
        Insert: { id?: string; name: string; type?: string | null; size?: number; department_id?: string | null; uploaded_by?: string | null; status?: string; storage_path?: string | null; created_at?: string; updated_at?: string };
        Update: { name?: string; type?: string | null; size?: number; department_id?: string | null; uploaded_by?: string | null; status?: string; storage_path?: string | null; updated_at?: string };
        Relationships: [];
      };
      file_chunks: {
        Row: DbFileChunk;
        Insert: { id?: string; file_id: string; content: string; chunk_index: number; embedding: number[]; token_count: number; created_at?: string };
        Update: { content?: string; chunk_index?: number; embedding?: number[]; token_count?: number };
        Relationships: [];
      };
      templates: {
        Row: DbTemplate;
        Insert: { id?: string; name: string; description?: string | null; department_id?: string | null; scope?: string; icon?: string | null; content?: string | null; placeholders?: unknown; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { name?: string; description?: string | null; department_id?: string | null; scope?: string; icon?: string | null; content?: string | null; placeholders?: unknown; created_by?: string | null; updated_at?: string };
        Relationships: [];
      };
      documents: {
        Row: DbDocument;
        Insert: { id?: string; title: string; content?: string | null; template_id?: string | null; source_file_ids?: string[]; instructions?: string | null; status?: string; created_by?: string | null; created_at?: string };
        Update: { title?: string; content?: string | null; template_id?: string | null; source_file_ids?: string[]; instructions?: string | null; status?: string; created_by?: string | null };
        Relationships: [];
      };
      channels: {
        Row: DbChannel;
        Insert: { id?: string; name: string; type?: string; department_id?: string | null; created_at?: string };
        Update: { name?: string; type?: string; department_id?: string | null };
        Relationships: [];
      };
      channel_members: {
        Row: DbChannelMember;
        Insert: { channel_id: string; user_id: string; joined_at?: string };
        Update: { joined_at?: string };
        Relationships: [];
      };
      messages: {
        Row: DbMessage;
        Insert: { id?: string; channel_id: string; sender_id?: string | null; content: string; attachment_name?: string | null; attachment_size?: string | null; document_id?: string | null; created_at?: string };
        Update: { content?: string; attachment_name?: string | null; attachment_size?: string | null; document_id?: string | null };
        Relationships: [];
      };
      audit_logs: {
        Row: DbAuditLog;
        Insert: { id?: string; user_id?: string | null; action: string; target_type?: string | null; target_id?: string | null; details?: Record<string, unknown>; created_at?: string };
        Update: { action?: string; target_type?: string | null; target_id?: string | null; details?: Record<string, unknown> };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_file_chunks: {
        Args: { query_embedding: string; match_count: number; match_threshold: number };
        Returns: { id: string; file_id: string; content: string; chunk_index: number; token_count: number; similarity: number }[];
      };
    };
  };
}

// ---------------------------------------------------------------------------
// 앱 레벨 타입 (mock 데이터 및 UI 컴포넌트에서 사용)
// DB 타입 + 레거시 호환 필드를 함께 지원
// ---------------------------------------------------------------------------

/** 부서 */
export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  created_at: string;
}

/** 사용자 프로필 */
export interface User {
  id: string;
  email: string;
  name: string;
  department_id?: string | null;
  department?: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

/** 파일 메타데이터 */
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

/** 파일 청크 (벡터 검색용) */
export interface FileChunk {
  id: string;
  file_id: string;
  content: string;
  chunk_index: number;
  embedding: number[];
  token_count: number;
  created_at: string;
}

/** 문서 템플릿 */
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

/** AI 생성 문서 */
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

/** 감사 로그 */
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

/** 메시징 채널 */
export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  department_id: string | null;
  created_at: string;
}

/** 채널 멤버 */
export interface ChannelMember {
  id?: string;
  channel_id: string;
  user_id: string;
  joined_at: string;
}

/** 채팅 메시지 */
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

// ---------------------------------------------------------------------------
// API 응답 타입
// ---------------------------------------------------------------------------

/** 표준 API 응답 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 페이지네이션 API 응답 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

/** 검색 결과 */
export interface SearchResult {
  file_id: string;
  file_name: string;
  chunk_content: string;
  chunk_index: number;
  relevance_score: number;
  department: string;
}

/** 대시보드 통계 */
export interface DashboardStats {
  total_files: number;
  total_documents: number;
  total_users: number;
  total_templates: number;
  recent_activity: AuditLog[];
  file_type_breakdown: Record<string, number>;
  department_breakdown: Record<string, number>;
}

/** 로그인 요청 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** 로그인 응답 */
export interface LoginResponse {
  token: string;
  user: User;
}
