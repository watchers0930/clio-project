'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MemoGraphData } from '@/types/memo-graph';

interface UseMemoGraphOptions {
  enabled?: boolean;
}

interface UseMemoGraphReturn {
  data: MemoGraphData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMemoGraph({ enabled = true }: UseMemoGraphOptions = {}): UseMemoGraphReturn {
  const [data, setData] = useState<MemoGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/memos/graph')
      .then((r) => r.json())
      .then((res: { success: boolean; data?: MemoGraphData; error?: string }) => {
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error ?? '그래프 데이터 로드 실패');
        }
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (enabled && !data) fetch_();
  }, [fetch_, enabled, data]);

  return { data, loading, error, refresh: fetch_ };
}
