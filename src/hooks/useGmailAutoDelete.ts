'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GmailDeleteHit } from './useGmailDelete';

export interface AutoDeleteRule {
  id: string;
  pattern: string;
  enabled: boolean;
  last_run_at: string | null;
  total_trashed: number;
  created_at: string;
}

interface PreviewMeta {
  total: number;
  truncated: boolean;
  previewLimit: number;
}

interface ActionResult {
  ok: boolean;
  error?: string;
  code?: string;
}

/**
 * Gmail 자동삭제 규칙 패널의 상태·API 로직.
 * 등록 전 반드시 미리보기(현재 몇 건 잡히는지)로 확인하도록 유도한다. (UI는 gmail-auto-delete-panel)
 */
export function useGmailAutoDelete() {
  const [rules, setRules] = useState<AutoDeleteRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewHits, setPreviewHits] = useState<GmailDeleteHit[]>([]);
  const [previewMeta, setPreviewMeta] = useState<PreviewMeta>({ total: 0, truncated: false, previewLimit: 100 });
  const [previewed, setPreviewed] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/auto-delete-rules');
      const data = await res.json();
      if (res.ok && data.success) setRules(data.rules ?? []);
    } catch { /* 무시 */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  // 등록 전 미리보기 — 이 규칙으로 지금 몇 건이 잡히는지 사용자가 눈으로 확인한다.
  const preview = useCallback(async (pattern: string): Promise<ActionResult> => {
    setPreviewing(true);
    setPreviewed(false);
    try {
      const res = await fetch('/api/gmail/search-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: pattern }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPreviewHits([]);
        return { ok: false, error: data.error, code: data.code };
      }
      setPreviewHits(data.hits ?? []);
      setPreviewMeta({
        total: data.totalEstimate ?? (data.hits?.length ?? 0),
        truncated: Boolean(data.truncated),
        previewLimit: data.previewLimit ?? 100,
      });
      setPreviewed(true);
      return { ok: true };
    } catch {
      return { ok: false, error: '미리보기 중 오류가 발생했습니다.' };
    } finally {
      setPreviewing(false);
    }
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewHits([]);
    setPreviewed(false);
  }, []);

  const addRule = useCallback(async (pattern: string): Promise<ActionResult> => {
    setSaving(true);
    try {
      const res = await fetch('/api/gmail/auto-delete-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return { ok: false, error: data.error, code: data.code };
      setRules((prev) => [data.rule, ...prev]);
      clearPreview();
      return { ok: true };
    } catch {
      return { ok: false, error: '규칙 등록 중 오류가 발생했습니다.' };
    } finally {
      setSaving(false);
    }
  }, [clearPreview]);

  const removeRule = useCallback(async (id: string): Promise<ActionResult> => {
    try {
      const res = await fetch(`/api/gmail/auto-delete-rules?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) return { ok: false, error: data.error };
      setRules((prev) => prev.filter((r) => r.id !== id));
      return { ok: true };
    } catch {
      return { ok: false, error: '규칙 해제 중 오류가 발생했습니다.' };
    }
  }, []);

  return {
    rules,
    loading,
    previewHits,
    previewMeta,
    previewed,
    previewing,
    saving,
    preview,
    clearPreview,
    addRule,
    removeRule,
  };
}
