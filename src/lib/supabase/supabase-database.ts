import type { DbAttendanceRecord, DbLeaveRequest, DbDepartment, DbUser, DbFileRecord, DbGoogleConnection, DbTemplate, DbDocument, DbChannel, DbChannelMember, DbMessage, DbAuditLog, DbEvent, DbTodo, DbMemo, DbFileChunk, DbWorkLog, DbWorkLogAttachment, DbDocumentComment, DbDocumentPermission, DbApproval, DbSchedule, DbSharedLink, DbFilePermission, DbFileShare, DbTodoExtraction, DbAutofillSession, DbContractRiskAnalysis, DbContractClauseFix, DbLawChunk, DbDocumentEmbedding, DbDocumentQualityCheck } from './supabase-db-types';

export interface Database {
  public: {
    Tables: {
      attendance_records: { Row: DbAttendanceRecord; Insert: Partial<DbAttendanceRecord>; Update: Partial<DbAttendanceRecord>; Relationships: [] };
      leave_requests: { Row: DbLeaveRequest; Insert: Partial<DbLeaveRequest>; Update: Partial<DbLeaveRequest>; Relationships: [] };
      leave_calendar: { Row: Record<string, unknown> & { day: string; label: string }; Insert: { day: string; label: string }; Update: { label?: string }; Relationships: [] };

      departments: {
        Row: DbDepartment;
        Insert: { id?: string; name: string; code: string; created_at?: string };
        Update: { name?: string; code?: string };
        Relationships: [];
      };
      users: {
        Row: DbUser;
        Insert: { id: string; email: string; name: string; position?: string; department_id?: string | null; role?: string; avatar_url?: string | null; is_active?: boolean; hire_date?: string | null; signature_path?: string | null; sidebar_menus?: string[] | null; manager_user_id?: string | null; rank_level?: number | null; rank_title?: string | null; created_at?: string };
        Update: { email?: string; name?: string; position?: string; department_id?: string | null; role?: string; avatar_url?: string | null; is_active?: boolean; hire_date?: string | null; signature_path?: string | null; sidebar_menus?: string[] | null; manager_user_id?: string | null; rank_level?: number | null; rank_title?: string | null };
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
        Insert: { id?: string; user_id: string; email: string; access_token: string; refresh_token: string; token_expiry?: string | null; last_synced_at?: string | null; sync_enabled?: boolean; scope?: string | null; created_at?: string; updated_at?: string };
        Update: { email?: string; access_token?: string; refresh_token?: string; token_expiry?: string | null; last_synced_at?: string | null; sync_enabled?: boolean; scope?: string | null; updated_at?: string };
        Relationships: [];
      };
      gmail_auto_delete_rules: {
        Row: {
          id: string;
          user_id: string;
          pattern: string;
          enabled: boolean;
          last_run_at: string | null;
          total_trashed: number;
          created_at: string;
          updated_at: string;
        };
        Insert: { id?: string; user_id: string; pattern: string; enabled?: boolean; last_run_at?: string | null; total_trashed?: number; created_at?: string; updated_at?: string };
        Update: { pattern?: string; enabled?: boolean; last_run_at?: string | null; total_trashed?: number; updated_at?: string };
        Relationships: [];
      };
      approval_requests: {
        Row: {
          id: string;
          document_id: string;
          requester_id: string;
          status: string;
          current_step: number;
          created_at: string;
          completed_at: string | null;
        };
        Insert: { id?: string; document_id: string; requester_id: string; status?: string; current_step?: number; created_at?: string; completed_at?: string | null };
        Update: { status?: string; current_step?: number; completed_at?: string | null };
        Relationships: [];
      };
      approval_steps: {
        Row: {
          id: string;
          request_id: string;
          step_order: number;
          approver_id: string;
          rank_title: string | null;
          status: string;
          signature_path: string | null;
          comment: string | null;
          decided_at: string | null;
          created_at: string;
        };
        Insert: { id?: string; request_id: string; step_order: number; approver_id: string; rank_title?: string | null; status?: string; signature_path?: string | null; comment?: string | null; decided_at?: string | null; created_at?: string };
        Update: { status?: string; signature_path?: string | null; comment?: string | null; decided_at?: string | null; rank_title?: string | null };
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
        Insert: { id?: string; name: string; description?: string | null; department_id?: string | null; scope?: string; icon?: string | null; content?: string | null; placeholders?: unknown; created_by?: string | null; approval_depth?: number | null; created_at?: string; updated_at?: string };
        Update: { name?: string; description?: string | null; department_id?: string | null; scope?: string; icon?: string | null; content?: string | null; placeholders?: unknown; created_by?: string | null; approval_depth?: number | null; updated_at?: string };
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
      leave_submit: { Args: { p_user: string; p_document: string; p_line: Record<string, unknown>[] }; Returns: Record<string, unknown> };
      leave_decide: { Args: { p_actor: string; p_request: string; p_action: string; p_comment: string }; Returns: Record<string, unknown> };
      attendance_heartbeat: { Args: { p_user: string }; Returns: DbAttendanceRecord };
      attendance_correct: { Args: { p_user: string; p_date: string; p_body: Record<string, unknown> }; Returns: DbAttendanceRecord };
      leave_write: { Args: { p_user: string; p_id: string | null; p_body: Record<string, unknown> }; Returns: DbLeaveRequest };
      leave_balance: { Args: { p_user: string; p_asof: string }; Returns: Record<string, unknown> };

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
