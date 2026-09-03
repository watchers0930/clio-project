'use client';

import { useCallback, useRef, useState } from 'react';

export interface Caption {
  id: string;        // 발화 고유 키
  name: string;      // 발화자 이름
  original: string;  // 원문
  translated: string; // 번역문 (도착 전엔 '')
}

const MAX_CAPTIONS = 4; // 화면에 유지할 최근 자막 수

/**
 * 라이브 자막 상태·번역 로직 훅.
 * pushFinal(id, name, text) 를 최종 발화마다 호출 → 번역 API 호출 후 자막 목록 갱신.
 */
export function useLiveCaptions(targetLang: string) {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const targetRef = useRef(targetLang);
  targetRef.current = targetLang;

  const pushFinal = useCallback(async (id: string, name: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;

    // 원문 먼저 표시(번역 대기), 목록 최대 MAX 유지
    setCaptions((prev) => [...prev, { id, name, original: clean, translated: '' }].slice(-MAX_CAPTIONS));

    try {
      const res = await fetch('/api/meetings/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, targetLang: targetRef.current }),
      });
      const json = await res.json();
      const translated = res.ok && json.success ? json.data.translated : '';
      setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, translated } : c)));
    } catch {
      // 번역 실패 시 원문만 유지
    }
  }, []);

  const clear = useCallback(() => setCaptions([]), []);

  return { captions, pushFinal, clear };
}
