'use client';

import { useCallback, useRef, useState } from 'react';
import { csrfFetch } from '@/hooks/csrf-client';

export type SummaryEntry =
  | { status: 'loading' }
  | { status: 'done'; text: string }
  | { status: 'error'; text: string };

/**
 * 검색 결과 카드의 'AI 요약 보기' — 누른 결과만 서버에서 요약하고(검색 때 미리 요약하지 않음) 결과 id 별로 기억한다.
 * 같은 검색 안에서 다시 펼치면 다시 부르지 않는다. 실패한 결과는 다시 펼칠 때 재시도한다.
 */
export function useResultSummary() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<string, SummaryEntry>>({});
  const inflight = useRef(new Set<string>());
  const generation = useRef(0); // reset 뒤 늦게 온 이전 검색의 응답은 버린다
  // 새 검색 때 접고 기억도 비운다(문서를 고친 뒤 다시 검색하면 새 본문으로 요약) — doSearch 의존성에 넣을 수 있게 고정
  const reset = useCallback(() => {
    generation.current++;
    inflight.current.clear();
    setExpandedId(null);
    setEntries({});
  }, []);

  const fetchSummary = async (id: string) => {
    const gen = generation.current;
    inflight.current.add(id);
    setEntries((prev) => ({ ...prev, [id]: { status: 'loading' } }));
    let entry: SummaryEntry;
    try {
      const res = await csrfFetch('/api/search/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const body = await res.json().catch(() => null) as { data?: { summary?: string }; error?: string } | null;
      entry = res.ok && body?.data?.summary
        ? { status: 'done', text: body.data.summary }
        : { status: 'error', text: body?.error || '요약을 만들지 못했습니다.' };
    } catch {
      entry = { status: 'error', text: '네트워크 오류로 요약하지 못했습니다.' };
    }
    if (gen !== generation.current) return; // reset 이 inflight 를 이미 비웠다 — 새 검색의 같은 id 표시를 건드리지 않는다
    inflight.current.delete(id);
    setEntries((prev) => ({ ...prev, [id]: entry }));
  };

  const toggle = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    const current = entries[id];
    if ((current && current.status !== 'error') || inflight.current.has(id)) return;
    void fetchSummary(id);
  };

  return {
    expandedId,
    expandedEntry: expandedId ? entries[expandedId] ?? null : null,
    toggle,
    reset,
  };
}
