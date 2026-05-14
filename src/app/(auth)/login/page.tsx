'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import {
  PLATFORM_LABEL,
} from '@/lib/constants/ui';

const INPUT_BASE: React.CSSProperties = {
  width: '100%',
  padding: '0 18px',
  backgroundColor: '#f5f5f7',
  border: '1px solid #e5e5e7',
  color: '#1d1d1f',
  outline: 'none',
  fontFamily: 'Verdana, sans-serif',
};

// 모바일 감지는 CSS media query 대신 window.innerWidth 기반
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return mobile;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading: storeLoading, error: storeError, clearError } = useAuthStore();
  const isMobile = useIsMobile();
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

  const inputStyle: React.CSSProperties = {
    ...INPUT_BASE,
    height: 52,
    fontSize: 15,
    borderRadius: 12,
    padding: '0 18px',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 16 : 20 }}>
      <div style={{ width: isMobile ? '100%' : '100%', maxWidth: 740 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 28 : 36 }}>
          <h1 style={{ fontSize: isMobile ? 36 : 44, fontWeight: 300, letterSpacing: isMobile ? '0.24em' : '0.3em', fontFamily: '"Times New Roman", Times, serif', color: '#1d1d1f' }}>
            CLIO
          </h1>
          <p style={{ marginTop: 12, fontSize: 15, color: '#6e6e73' }}>
            {PLATFORM_LABEL}
          </p>
          <p style={{ marginTop: 10, fontSize: 13, color: '#8e8e93', lineHeight: '20px', maxWidth: 520, marginInline: 'auto' }}>
            CLIO는 기업 문서를 한곳에 저장한 뒤, 공유하고, 코멘트를 반영하고,
            {!isMobile && <br />}
            다시 검색해 재활용하는 문서 운영 플랫폼입니다.
          </p>
        </div>

        {/* Login Card */}
        <div style={{ backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e5e5e7', padding: isMobile ? '28px 18px' : '56px 144px' }}>

          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: isMobile ? 28 : 36, color: '#1d1d1f' }}>
            로그인
          </h2>
          <p style={{ marginTop: -18, marginBottom: 28, fontSize: 13, color: '#6e6e73', lineHeight: 1.7 }}>
            로그인 후 첫 진입점은 문서허브이며, 저장한 문서를 기준으로 공유, 검색, 생성 흐름을 이어갈 수 있습니다.
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>
                이메일
              </label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                style={inputStyle}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>
                비밀번호
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  style={{ ...inputStyle, paddingRight: 48 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6e6e73', padding: 0 }}
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
              className="hover:bg-[#0071e3] transition-colors"
              style={{ width: '100%', height: 54, fontSize: 16, fontWeight: 600, borderRadius: 12, marginTop: 8, backgroundColor: '#1d1d1f', color: '#fff', border: 'none', cursor: 'pointer', opacity: isLoading ? 0.5 : 1 }}
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* Forgot */}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button
              className="hover:text-[#0071e3] transition-colors"
              style={{ fontSize: 14, color: '#6e6e73', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>
        </div>

        {/* Demo hint */}
        <div style={{ marginTop: 16, padding: '14px 20px', backgroundColor: '#fff', border: '1px solid #e5e5e7', borderRadius: 12, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#6e6e73' }}>
            테스트 계정이 필요한 경우 관리자에게 발급을 요청하세요.
          </p>
        </div>

        {/* Footer */}
        <p style={{ marginTop: 32, fontSize: 11, color: '#6e6e73', textAlign: 'center', fontFamily: 'Verdana, sans-serif' }}>
          &copy; 2026 CLIO. All rights reserved.
        </p>
      </div>
    </div>
  );
}
