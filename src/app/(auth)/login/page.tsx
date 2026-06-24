'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { PLATFORM_LABEL } from '@/lib/constants/ui';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading: storeLoading, error: storeError, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const error = localError || storeError || '';
  const isLoading = storeLoading;

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    const formData = new FormData(e.currentTarget);
    const emailVal = (formData.get('email') as string) || email;
    const passwordVal = (formData.get('password') as string) || password;

    try {
      const success = await login(emailVal, passwordVal);
      if (success) {
        let redirectTo = '/';
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const redirectPath = params.get('redirect') || '/';
          params.delete('redirect');
          const rest = params.toString();
          redirectTo = rest ? `${redirectPath}?${rest}` : redirectPath;
        }
        router.push(redirectTo);
      }
    } catch {
      setLocalError('서버에 연결할 수 없습니다.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-page-bg p-4 md:p-5">
      <div className="w-full max-w-[500px]">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center md:mb-10">
          <h1 className="text-[36px] font-light tracking-[0.24em] text-foreground md:text-[44px] md:tracking-[0.3em] font-serif">
            CLIO
          </h1>
          <p className="mt-3 text-[15px] text-foreground-secondary">
            {PLATFORM_LABEL}
          </p>
          <p className="mt-2.5 mb-5 text-[13px] leading-5 text-foreground-tertiary">
            CLIO는 기업 문서를 한곳에 저장한 뒤, 공유하고, 코멘트를 반영하고,{' '}
            <br className="hidden md:block" />
            다시 검색해 재활용하는 문서 운영 플랫폼입니다.
          </p>
        </div>

        <div className="h-5" aria-hidden="true" />

        {/* Login Card */}
        <div className="rounded-2xl border border-border bg-white px-8 py-10 shadow-sm">
          <h2 className="text-[22px] font-semibold text-foreground">
            로그인
          </h2>
          <p className="mt-2 mb-7 text-[13px] leading-relaxed text-foreground-secondary">
            로그인 후 첫 진입점은 문서허브이며, 저장한 문서를 기준으로 공유, 검색, 생성 흐름을 이어갈 수 있습니다.
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            {/* Email */}
            <div>
              <label className="mb-2.5 block text-[14px] font-medium text-foreground-secondary">
                이메일
              </label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="h-[52px] w-full rounded-xl border border-border bg-surface-secondary px-4.5 text-[15px] text-foreground font-en outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-2.5 block text-[14px] font-medium text-foreground-secondary">
                비밀번호
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="h-[52px] w-full rounded-xl border border-border bg-surface-secondary px-4.5 pr-12 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0 text-foreground-secondary transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={17} strokeWidth={1.5} /> : <Eye size={17} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[13px] text-danger">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 h-[54px] w-full rounded-xl bg-foreground text-[16px] font-semibold text-white shadow-md transition-all hover:bg-primary disabled:opacity-50"
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* Forgot */}
          <div className="mt-5 text-center">
            <button className="text-[14px] text-foreground-secondary transition-colors hover:text-primary">
              비밀번호를 잊으셨나요?
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] text-foreground-secondary font-num">
          &copy; 2026 CLIO. All rights reserved.
        </p>
      </div>
    </div>
  );
}
