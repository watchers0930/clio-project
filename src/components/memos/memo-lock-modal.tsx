'use client';

import { useState, useRef, useEffect } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface Props {
  onUnlock: () => void;
}

export function MemoLockModal({ onUnlock }: Props) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/settings/memo-lock/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.valid) {
        onUnlock();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex flex-col items-center gap-3 px-8 pb-6 pt-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-tint text-primary">
            <Lock size={26} />
          </div>
          <h2 className="text-[18px] font-bold text-foreground">메모 잠금</h2>
          <p className="text-center text-[13px] text-foreground-secondary">비밀번호를 입력하면 이번 탭에서는 잠금이 해제됩니다.</p>
        </div>

        <div className="flex flex-col gap-3 px-8 pb-8">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="비밀번호 입력"
              className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-3 pr-10 text-[14px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-secondary">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <p className="text-[12px] font-medium text-red-500">{error}</p>}

          <button
            onClick={() => void submit()}
            disabled={loading || !password.trim()}
            className="h-11 w-full rounded-xl bg-primary text-[14px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-40"
          >
            {loading ? '확인 중...' : '잠금 해제'}
          </button>
        </div>
      </div>
    </div>
  );
}
