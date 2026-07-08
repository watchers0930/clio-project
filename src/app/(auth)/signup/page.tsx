'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { PLATFORM_LABEL } from '@/lib/constants/ui';

export default function SignupPage() {
  const router = useRouter();
  const { signup, isLoading, error: storeError, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [localError, setLocalError] = useState('');

  const error = localError || storeError || '';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (password !== passwordConfirm) {
      setLocalError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 6) {
      setLocalError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    try {
      const success = await signup(email, password, name);
      if (success) {
        router.push('/dashboard');
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
        </div>

        {/* Signup Card */}
        <div className="rounded-2xl border border-border bg-white px-8 py-10 shadow-sm">
          <h2 className="text-[22px] font-semibold text-foreground">
            회원가입
          </h2>
          <p className="mt-2 mb-7 text-[13px] leading-relaxed text-foreground-secondary">
            계정을 만들면 AI 문서관리 플랫폼을 바로 사용할 수 있습니다.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Name */}
            <div>
              <label className="mb-2.5 block text-[14px] font-medium text-foreground-secondary">
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setLocalError(''); }}
                placeholder="홍길동"
                className="h-[52px] w-full rounded-xl border border-border bg-surface-secondary px-4.5 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="mb-2.5 block text-[14px] font-medium text-foreground-secondary">
                이메일 (아이디)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setLocalError(''); }}
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
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLocalError(''); }}
                  placeholder="6자 이상 입력하세요"
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

            {/* Password Confirm */}
            <div>
              <label className="mb-2.5 block text-[14px] font-medium text-foreground-secondary">
                비밀번호 확인
              </label>
              <div className="relative">
                <input
                  type={showPasswordConfirm ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => { setPasswordConfirm(e.target.value); setLocalError(''); }}
                  placeholder="비밀번호를 다시 입력하세요"
                  className="h-[52px] w-full rounded-xl border border-border bg-surface-secondary px-4.5 pr-12 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0 text-foreground-secondary transition-colors hover:text-foreground"
                >
                  {showPasswordConfirm ? <EyeOff size={17} strokeWidth={1.5} /> : <Eye size={17} strokeWidth={1.5} />}
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
              {isLoading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-5 text-center">
            <span className="text-[14px] text-foreground-secondary">이미 계정이 있으신가요?&nbsp;</span>
            <Link href="/login" className="text-[14px] font-medium text-primary hover:underline">
              로그인
            </Link>
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
