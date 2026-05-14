'use client';

import { useState, useEffect, use, useCallback } from 'react';

interface ShareData {
  type: 'document' | 'file';
  title: string;
  content?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  downloadUrl?: string;
  createdAt: string;
  expiresAt?: string | null;
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const fetchData = useCallback(async (pw?: string) => {
    const url = pw ? `/api/share/${token}?password=${encodeURIComponent(pw)}` : `/api/share/${token}`;
    const res = await fetch(url);
    const json = await res.json();

    if (!res.ok) {
      if (json.needPassword) { setNeedPassword(true); setLoading(false); return; }
      setError(json.error ?? '알 수 없는 오류가 발생했습니다.');
      setLoading(false);
      return;
    }
    setData(json);
    setNeedPassword(false);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const handlePasswordSubmit = async () => {
    if (!password.trim()) return;
    setPwLoading(true);
    await fetchData(password);
    setPwLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#e5e5e7] border-t-[#0071e3] rounded-full animate-spin" />
      </div>
    );
  }

  if (needPassword) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center px-4">
        <div className="bg-white rounded-[24px] border border-[#e5e5e7] shadow-lg w-full max-w-sm p-7 text-center sm:p-10">
          <div className="w-14 h-14 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-[#1d1d1f] mb-1">비밀번호 보호 링크</h1>
          <p className="text-sm text-[#6e6e73] mb-6">이 링크는 비밀번호로 보호되어 있습니다.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="비밀번호 입력"
            className="mb-4 w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 py-3.5 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
          />
          <button
            onClick={handlePasswordSubmit}
            disabled={pwLoading || !password.trim()}
            className="w-full py-3.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40"
          >
            {pwLoading ? '확인 중...' : '확인'}
          </button>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center px-4">
        <div className="bg-white rounded-[24px] border border-[#e5e5e7] shadow-lg w-full max-w-sm p-7 text-center sm:p-10">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-[#1d1d1f] mb-2">접근할 수 없습니다</h1>
          <p className="text-sm text-[#6e6e73]">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* 헤더 */}
      <header className="bg-white border-b border-[#e5e5e7] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col gap-3 sm:px-6 sm:py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0071e3] flex items-center justify-center">
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <span className="text-sm font-semibold text-[#1d1d1f]">CLIO</span>
            <span className="text-[#d1d1d6]">·</span>
            <span className="text-sm text-[#6e6e73]">공유된 {data.type === 'document' ? '문서' : '파일'}</span>
          </div>
          {data.expiresAt && (
            <span className="text-xs text-[#6e6e73] sm:text-right">
              만료: {new Date(data.expiresAt).toLocaleDateString('ko-KR')}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
        {data.type === 'document' ? (
          <div className="bg-white rounded-2xl border border-[#e5e5e7] shadow-sm overflow-hidden">
            <div className="px-6 py-6 border-b border-[#e5e5e7] sm:px-8 sm:py-7">
              <h1 className="text-xl font-bold text-[#1d1d1f] break-words sm:text-2xl">{data.title}</h1>
              <p className="text-sm text-[#6e6e73] mt-1">
                {new Date(data.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="px-6 py-6 sm:px-8 sm:py-7">
              <pre className="whitespace-pre-wrap text-sm text-[#1d1d1f] leading-relaxed font-sans">
                {data.content ?? '(내용 없음)'}
              </pre>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#e5e5e7] shadow-sm p-6 sm:p-8 flex flex-col items-center text-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-[#f5f5f7] flex items-center justify-center">
              <svg className="w-10 h-10 text-[#0071e3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1d1d1f] break-words">{data.title}</h1>
              <p className="text-sm text-[#6e6e73] mt-1">
                {data.fileType?.toUpperCase()} · {data.fileSize ? `${(data.fileSize / 1024).toFixed(1)} KB` : ''}
              </p>
            </div>
            {data.downloadUrl && (
              <a
                href={data.downloadUrl}
                download={data.fileName}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0071e3] text-white text-sm font-medium hover:bg-[#005bbf] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                파일 다운로드
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
