'use client';

import { useCallback, useEffect, useState } from 'react';

// 자주 쓰는 삭제 키워드를 브라우저(localStorage)에 저장. 개인 편의용 즐겨찾기.
const SAVED_KEY = 'clio_gmail_delete_keywords';
const SAVED_MAX = 30;

export interface GmailDeleteHit {
  id: string;
  subject: string;
  from: string;
  date: string;
}

interface SearchMeta {
  total: number;
  truncated: boolean;
  previewLimit: number;
}

interface SearchResponse {
  success?: boolean;
  hits?: GmailDeleteHit[];
  totalEstimate?: number;
  truncated?: boolean;
  previewLimit?: number;
  error?: string;
  code?: string;
}

interface ActionResult {
  ok: boolean;
  error?: string;
  code?: string;
  trashed?: number;
}

/**
 * 지메일 키워드 삭제 패널의 상태·API 호출 로직.
 * 검색 → 결과 선택 → 휴지통 이동 흐름을 담당한다. (UI는 gmail-delete-panel에서 렌더)
 */
export function useGmailDelete() {
  const [hits, setHits] = useState<GmailDeleteHit[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searched, setSearched] = useState(false);
  const [meta, setMeta] = useState<SearchMeta>({ total: 0, truncated: false, previewLimit: 100 });
  const [savedKeywords, setSavedKeywords] = useState<string[]>([]);
  // 저장된 키워드 중 현재 선택(체크)한 것들 — 여러 개를 OR로 묶어 한 번에 검색한다.
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());

  // 저장된 키워드 로드 (클라이언트에서만)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSavedKeywords(JSON.parse(raw));
    } catch { /* 파싱 실패 무시 */ }
  }, []);

  // 키워드 저장 — 이미 있으면 그대로, 최신순 상한 유지. 저장 여부 반환.
  const saveKeyword = useCallback((keyword: string): boolean => {
    const t = keyword.trim();
    if (t.length < 2) return false;
    let added = false;
    setSavedKeywords((prev) => {
      if (prev.includes(t)) return prev;
      added = true;
      const next = [t, ...prev].slice(0, SAVED_MAX);
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
      return next;
    });
    return added;
  }, []);

  const removeKeyword = useCallback((keyword: string) => {
    setSavedKeywords((prev) => {
      const next = prev.filter((k) => k !== keyword);
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
      return next;
    });
    // 삭제되는 키워드는 선택 목록에서도 함께 제거한다.
    setSelectedKeywords((prev) => {
      if (!prev.has(keyword)) return prev;
      const next = new Set(prev);
      next.delete(keyword);
      return next;
    });
  }, []);

  // 저장된 키워드 선택/해제 토글 — 여러 개를 동시에 고를 수 있다.
  const toggleKeyword = useCallback((keyword: string) => {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  }, []);

  const clearSelectedKeywords = useCallback(() => setSelectedKeywords(new Set()), []);

  const search = useCallback(async (keyword: string): Promise<ActionResult> => {
    setSearching(true);
    setSearched(false);
    try {
      const res = await fetch('/api/gmail/search-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });
      const data: SearchResponse = await res.json();
      if (!res.ok || !data.success) {
        setHits([]);
        setSelected(new Set());
        return { ok: false, error: data.error, code: data.code };
      }
      const list = data.hits ?? [];
      setHits(list);
      // 기본 전체 선택 — 사용자가 목록을 눈으로 확인하고 필요 시 해제한다.
      setSelected(new Set(list.map((h) => h.id)));
      setMeta({
        total: data.totalEstimate ?? list.length,
        truncated: Boolean(data.truncated),
        previewLimit: data.previewLimit ?? 100,
      });
      setSearched(true);
      return { ok: true };
    } catch {
      return { ok: false, error: '검색 중 오류가 발생했습니다.' };
    } finally {
      setSearching(false);
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === hits.length ? new Set() : new Set(hits.map((h) => h.id))));
  }, [hits]);

  const remove = useCallback(async (): Promise<ActionResult> => {
    const ids = Array.from(selected);
    if (ids.length === 0) return { ok: false, error: '삭제할 메일을 선택해 주세요.' };
    setDeleting(true);
    try {
      const res = await fetch('/api/gmail/delete-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return { ok: false, error: data.error, code: data.code };
      // 방금 삭제한 항목을 목록에서 제거
      setHits((prev) => prev.filter((h) => !selected.has(h.id)));
      setSelected(new Set());
      return { ok: true, trashed: data.trashed };
    } catch {
      return { ok: false, error: '삭제 중 오류가 발생했습니다.' };
    } finally {
      setDeleting(false);
    }
  }, [selected]);

  const reset = useCallback(() => {
    setHits([]);
    setSelected(new Set());
    setSearched(false);
  }, []);

  return {
    hits,
    selected,
    searching,
    deleting,
    searched,
    meta,
    savedKeywords,
    selectedKeywords,
    search,
    toggle,
    toggleAll,
    remove,
    reset,
    saveKeyword,
    removeKeyword,
    toggleKeyword,
    clearSelectedKeywords,
  };
}
