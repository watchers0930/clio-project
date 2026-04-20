'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MemoGraphData } from '@/types/memo-graph';

interface UseMemoGraphReturn {
  data: MemoGraphData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * 메모 그래프 데이터 훅
 * enabled: true일 때만 API 호출 (그래프 탭 진입 시점에 lazy 호출)
 */
export function useMemoGraph(enabled: boolean): UseMemoGraphReturn {
  const [data, setData] = useState<MemoGraphData | null>(null);
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

    fetch('/api/memos/graph')
      .then((r) => {
        if (!r.ok) throw new Error('그래프 데이터 조회에 실패했습니다');
        return r.json();
      })
      .then((res: { success: boolean; nodes?: MemoGraphData['nodes']; links?: MemoGraphData['links'] }) => {
        if (res.success) {
          setData({
            nodes: res.nodes ?? [],
            links: res.links ?? [],
          });
        } else {
          throw new Error('그래프 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요');
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : '그래프 조회 중 오류가 발생했습니다';
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [enabled, tick]);

  return { data, loading, error, refresh };
}
