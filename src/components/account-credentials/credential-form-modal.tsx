'use client';

import { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';

export interface CredentialRow {
  id: string;
  site_name: string;
  site_url: string;
  username: string;
  password: string;
  created_at: string;
}

interface Props {
  open: boolean;
  editing: CredentialRow | null;
  onClose: () => void;
  onSaved: (row: CredentialRow) => void;
}

export function CredentialFormModal({ open, editing, onClose, onSaved }: Props) {
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setSiteName(editing?.site_name ?? '');
      setSiteUrl(editing?.site_url ?? '');
      setUsername(editing?.username ?? '');
      setPassword(editing?.password ?? '');
      setShowPw(false);
      setError('');
    }
  }, [open, editing]);

  if (!open) return null;

  const save = async () => {
    if (!siteName.trim() || !username.trim() || !password.trim()) {
      setError('사이트명, 아이디, 비밀번호는 필수 항목입니다.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const isEdit = !!editing;
      const url = isEdit
        ? `/api/account-credentials/${editing!.id}`
        : '/api/account-credentials';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_name: siteName, site_url: siteUrl, username, password }),
      });
      const json = await res.json() as { data?: CredentialRow; error?: string; success?: boolean };
      if (!res.ok) { setError(json.error ?? '저장에 실패했습니다.'); return; }

      const saved: CredentialRow = isEdit
        ? { ...editing!, site_name: siteName, site_url: siteUrl, username, password }
        : (json.data as CredentialRow);
      onSaved(saved);
      onClose();
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-[15px] font-semibold text-foreground">
            {editing ? '계정 수정' : '계정 추가'}
          </h3>
          <button onClick={onClose} className="text-foreground-secondary hover:text-foreground">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-foreground-secondary">사이트명</label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="예) 네이버, 구글, 사내시스템"
              className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-foreground-secondary">
              사이트 주소 <span className="text-foreground-quaternary font-normal">(선택)</span>
            </label>
            <input
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-foreground-secondary">아이디</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디 또는 이메일"
              className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-2.5 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-foreground-secondary">비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
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
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="h-9 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground-secondary hover:bg-surface-secondary"
          >
            취소
          </button>
          <button
            onClick={() => { void save(); }}
            disabled={saving}
            className="h-9 rounded-xl bg-primary px-5 text-[13px] font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
