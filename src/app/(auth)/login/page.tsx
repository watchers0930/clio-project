'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

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
        router.push('/dashboard');
      }
    } catch {
      setLocalError('서버에 연결할 수 없습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-en text-[28px] font-extrabold tracking-widest text-[#1d1d1f] select-none">
            CLIO
          </h1>
          <p className="mt-2 text-[13px] text-[#6e6e73]">
            AI 문서관리 시스템
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-[#e5e5e7] p-8 shadow-sm">
          <h2 className="text-[18px] font-semibold text-[#1d1d1f] mb-6">
            로그인
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] mb-1.5">
                이메일
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  strokeWidth={1.5}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6e6e73]"
                />
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-10 pl-10 pr-4 text-[13px] font-en bg-[#f5f5f7] border border-[#e5e5e7] rounded-lg focus:outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] placeholder:text-[#6e6e73]/50 text-[#1d1d1f]"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  strokeWidth={1.5}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6e6e73]"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full h-10 pl-10 pr-10 text-[13px] bg-[#f5f5f7] border border-[#e5e5e7] rounded-lg focus:outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] placeholder:text-[#6e6e73]/50 text-[#1d1d1f]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
                >
                  {showPassword ? (
                    <EyeOff size={16} strokeWidth={1.5} />
                  ) : (
                    <Eye size={16} strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[12px] text-[#ff3b30]">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-[#1d1d1f] hover:bg-[#0071e3] text-white text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  로그인 중...
                </span>
              ) : (
                '로그인'
              )}
            </button>
          </form>

          {/* Forgot password */}
          <div className="mt-4 text-center">
            <button className="text-[12px] text-[#6e6e73] hover:text-[#0071e3] transition-colors">
              비밀번호를 잊으셨나요?
            </button>
          </div>

          {/* Demo hint */}
          <div className="mt-6 p-3 bg-[#f5f5f7] rounded-lg border border-[#e5e5e7]">
            <p className="text-[11px] text-[#6e6e73] text-center">
              데모 계정: <span className="font-en font-medium text-[#1d1d1f]">admin@clio.kr</span> / <span className="font-medium text-[#1d1d1f]">password</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] text-[#6e6e73] font-en">
          &copy; 2026 CLIO. All rights reserved.
        </p>
      </div>
    </div>
  );
}
