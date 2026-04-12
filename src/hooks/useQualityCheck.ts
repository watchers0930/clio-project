'use client';

import { useState, useCallback, useEffect } from 'react';
import type { QualityCheckResponse } from '@/lib/supabase/types';
import { requestQualityCheck, fetchQualityCheck } from '@/lib/api/qualityCheck';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface UseQualityCheckReturn {
  result: QualityCheckResponse | null;
  status: Status;
  errorMessage: string | null;
  requestCheck: (force?: boolean) => Promise<void>;
  loadCached: () => Promise<void>;
}

export function useQualityCheck(documentId: string): UseQualityCheckReturn {
  const [result, setResult] = useState<QualityCheckResponse | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const loadCached = useCallback(async () => {
    if (!documentId) return;
    try {
      const cached = await fetchQualityCheck(documentId);
      if (cached) {
        setResult(cached);
        setStatus('success');
      }
    } catch {
      // 캐시 없음은 오류 아님
    }
  }, [documentId]);

  const requestCheck = useCallback(async (force = false) => {
    if (isRequesting || !documentId) return;
    setIsRequesting(true);
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await requestQualityCheck(documentId, force);
      setResult(data);
      setStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI 검수 요청에 실패했습니다.';
      setErrorMessage(msg);
      setStatus('error');
    } finally {
      setIsRequesting(false);
    }
  }, [documentId, isRequesting]);

  // 마운트 시 캐시 자동 로드
  useEffect(() => {
    loadCached();
  }, [loadCached]);

  return { result, status, errorMessage, requestCheck, loadCached };
}
