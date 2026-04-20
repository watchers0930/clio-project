'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MemoItem } from '@/lib/supabase/types';

export interface MemoGroup {
  id: string;
  name: string;
  memos: MemoItem[];
}

interface UseMemoGroupsReturn {
  groups: MemoGroup[];
  ungrouped: MemoItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// enabled: true일 때만 API 호출 (그룹 뷰 토글 시점에 lazy 호출)
export function useMemoGroups(enabled: boolean): UseMemoGroupsReturn {
  const [groups, setGroups] = useState<MemoGroup[]>([]);
  const [ungrouped, setUngrouped] = useState<MemoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    fetch('/api/memos/groups')
      .then((r) => {
        if (!r.ok) throw new Error('그룹 조회에 실패했습니다');
        return r.json();
      })
      .then((res: { success: boolean; data?: MemoGroup[]; ungrouped?: MemoItem[] }) => {
        if (res.success) {
          setGroups(res.data ?? []);
          setUngrouped(res.ungrouped ?? []);
        } else {
          throw new Error('그룹화 실패. 잠시 후 다시 시도해주세요');
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : '그룹 조회 중 오류가 발생했습니다';
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [enabled, tick]);

  return { groups, ungrouped, loading, error, refresh };
}
