'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
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
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center" style={{ padding: 20 }}>
      <div className="w-full" style={{ maxWidth: 740 }}>
        {/* Logo */}
        <div className="text-center" style={{ marginBottom: 36 }}>
          <h1
            className="text-[#1d1d1f] select-none"
            style={{ fontSize: 44, fontWeight: 300, letterSpacing: '0.3em', fontFamily: '"Times New Roman", Times, serif' }}
          >
            CLIO
          </h1>
          <p className="text-[#6e6e73]" style={{ marginTop: 12, fontSize: 15 }}>
            AI 문서관리 시스템
          </p>
        </div>

        {/* Login Card */}
        <div
          className="bg-white rounded-2xl border border-[#e5e5e7]"
          style={{ padding: '56px 144px' }}
        >
          <h2
            className="text-[#1d1d1f]"
            style={{ fontSize: 22, fontWeight: 600, marginBottom: 36 }}
          >
            로그인
          </h2>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Email */}
            <div>
              <label
                className="block text-[#6e6e73]"
                style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}
              >
                이메일
              </label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-[#f5f5f7] border border-[#e5e5e7] text-[#1d1d1f] placeholder:text-[#6e6e73]/40 focus:outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]"
                style={{ height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, fontFamily: 'Verdana, sans-serif' }}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label
                className="block text-[#6e6e73]"
                style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}
              >
                비밀번호
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full bg-[#f5f5f7] border border-[#e5e5e7] text-[#1d1d1f] placeholder:text-[#6e6e73]/40 focus:outline-none focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]"
                  style={{ height: 52, padding: '0 48px 0 18px', fontSize: 15, borderRadius: 12 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 -translate-y-1/2 text-[#6e6e73] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                  style={{ right: 14 }}
                >
                  {showPassword ? <EyeOff size={17} strokeWidth={1.5} /> : <Eye size={17} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p style={{ fontSize: 13, color: '#ff3b30' }}>{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1d1d1f] hover:bg-[#0071e3] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ height: 54, fontSize: 16, fontWeight: 600, borderRadius: 12, marginTop: 8 }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center" style={{ gap: 8 }}>
                  <svg className="animate-spin" style={{ width: 16, height: 16 }} viewBox="0 0 24 24">
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

          {/* Forgot */}
          <div className="text-center" style={{ marginTop: 20 }}>
            <button className="text-[#6e6e73] hover:text-[#0071e3] transition-colors cursor-pointer" style={{ fontSize: 14 }}>
              비밀번호를 잊으셨나요?
            </button>
          </div>
        </div>

        {/* Demo hint */}
        <div
          className="bg-white border border-[#e5e5e7] rounded-xl text-center"
          style={{ marginTop: 16, padding: '14px 20px' }}
        >
          <p className="text-[#6e6e73]" style={{ fontSize: 12 }}>
            데모 계정: <span className="text-[#1d1d1f]" style={{ fontWeight: 600, fontFamily: 'Verdana, sans-serif' }}>admin@clio.kr</span>
            {' / '}
            <span className="text-[#1d1d1f]" style={{ fontWeight: 600 }}>password</span>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-[#6e6e73]" style={{ marginTop: 32, fontSize: 11, fontFamily: 'Verdana, sans-serif' }}>
          &copy; 2026 CLIO. All rights reserved.
        </p>
      </div>
    </div>
  );
}
