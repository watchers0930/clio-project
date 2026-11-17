'use client';

// 관리비 데이터 hook — 연 단위로 항목·기록을 한 번씩 불러오고, 변이 후 다시 불러온다.
// 월별·연도별 화면이 같은 데이터를 쓰므로 탭·월 이동에는 추가 조회가 없다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiMutate } from './csrf-client';
import type { FeeEntry, FeeEntryCreateInput, FeeEntryUpdateInput, FeeItem, FeeItemInput } from '@/lib/maintenance-fees/types';

export function useMaintenanceFees(year: number) {
  const [items, setItems] = useState<FeeItem[]>([]);
  const [entries, setEntries] = useState<FeeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 화면 데이터가 어느 연도 것인지 — 연도를 넘긴 직후 이전 연도 데이터를 새 기간으로 보여주지 않게
  const [loadedYear, setLoadedYear] = useState<number | null>(null);
  // 연도를 빠르게 넘길 때 늦게 도착한 이전 연도 응답이 화면을 덮지 않게 한다
  const requestSeq = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    const [itemRes, entryRes] = await Promise.all([
      apiGet<FeeItem[]>('/api/maintenance-fees/items'),
      apiGet<FeeEntry[]>(`/api/maintenance-fees/entries?year=${year}`),
    ]);
    if (seq !== requestSeq.current) return;
    if (itemRes.status === 403 || entryRes.status === 403) {
      setForbidden(true);
    } else if (!itemRes.ok || !entryRes.ok) {
      setError(itemRes.error || entryRes.error || '관리비를 불러오지 못했습니다.');
    } else {
      setForbidden(false);
      setError(null);
      setItems(itemRes.data ?? []);
      setEntries(entryRes.data ?? []);
      setLoadedYear(year);
    }
    setLoading(false);
  }, [year]);

  useEffect(() => {
    const seqRef = requestSeq;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 연도 변경 시 데이터 재요청(로딩 상태 동기화)
    void reload();
    return () => {
      seqRef.current++;
    };
  }, [reload]);

  /** 변이 공통: 성공하면 다시 불러오고 null, 실패하면 오류 문구 */
  const mutate = useCallback(
    async (url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<string | null> => {
      const res = await apiMutate<unknown>(url, method, body);
      if (!res.ok) return res.error || '저장하지 못했습니다.';
      await reload();
      return null;
    },
    [reload],
  );

  const saveItem = useCallback(
    (input: FeeItemInput, id?: string) =>
      id
        ? mutate(`/api/maintenance-fees/items/${id}`, 'PATCH', input)
        : mutate('/api/maintenance-fees/items', 'POST', input),
    [mutate],
  );

  // 순서는 전체 항목 id 목록으로 한 번에 저장(서버가 한 트랜잭션으로 바꾼다)
  // 실패(목록이 바뀜 등)해도 최신 목록으로 다시 그려 낡은 순서 기준으로 또 옮기지 않게 한다
  const reorderItems = useCallback(
    async (ids: string[]) => {
      const err = await mutate('/api/maintenance-fees/items/order', 'PUT', { ids });
      if (err) await reload();
      return err;
    },
    [mutate, reload],
  );

  const deleteItem = useCallback((id: string) => mutate(`/api/maintenance-fees/items/${id}`, 'DELETE'), [mutate]);

  const saveEntry = useCallback(
    (input: FeeEntryCreateInput | FeeEntryUpdateInput, id?: string) =>
      id
        ? mutate(`/api/maintenance-fees/entries/${id}`, 'PATCH', input)
        : mutate('/api/maintenance-fees/entries', 'POST', input),
    [mutate],
  );

  const deleteEntry = useCallback((id: string) => mutate(`/api/maintenance-fees/entries/${id}`, 'DELETE'), [mutate]);

  return { items, entries, ready: loadedYear === year, loading, forbidden, error, reload, saveItem, reorderItems, deleteItem, saveEntry, deleteEntry };
}
