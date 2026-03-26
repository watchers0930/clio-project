import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/lib/supabase/types';
import { apiClient } from '@/lib/api-client';
import { createClient } from '@/lib/supabase/client';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string, departmentId?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
  initAuthListener: () => () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });

        const res = await apiClient.login(email, password);

        if (res.success && res.data) {
          const { token, user } = res.data;
          apiClient.setToken(token);
          set({ user, token, isLoading: false });
          return true;
        }

        set({ isLoading: false, error: res.error ?? '로그인에 실패했습니다.' });
        return false;
      },

      signup: async (email, password, name, departmentId) => {
        set({ isLoading: true, error: null });

        try {
          const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, department_id: departmentId }),
          });
          const data = await res.json();

          if (data.success && data.data) {
            const { token, user } = data.data;
            apiClient.setToken(token);
            set({ user, token, isLoading: false });
            return true;
          }

          set({ isLoading: false, error: data.error ?? '회원가입에 실패했습니다.' });
          return false;
        } catch {
          set({ isLoading: false, error: '서버에 연결할 수 없습니다.' });
          return false;
        }
      },

      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
          // Ignore network errors on logout
        }

        // Also sign out from Supabase client (clears browser cookies)
        const supabase = createClient();
        if (supabase) {
          await supabase.auth.signOut();
        }

        apiClient.setToken(null);
        set({ user: null, token: null, error: null });
      },

      fetchMe: async () => {
        const { token } = get();
        if (!token) return;

        apiClient.setToken(token);
        set({ isLoading: true });

        const res = await apiClient.getMe();

        if (res.success && res.data) {
          set({ user: res.data, isLoading: false });
        } else {
          // Token expired or invalid
          set({ user: null, token: null, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),

      /**
       * Subscribe to Supabase auth state changes.
       * Returns an unsubscribe function. No-op when Supabase is not configured.
       */
      initAuthListener: () => {
        const supabase = createClient();
        if (!supabase) return () => {};

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            const token = session.access_token;
            apiClient.setToken(token);
            set({ token });
            // Refresh profile from API
            get().fetchMe();
          } else {
            apiClient.setToken(null);
            set({ user: null, token: null });
          }
        });

        return () => subscription.unsubscribe();
      },
    }),
    {
      name: 'clio-auth',
      partialize: (state) => ({ token: state.token }),
    },
  ),
);
