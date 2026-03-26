import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/lib/supabase/types';
import { apiClient } from '@/lib/api-client';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  clearError: () => void;
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

      logout: () => {
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
    }),
    {
      name: 'clio-auth',
      partialize: (state) => ({ token: state.token }),
    },
  ),
);
