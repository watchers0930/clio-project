'use client';

import { useState, useRef, useEffect } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface LockGateProps {
  onUnlocked: () => void;
}

export function LockGate({ onUnlocked }: LockGateProps) {
  const [mode, setMode] = useState<'loading' | 'setup' | 'verify'>('loading');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/account-credentials/lock')
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => {
        setMode(d.enabled ? 'verify' : 'setup');
      })
      .catch(() => setMode('verify'));
  }, []);

  useEffect(() => {
    if (mode !== 'loading') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [mode]);

  const handleSetup = async () => {
    if (!password.trim()) return;
    if (password.length < 4) { setError('비밀번호는 4자 이상이어야 합니다.'); return; }
    if (password !== confirmPw) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/account-credentials/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        onUnlocked();
      } else {
        setError(data.error ?? '오류가 발생했습니다.');
      }
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/account-credentials/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json() as { valid: boolean };
      if (data.valid) {
        onUnlocked();
      } else {
        setError('비밀번호가 올바르지 않습니다.');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    );
  }

  const isSetup = mode === 'setup';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex flex-col items-center gap-3 px-8 pb-6 pt-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-tint text-primary">
            <Lock size={26} strokeWidth={1.5} />
          </div>
          <h2 className="text-[18px] font-bold text-foreground">계정관리</h2>
          <p className="text-center text-[13px] text-foreground-secondary">
            {isSetup
              ? '처음 사용하시는군요! 계정관리 접근 비밀번호를 설정해주세요.'
              : '비밀번호를 입력하면 이번 탭에서는 잠금이 해제됩니다.'}
          </p>
        </div>

        <div className="flex flex-col gap-3 px-8 pb-8">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && void (isSetup ? handleSetup() : handleVerify())}
              placeholder={isSetup ? '새 비밀번호 (4자 이상)' : '비밀번호 입력'}
              className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-3 pr-10 text-[14px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-secondary"
            >
              {showPw ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
            </button>
          </div>

          {isSetup && (
            <input
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={(e) => { setConfirmPw(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && void handleSetup()}
              placeholder="비밀번호 확인"
              className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-3 text-[14px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}

          {error && <p className="text-[12px] font-medium text-red-500">{error}</p>}

          <button
            onClick={() => void (isSetup ? handleSetup() : handleVerify())}
            disabled={loading || !password.trim()}
            className="h-11 w-full rounded-xl bg-primary text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-40"
          >
            {loading ? '처리 중...' : isSetup ? '비밀번호 설정' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
