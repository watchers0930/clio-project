'use client';

import { useEffect, useState, useCallback } from 'react';
import { TRANSLATE_LANGS } from '@/lib/ai/translate';

interface EmailData {
  subject: string;
  from: string;
  date: string;
  body: string;
}

interface Props {
  messageId: string;
  emailName: string;
  onClose: () => void;
}

// 번역 언어 선택지 (코드→표시명)
const LANG_OPTIONS = Object.entries(TRANSLATE_LANGS) as Array<[string, string]>;

export function GmailEmailModal({ messageId, emailName, onClose }: Props) {
  const [email, setEmail] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 번역 상태
  const [targetLang, setTargetLang] = useState('ko');
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationCache, setTranslationCache] = useState<Record<string, string>>({});
  const [translateError, setTranslateError] = useState<string | null>(null);

  // 본문 로드
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/gmail/message/${encodeURIComponent(messageId)}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || data.error) throw new Error(data.error ?? '이메일을 불러올 수 없습니다.');
        setEmail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '이메일을 불러올 수 없습니다.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [messageId]);

  const runTranslate = useCallback(async () => {
    if (!email?.body) return;
    // 캐시된 번역이 있으면 재사용
    if (translationCache[targetLang]) {
      setShowTranslation(true);
      return;
    }
    setTranslating(true);
    setTranslateError(null);
    try {
      const res = await fetch('/api/gmail/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: email.body, targetLang }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? '번역에 실패했습니다.');
      setTranslationCache((prev) => ({ ...prev, [targetLang]: data.translated ?? '' }));
      setShowTranslation(true);
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : '번역에 실패했습니다.');
    } finally {
      setTranslating(false);
    }
  }, [email, targetLang, translationCache]);

  const displayBody = showTranslation ? (translationCache[targetLang] ?? '') : (email?.body ?? '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-8 py-6">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground">{email?.subject || emailName}</h2>
            {email ? (
              <p className="mt-1 truncate text-[12px] text-foreground-secondary">
                {email.from}{email.date ? ` · ${email.date}` : ''}
              </p>
            ) : null}
          </div>
          <button onClick={onClose} className="ml-3 shrink-0 rounded-lg p-2 text-foreground-secondary hover:bg-surface-secondary">
            <CloseIcon />
          </button>
        </div>

        {/* 번역 툴바 */}
        {email && !loading && !error ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-8 py-3">
            <div className="flex overflow-hidden rounded-lg border border-border">
              <button
                onClick={() => setShowTranslation(false)}
                className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${!showTranslation ? 'bg-primary text-white' : 'bg-white text-foreground-secondary hover:bg-surface-secondary'}`}
              >
                원문
              </button>
              <button
                onClick={() => { void runTranslate(); }}
                disabled={translating}
                className={`px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${showTranslation ? 'bg-primary text-white' : 'bg-white text-foreground-secondary hover:bg-surface-secondary'}`}
              >
                {translating ? '번역 중...' : '번역'}
              </button>
            </div>
            <select
              value={targetLang}
              onChange={(e) => {
                setTargetLang(e.target.value);
                setShowTranslation(false);
                setTranslateError(null);
              }}
              className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {LANG_OPTIONS.map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            {showTranslation ? (
              <span className="text-[11px] text-foreground-secondary">AI 번역 결과입니다. 원문과 함께 확인하세요.</span>
            ) : null}
          </div>
        ) : null}

        {/* 본문 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-red-500">{error}</p>
          ) : (
            <>
              {translateError ? (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{translateError}</p>
              ) : null}
              {displayBody ? (
                <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-foreground">{displayBody}</pre>
              ) : (
                <p className="py-10 text-center text-sm text-foreground-secondary">본문 내용이 없습니다.</p>
              )}
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-8 py-4">
          <a
            href={`https://mail.google.com/mail/u/0/#inbox/${messageId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border px-3.5 py-2 text-[12px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary"
          >
            Gmail에서 열기
          </a>
          <button onClick={onClose} className="rounded-lg bg-primary px-3.5 py-2 text-[12px] font-medium text-white transition-colors hover:bg-primary-dark">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}
