export type DbDepartment = Record<string, unknown> & {
  id: string;
  name: string;
  code: string;
  created_at: string;
};

export type DbUser = Record<string, unknown> & {
  id: string;
  email: string;
  name: string;
  position: string;
  department_id: string | null;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
  signature_path: string | null;
  sidebar_menus: string[] | null;
  created_at: string;
};

export type DbFileRecord = Record<string, unknown> & {
  id: string;
  name: string;
  title?: string | null;
  type: string | null;
  size: number;
  department_id: string | null;
  uploaded_by: string | null;
  user_id?: string | null;
  status: string;
  scope?: string | null;
  storage_path: string | null;
  original_name?: string | null;
  mime_type?: string | null;
  metadata?: Record<string, unknown> | null;
  source?: string | null;
  external_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type DbGoogleConnection = {
  id: string;
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string | null;
  last_synced_at: string | null;
  sync_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type DbTemplate = Record<string, unknown> & {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  scope: string;
  icon: string | null;
  content: string | null;
  placeholders: unknown;
  template_file_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DbDocument = Record<string, unknown> & {
  id: string;
  title: string;
  content: string | null;
  template_id: string | null;
  source_file_ids: string[];
  instructions: string | null;
  status: string;
  storage_path: string | null;
  version_number: number | null;
  parent_id: string | null;
  origin_document_id: string | null;
  origin_context: string | null;
  created_by: string | null;
  created_at: string;
};

export type DbChannel = Record<string, unknown> & {
  id: string;
  name: string;
  type: string;
  department_id: string | null;
  created_at: string;
};

export type DbChannelMember = Record<string, unknown> & {
  channel_id: string;
  user_id: string;
  joined_at: string;
  last_read_at?: string | null;
};

export type DbMessage = Record<string, unknown> & {
  id: string;
  channel_id: string;
  sender_id: string | null;
  content: string;
  attachment_name: string | null;
  attachment_size: string | null;
  document_id: string | null;
  created_at: string;
};

export type DbAuditLog = Record<string, unknown> & {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type DbEvent = Record<string, unknown> & {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_type: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  department_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DbTodo = Record<string, unknown> & {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  completed_at: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type DbMemo = Record<string, unknown> & {
  id: string;
  title: string;
  content: string | null;
  color: string;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DbFileChunk = Record<string, unknown> & {
  id: string;
  file_id: string;
  content: string;
  chunk_index: number;
  embedding: number[];
  token_count: number;
  created_at: string;
};

export type DbWorkLog = Record<string, unknown> & {
  id: string;
  user_id: string;
  log_date: string;
  done: string | null;
  plan: string | null;
  note: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
};

export type DbWorkLogAttachment = Record<string, unknown> & {
  id: string;
  log_id: string;
  document_id: string | null;
  file_id: string | null;
  created_at: string;
};

export type DbDocumentComment = Record<string, unknown> & {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  status: string;
  applied_at: string | null;
  applied_by: string | null;
  applied_version_number: number | null;
  created_at: string;
};

export type DbDocumentPermission = Record<string, unknown> & {
  id: string;
  document_id: string;
  granted_to_user: string | null;
  granted_to_dept: string | null;
  permission: string;
  granted_by: string | null;
  created_at: string;
};

export type DbApproval = Record<string, unknown> & {
  id: string;
  document_id: string;
  requester_id: string;
  approver_id: string;
  status: string;
  comment: string | null;
  requested_at: string;
  decided_at: string | null;
};

export type DbSchedule = Record<string, unknown> & {
  id: string;
  title: string;
  end_date: string;
  source_type?: string | null;
  source_id?: string | null;
  expiry_confidence?: string | null;
  user_id?: string | null;
};

export type DbSharedLink = Record<string, unknown> & {
  id: string;
  token: string;
  resource_type: string;
  resource_id: string;
  title: string | null;
  expires_at: string | null;
  password_hash: string | null;
  view_count: number;
  created_by: string;
  created_at: string;
};

export type DbFilePermission = Record<string, unknown> & {
  id: string;
  file_id: string;
  granted_to_user: string | null;
  granted_to_dept: string | null;
  permission: string;
  granted_by: string | null;
  created_at: string;
};

export type DbFileShare = Record<string, unknown> & {
  id: string;
  file_id: string;
  shared_by: string;
  shared_with: string;
  message_id: string | null;
  permission: string;
  expires_at: string | null;
  created_at: string;
};

export type DbTodoExtraction = Record<string, unknown> & {
  id: string;
  document_id: string;
  extracted_by: string;
  todo_ids: string[];
  todo_count: number;
  created_at: string;
};

export type DbAutofillSession = Record<string, unknown> & {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  detected_fields: unknown;
  filled_values: Record<string, unknown>;
  status: string;
  output_path: string | null;
  created_at: string;
  updated_at: string;
};

export type DbContractRiskAnalysis = Record<string, unknown> & {
  id: string;
  user_id: string | null;
  file_name: string;
  file_type: string;
  contract_type: string;
  perspective: string;
  raw_text: string | null;
  risk_result: Record<string, unknown>;
  risk_count: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
};

export type DbContractClauseFix = Record<string, unknown> & {
  id: string;
  analysis_id: string;
  user_id: string;
  clause_index: number;
  clause_title: string;
  clause_text: string;
  law_references: unknown;
  suggested_fix: string | null;
  status: string;
  final_text: string | null;
  created_at: string;
  updated_at: string;
};

export type DbLawChunk = Record<string, unknown> & {
  id: string;
  law_name: string;
  article_no: string;
  clause_no: string | null;
  content: string;
  embedding: number[] | null;
  category: string;
  created_at: string;
};

export type DbDocumentEmbedding = Record<string, unknown> & {
  id: string;
  document_id: string;
  embedding: number[];
  created_at: string;
  updated_at: string;
};

export type DbDocumentQualityCheck = Record<string, unknown> & {
  id: string;
  document_id: string;
  checked_by: string;
  overall_score: number | null;
  result_json: Record<string, unknown>;
  created_at: string;
};

export type DbUiLayoutConfig = Record<string, unknown> & {
  id: string;
  layout_key: string;
  config: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
};

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
        Insert: { id: string; email: string; name: string; position?: string; department_id?: string | null; role?: string; avatar_url?: string | null; is_active?: boolean; signature_path?: string | null; sidebar_menus?: string[] | null; created_at?: string };
        Update: { email?: string; name?: string; position?: string; department_id?: string | null; role?: string; avatar_url?: string | null; is_active?: boolean; signature_path?: string | null; sidebar_menus?: string[] | null };
        Relationships: [];
      };
      files: {
        Row: DbFileRecord;
        Insert: { id?: string; name: string; type?: string | null; size?: number; department_id?: string | null; uploaded_by?: string | null; status?: string; storage_path?: string | null; scope?: string | null; source?: string | null; external_id?: string | null; created_at?: string; updated_at?: string };
        Update: { name?: string; type?: string | null; size?: number; department_id?: string | null; uploaded_by?: string | null; status?: string; scope?: string | null; storage_path?: string | null; source?: string | null; external_id?: string | null; updated_at?: string };
        Relationships: [];
      };
      user_google_connections: {
        Row: DbGoogleConnection;
        Insert: { id?: string; user_id: string; email: string; access_token: string; refresh_token: string; token_expiry?: string | null; last_synced_at?: string | null; sync_enabled?: boolean; created_at?: string; updated_at?: string };
        Update: { email?: string; access_token?: string; refresh_token?: string; token_expiry?: string | null; last_synced_at?: string | null; sync_enabled?: boolean; updated_at?: string };
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
        Insert: { id?: string; title: string; content?: string | null; template_id?: string | null; source_file_ids?: string[]; instructions?: string | null; status?: string; storage_path?: string | null; created_by?: string | null; created_at?: string };
        Update: { title?: string; content?: string | null; template_id?: string | null; source_file_ids?: string[]; instructions?: string | null; status?: string; storage_path?: string | null; created_by?: string | null };
        Relationships: [];
      };
      document_permissions: {
        Row: DbDocumentPermission;
        Insert: { id?: string; document_id: string; granted_to_user?: string | null; granted_to_dept?: string | null; permission?: string; granted_by?: string | null; created_at?: string };
        Update: { granted_to_user?: string | null; granted_to_dept?: string | null; permission?: string; granted_by?: string | null };
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
        Insert: { channel_id: string; user_id: string; joined_at?: string; last_read_at?: string | null };
        Update: { joined_at?: string; last_read_at?: string | null };
        Relationships: [];
      };
      messages: {
        Row: DbMessage;
        Insert: { id?: string; channel_id: string; sender_id?: string | null; content: string; attachment_name?: string | null; attachment_size?: string | null; document_id?: string | null; created_at?: string };
        Update: { content?: string; attachment_name?: string | null; attachment_size?: string | null; document_id?: string | null };
        Relationships: [];
      };
      events: {
        Row: DbEvent;
        Insert: { id?: string; title: string; description?: string | null; location?: string | null; event_type?: string; start_at: string; end_at: string; all_day?: boolean; department_id?: string | null; created_by: string; created_at?: string; updated_at?: string };
        Update: { title?: string; description?: string | null; location?: string | null; event_type?: string; start_at?: string; end_at?: string; all_day?: boolean; department_id?: string | null; updated_at?: string };
        Relationships: [];
      };
      todos: {
        Row: DbTodo;
        Insert: { id?: string; title: string; description?: string | null; due_date?: string | null; priority?: string; status?: string; completed_at?: string | null; user_id: string; created_at?: string; updated_at?: string };
        Update: { title?: string; description?: string | null; due_date?: string | null; priority?: string; status?: string; completed_at?: string | null; updated_at?: string };
        Relationships: [];
      };
      memos: {
        Row: DbMemo;
        Insert: { id?: string; title: string; content?: string | null; color?: string; is_pinned?: boolean; created_by: string; created_at?: string; updated_at?: string };
        Update: { title?: string; content?: string | null; color?: string; is_pinned?: boolean; updated_at?: string };
        Relationships: [];
      };
      audit_logs: {
        Row: DbAuditLog;
        Insert: { id?: string; user_id?: string | null; action: string; target_type?: string | null; target_id?: string | null; details?: Record<string, unknown>; created_at?: string };
        Update: { action?: string; target_type?: string | null; target_id?: string | null; details?: Record<string, unknown> };
        Relationships: [];
      };
      work_logs: {
        Row: DbWorkLog;
        Insert: { id?: string; user_id: string; log_date: string; done?: string | null; plan?: string | null; note?: string | null; is_locked?: boolean; created_at?: string; updated_at?: string };
        Update: { done?: string | null; plan?: string | null; note?: string | null; is_locked?: boolean; updated_at?: string };
        Relationships: [];
      };
      work_log_attachments: {
        Row: DbWorkLogAttachment;
        Insert: { id?: string; log_id: string; document_id?: string | null; file_id?: string | null; created_at?: string };
        Update: { document_id?: string | null; file_id?: string | null };
        Relationships: [];
      };
      document_comments: {
        Row: DbDocumentComment;
        Insert: { id?: string; document_id: string; user_id: string; content: string; status?: string; applied_at?: string | null; applied_by?: string | null; applied_version_number?: number | null; created_at?: string };
        Update: { content?: string; status?: string; applied_at?: string | null; applied_by?: string | null; applied_version_number?: number | null };
        Relationships: [];
      };
      approvals: {
        Row: DbApproval;
        Insert: { id?: string; document_id: string; requester_id: string; approver_id: string; status?: string; comment?: string | null; requested_at?: string; decided_at?: string | null };
        Update: { status?: string; comment?: string | null; decided_at?: string | null };
        Relationships: [];
      };
      schedules: {
        Row: DbSchedule;
        Insert: { id?: string; title: string; end_date: string; source_type?: string | null; source_id?: string | null; expiry_confidence?: string | null; user_id?: string | null };
        Update: { title?: string; end_date?: string; source_type?: string | null; source_id?: string | null; expiry_confidence?: string | null; user_id?: string | null };
        Relationships: [];
      };
      shared_links: {
        Row: DbSharedLink;
        Insert: { id?: string; token: string; resource_type: string; resource_id: string; title?: string | null; expires_at?: string | null; password_hash?: string | null; view_count?: number; created_by: string; created_at?: string };
        Update: { title?: string | null; expires_at?: string | null; password_hash?: string | null; view_count?: number };
        Relationships: [];
      };
      file_permissions: {
        Row: DbFilePermission;
        Insert: { id?: string; file_id: string; granted_to_user?: string | null; granted_to_dept?: string | null; permission?: string; granted_by?: string | null; created_at?: string };
        Update: { granted_to_user?: string | null; granted_to_dept?: string | null; permission?: string; granted_by?: string | null };
        Relationships: [];
      };
      file_shares: {
        Row: DbFileShare;
        Insert: { id?: string; file_id: string; shared_by: string; shared_with: string; message_id?: string | null; permission?: string; expires_at?: string | null; created_at?: string };
        Update: { message_id?: string | null; permission?: string; expires_at?: string | null };
        Relationships: [];
      };
      todo_extractions: {
        Row: DbTodoExtraction;
        Insert: { id?: string; document_id: string; extracted_by: string; todo_ids?: string[]; todo_count?: number; created_at?: string };
        Update: { todo_ids?: string[]; todo_count?: number };
        Relationships: [];
      };
      autofill_sessions: {
        Row: DbAutofillSession;
        Insert: { id?: string; user_id: string; file_name: string; file_type: string; detected_fields?: unknown; filled_values?: Record<string, unknown>; status?: string; output_path?: string | null; created_at?: string; updated_at?: string };
        Update: { detected_fields?: unknown; filled_values?: Record<string, unknown>; status?: string; output_path?: string | null; updated_at?: string };
        Relationships: [];
      };
      contract_risk_analyses: {
        Row: DbContractRiskAnalysis;
        Insert: { id?: string; user_id?: string | null; file_name: string; file_type: string; contract_type: string; perspective: string; raw_text?: string | null; risk_result?: Record<string, unknown>; risk_count?: Record<string, unknown>; status?: string; created_at?: string; updated_at?: string };
        Update: { raw_text?: string | null; risk_result?: Record<string, unknown>; risk_count?: Record<string, unknown>; status?: string; updated_at?: string };
        Relationships: [];
      };
      contract_clause_fixes: {
        Row: DbContractClauseFix;
        Insert: { id?: string; analysis_id: string; user_id: string; clause_index: number; clause_title: string; clause_text: string; law_references?: unknown; suggested_fix?: string | null; status?: string; final_text?: string | null; created_at?: string; updated_at?: string };
        Update: { law_references?: unknown; suggested_fix?: string | null; status?: string; final_text?: string | null; updated_at?: string };
        Relationships: [];
      };
      law_chunks: {
        Row: DbLawChunk;
        Insert: { id?: string; law_name: string; article_no: string; clause_no?: string | null; content: string; embedding?: number[] | null; category: string; created_at?: string };
        Update: { law_name?: string; article_no?: string; clause_no?: string | null; content?: string; embedding?: number[] | null; category?: string };
        Relationships: [];
      };
      document_embeddings: {
        Row: DbDocumentEmbedding;
        Insert: { id?: string; document_id: string; embedding: number[]; created_at?: string; updated_at?: string };
        Update: { embedding?: number[]; updated_at?: string };
        Relationships: [];
      };
      document_quality_checks: {
        Row: DbDocumentQualityCheck;
        Insert: { id?: string; document_id: string; checked_by: string; overall_score?: number | null; result_json: Record<string, unknown>; created_at?: string };
        Update: { overall_score?: number | null; result_json?: Record<string, unknown> };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_file_chunks: {
        Args: { query_embedding: number[]; match_count: number; match_threshold: number };
        Returns: { id: string; file_id: string; content: string; chunk_index: number; token_count: number; similarity: number }[];
      };
      match_document_embeddings: {
        Args: { query_embedding: number[]; match_count: number; match_threshold: number };
        Returns: { document_id: string; similarity: number }[];
      };
      match_law_chunks: {
        Args: { query_embedding: number[]; match_count: number; filter_category?: string | null };
        Returns: { id: string; law_name: string; article_no: string; clause_no: string | null; content: string; category: string; similarity: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
