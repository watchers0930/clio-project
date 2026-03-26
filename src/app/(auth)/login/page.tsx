'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const emailVal = (formData.get('email') as string) || email;
    const passwordVal = (formData.get('password') as string) || password;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, password: passwordVal }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('clio_token', data.data.token);
        localStorage.setItem('clio_user', JSON.stringify(data.data.user));
        window.location.href = '/';
      } else {
        setError(data.error || '로그인에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px]">
      {/* Logo */}
      <div className="text-center mb-10">
        <h1 className="font-en text-[28px] font-extrabold tracking-wordmark text-navy select-none">
          CLIO
        </h1>
        <p className="mt-2 text-[13px] text-clio-text-secondary">
          AI 문서관리 시스템
        </p>
      </div>

      {/* Login Card */}
      <div className="bg-white rounded-xl border border-clio-border p-8 shadow-sm">
        <h2 className="text-[18px] font-semibold text-navy mb-6">
          로그인
        </h2>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-[12px] font-medium text-clio-text-secondary mb-1.5">
              이메일
            </label>
            <div className="relative">
              <Mail
                size={16}
                strokeWidth={1.5}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-clio-text-secondary"
              />
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full h-10 pl-10 pr-4 text-[13px] font-en bg-clio-bg border border-clio-border rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-clio-text-secondary/50"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[12px] font-medium text-clio-text-secondary mb-1.5">
              비밀번호
            </label>
            <div className="relative">
              <Lock
                size={16}
                strokeWidth={1.5}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-clio-text-secondary"
              />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full h-10 pl-10 pr-10 text-[13px] bg-clio-bg border border-clio-border rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-clio-text-secondary/50"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-clio-text-secondary hover:text-navy transition-colors"
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
            <p className="text-[12px] text-red-500">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 bg-navy hover:bg-navy-light text-white text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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
          <button className="text-[12px] text-clio-text-secondary hover:text-accent transition-colors">
            비밀번호를 잊으셨나요?
          </button>
        </div>

        {/* Demo hint */}
        <div className="mt-6 p-3 bg-clio-bg rounded-lg border border-clio-border">
          <p className="text-[11px] text-clio-text-secondary text-center">
            데모 계정: <span className="font-en font-medium text-navy">admin@clio.kr</span> / <span className="font-medium text-navy">password</span>
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-[11px] text-clio-text-secondary font-en">
        © 2026 CLIO. All rights reserved.
      </p>
    </div>
  );
}
