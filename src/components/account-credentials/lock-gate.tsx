'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface LockGateProps {
  onUnlocked: () => void;
}

export function LockGate({ onUnlocked }: LockGateProps) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    if (!password) return;
    setVerifying(true);
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
        toast.error('비밀번호가 올바르지 않습니다.');
        setPassword('');
      }
    } catch {
      toast.error('오류가 발생했습니다.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-tint text-primary">
            <Lock size={22} strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h2 className="text-[16px] font-semibold text-foreground">계정관리</h2>
            <p className="mt-1 text-[13px] text-foreground-secondary">
              접근을 위해 로그인 비밀번호를 입력해주세요.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void verify()}
              placeholder="비밀번호"
              autoFocus
              className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-2.5 pr-10 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-secondary hover:text-foreground"
            >
              {showPw ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
            </button>
          </div>

          <button
            onClick={void verify}
            disabled={verifying || !password}
            className="w-full rounded-xl bg-primary py-2.5 text-[13px] font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {verifying ? '확인 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
