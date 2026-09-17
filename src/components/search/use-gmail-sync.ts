'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';

/**
 * 검색 화면의 Gmail 동기화 상태·트리거를 관리한다.
 * - 진입 시 연결상태 조회 + 자동 증분 동기화(쿨다운 10분, 서버측)
 * - 동기화로 새 메일이 들어오면 onSynced 콜백으로 재검색을 유도
 * - "지금 동기화" 버튼용 runSync(false) 제공 (결과를 토스트로 안내)
 */
export function useGmailSync(onSynced?: () => void) {
  const toast = useToast();
  const [connected, setConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // onSynced는 렌더마다 재생성될 수 있으므로 ref로 안정화(runSync 재생성 방지)
  const onSyncedRef = useRef(onSynced);
  useEffect(() => { onSyncedRef.current = onSynced; }, [onSynced]);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/status');
      if (!res.ok) return;
      const data = await res.json();
      setConnected(!!data.connected);
      setLastSyncedAt(data.lastSyncedAt ?? null);
    } catch { /* 무시 */ }
  }, []);

  // auto=true(진입 시): 조용히 실행. auto=false("지금 동기화" 버튼): 결과를 토스트로 안내.
  const runSync = useCallback(async (auto: boolean) => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 400) { setConnected(false); return; } // 미연결
      await refreshStatus();
      const synced = data?.synced ?? 0;
      if (synced > 0) onSyncedRef.current?.(); // 새 메일 → 재검색 유도
      if (!auto) {
        if (synced > 0) toast.success(`새 메일 ${synced}건을 동기화했습니다.`);
        else if (data?.error) toast.error(data.error);
        else toast.info('이미 최신 상태입니다.');
      }
    } catch {
      if (!auto) toast.error('동기화에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  }, [syncing, refreshStatus, toast]);

  const runSyncRef = useRef(runSync);
  useEffect(() => { runSyncRef.current = runSync; }, [runSync]);

  // 검색 화면 진입 시: 연결상태 조회 + 자동 증분 동기화
  useEffect(() => {
    void refreshStatus();
    void runSyncRef.current(true);
  }, [refreshStatus]);

  return { connected, lastSyncedAt, syncing, runSync };
}
