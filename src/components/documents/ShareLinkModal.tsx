'use client';

import { useState } from 'react';

interface ShareLinkModalProps {
  docId: string;
  docTitle: string;
  onClose: () => void;
}

export function ShareLinkModal({ docId, docTitle, onClose }: ShareLinkModalProps) {
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createLink = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType: 'document',
          resourceId: docId,
          title: docTitle,
          expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(`${window.location.origin}${data.url}`);
      } else {
        alert(data.error ?? '링크 생성 실패');
      }
    } catch {
      alert('링크 생성 중 오류가 발생했습니다.');
    }
    setCreating(false);
  };

  const copyLink = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl border border-[#e5e5e7] shadow-xl w-full max-w-md p-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">외부 공유 링크 생성</h2>
            <p className="text-xs text-[#6e6e73] mt-0.5 truncate max-w-xs">{docTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="block text-sm font-medium text-[#6e6e73] mb-2">만료 기간</label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
              >
                <option value="1">1일</option>
                <option value="7">7일</option>
                <option value="30">30일</option>
                <option value="90">90일</option>
                <option value="">만료 없음</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#6e6e73] mb-2">
                비밀번호 <span className="text-xs text-[#a1a1a6]">(선택)</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="설정하지 않으면 공개 링크"
                className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
              />
            </div>
            <button
              onClick={createLink}
              disabled={creating}
              className="w-full py-3 rounded-xl bg-[#0071e3] text-white text-sm font-medium hover:bg-[#005bbf] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  생성 중...
                </>
              ) : '링크 생성'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5e7]">
              <p className="text-sm text-[#1d1d1f] flex-1 truncate font-mono text-xs">{result}</p>
              <button
                onClick={copyLink}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  copied ? 'bg-[#34c759] text-white' : 'bg-[#0071e3] text-white hover:bg-[#005bbf]'
                }`}
              >
                {copied ? '복사됨!' : '복사'}
              </button>
            </div>
            <div className="flex gap-2 text-xs text-[#6e6e73]">
              {expiresInDays && <span>⏱ {expiresInDays}일 후 만료</span>}
              {password && <span>🔒 비밀번호 설정됨</span>}
            </div>
            <button
              onClick={() => { setResult(null); setPassword(''); }}
              className="w-full py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
            >
              새 링크 생성
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
