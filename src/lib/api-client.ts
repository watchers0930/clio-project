import type {
  ApiResponse,
  PaginatedResponse,
  User,
  FileRecord,
  Template,
  Document,
  SearchResult,
  DashboardStats,
  LoginResponse,
} from './supabase/types';

// =============================================================================
// CLIO API Client
// =============================================================================

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
      });

      const data = await res.json();
      return data as ApiResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API 요청 중 오류가 발생했습니다.',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  async login(email: string, password: string) {
    return this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe() {
    return this.request<User>('/api/auth/me');
  }

  // ---------------------------------------------------------------------------
  // Files
  // ---------------------------------------------------------------------------

  async getFiles(params?: { page?: number; limit?: number; department_id?: string; status?: string; q?: string }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.department_id) qs.set('department_id', params.department_id);
    if (params?.status) qs.set('status', params.status);
    if (params?.q) qs.set('q', params.q);
    const query = qs.toString();
    return this.request<FileRecord[]>(`/api/files${query ? `?${query}` : ''}`) as Promise<PaginatedResponse<FileRecord>>;
  }

  async getFile(id: string) {
    return this.request<FileRecord & { uploader_name?: string; department_name?: string }>(`/api/files/${id}`);
  }

  async uploadFile(data: { name: string; original_name: string; mime_type: string; size: number; department_id: string; user_id?: string }) {
    return this.request<FileRecord>('/api/files', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteFile(id: string) {
    return this.request<{ id: string }>(`/api/files/${id}`, { method: 'DELETE' });
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(query: string, options?: { department_id?: string; limit?: number }) {
    return this.request<{ results: SearchResult[]; query: string; total: number }>('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...options }),
    });
  }

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------

  async getDocuments(params?: { page?: number; limit?: number; status?: string; user_id?: string }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    if (params?.user_id) qs.set('user_id', params.user_id);
    const query = qs.toString();
    return this.request<Document[]>(`/api/documents${query ? `?${query}` : ''}`) as Promise<PaginatedResponse<Document>>;
  }

  async getDocument(id: string) {
    return this.request<Document & { author_name?: string; template_name?: string }>(`/api/documents/${id}`);
  }

  async generateDocument(data: { template_id: string; title: string; content?: string; source_file_ids?: string[]; user_id?: string }) {
    return this.request<Document>('/api/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  async getTemplates(params?: { page?: number; limit?: number; department_id?: string; type?: string }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.department_id) qs.set('department_id', params.department_id);
    if (params?.type) qs.set('type', params.type);
    const query = qs.toString();
    return this.request<Template[]>(`/api/templates${query ? `?${query}` : ''}`) as Promise<PaginatedResponse<Template>>;
  }

  async getTemplate(id: string) {
    return this.request<Template & { department_name?: string }>(`/api/templates/${id}`);
  }

  async createTemplate(data: { name: string; description?: string; department_id: string; type: 'department' | 'company'; content?: object }) {
    return this.request<Template>('/api/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTemplate(id: string, data: Partial<Pick<Template, 'name' | 'description' | 'content' | 'is_active'>>) {
    return this.request<Template>(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  async getDashboardStats() {
    return this.request<DashboardStats>('/api/dashboard/stats');
  }
}

export const apiClient = new ApiClient();
export default ApiClient;
