'use client';

import { useState, useRef, useCallback } from 'react';

export interface UseMemoIdeaReturn {
  text: string;
  loading: boolean;
  done: boolean;
  error: string | null;
  generate: (memoIds: string[]) => void;
  reset: () => void;
}

export function useMemoIdea(): UseMemoIdeaReturn {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setText('');
    setLoading(false);
    setDone(false);
    setError(null);
  }, []);

  const generate = useCallback(async (memoIds: string[]) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setText('');
    setDone(false);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/memos/idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoIds }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        setError(errData.error ?? '아이디어 생성 실패');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') { setDone(true); setLoading(false); return; }
          try {
            const { text: chunk, error: errMsg } = JSON.parse(payload) as { text?: string; error?: string };
            if (errMsg) { setError(errMsg); return; }
            if (chunk) setText((prev) => prev + chunk);
          } catch { /* skip malformed line */ }
        }
      }
      setDone(true);
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== 'AbortError') {
        setError('네트워크 오류');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return { text, loading, done, error, generate, reset };
}
