'use client';

import { useEffect, useState } from 'react';
import { Lock, LockOpen, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export function MemoLockSection() {
  const toast = useToast();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 비밀번호 설정 폼
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState<'idle' | 'set' | 'change' | 'remove'>('idle');

  useEffect(() => {
    fetch('/api/settings/memo-lock')
      .then((r) => r.json())
      .then((d) => setEnabled(d.enabled ?? false))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (mode === 'remove') {
      if (!currentPw) { toast.error('현재 비밀번호를 입력해주세요.'); return; }
      setSaving(true);
      // 현재 비밀번호 검증
      const verifyRes = await fetch('/api/settings/memo-lock/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: currentPw }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.valid) {
        toast.error('비밀번호가 올바르지 않습니다.');
        setSaving(false);
        return;
      }
      const res = await fetch('/api/settings/memo-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: null }),
      });
      const data = await res.json();
      if (data.success) {
        setEnabled(false);
        setMode('idle');
        setCurrentPw('');
        toast.success('메모 잠금이 해제되었습니다.');
      } else {
        toast.error(data.error ?? '오류가 발생했습니다.');
      }
      setSaving(false);
      return;
    }

    if (newPw.length < 4) { toast.error('비밀번호는 4자 이상이어야 합니다.'); return; }
    if (newPw !== confirmPw) { toast.error('비밀번호가 일치하지 않습니다.'); return; }

    setSaving(true);
    const res = await fetch('/api/settings/memo-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPw }),
    });
    const data = await res.json();
    if (data.success) {
      setEnabled(true);
      setMode('idle');
      setNewPw('');
      setConfirmPw('');
      toast.success('메모 잠금 비밀번호가 설정되었습니다.');
    } else {
      toast.error(data.error ?? '오류가 발생했습니다.');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
          {enabled ? <Lock size={20} /> : <LockOpen size={20} />}
        </div>
        <div className="flex-1">
          <h2 className="text-[16px] font-semibold text-foreground">메모 잠금</h2>
          <p className="mt-1 text-[13px] text-foreground-secondary">
            메모 페이지 접근 시 별도 비밀번호를 요구합니다. 탭을 닫으면 다시 잠깁니다.
          </p>

          {mode === 'idle' && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold ${enabled ? 'bg-green-50 text-green-700' : 'bg-surface-secondary text-foreground-secondary'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-green-500' : 'bg-foreground-quaternary'}`} />
                {enabled ? '잠금 활성' : '잠금 비활성'}
              </span>
              {!enabled ? (
                <button onClick={() => setMode('set')} className="h-9 rounded-xl bg-primary px-4 text-[13px] font-medium text-white hover:bg-primary-dark">
                  잠금 설정
                </button>
              ) : (
                <>
                  <button onClick={() => setMode('change')} className="h-9 rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground hover:bg-surface-secondary">
                    비밀번호 변경
                  </button>
                  <button onClick={() => setMode('remove')} className="h-9 rounded-xl border border-red-200 bg-white px-4 text-[13px] font-medium text-red-600 hover:bg-red-50">
                    잠금 해제
                  </button>
                </>
              )}
            </div>
          )}

          {(mode === 'set' || mode === 'change') && (
            <div className="mt-5 flex flex-col gap-3 max-w-sm">
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="새 비밀번호 (4자 이상)"
                  className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-2.5 pr-10 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-secondary">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="비밀번호 확인"
                className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button onClick={save} disabled={saving} className="h-9 rounded-xl bg-primary px-4 text-[13px] font-medium text-white hover:bg-primary-dark disabled:opacity-50">
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => { setMode('idle'); setNewPw(''); setConfirmPw(''); }} className="h-9 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground-secondary hover:bg-surface-secondary">
                  취소
                </button>
              </div>
            </div>
          )}

          {mode === 'remove' && (
            <div className="mt-5 flex flex-col gap-3 max-w-sm">
              <p className="text-[13px] text-foreground-secondary">잠금 해제를 위해 현재 비밀번호를 입력해주세요.</p>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void save()}
                  placeholder="현재 비밀번호"
                  className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-2.5 pr-10 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-secondary">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={save} disabled={saving} className="h-9 rounded-xl bg-red-500 px-4 text-[13px] font-medium text-white hover:bg-red-600 disabled:opacity-50">
                  {saving ? '확인 중...' : '잠금 해제'}
                </button>
                <button onClick={() => { setMode('idle'); setCurrentPw(''); }} className="h-9 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground-secondary hover:bg-surface-secondary">
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
