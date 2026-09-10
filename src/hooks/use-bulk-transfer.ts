'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  TransferItem,
  TransferItemInput,
  TransferPayee,
  TransferPayeeInput,
  TransferStatus,
} from '@/lib/bulk-transfer/types';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(json.error ?? '요청에 실패했습니다.');
  return json.data as T;
}

/** 대량이체 거래처·이체건 상태 및 CRUD 훅 */
export function useBulkTransfer() {
  const [payees, setPayees] = useState<TransferPayee[]>([]);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, iRes] = await Promise.all([
        fetch('/api/bulk-transfer/payees'),
        fetch('/api/bulk-transfer/items'),
      ]);
      const p = (await pRes.json().catch(() => ({}))) as { data?: TransferPayee[] };
      const i = (await iRes.json().catch(() => ({}))) as { data?: TransferItem[] };
      setPayees(p.data ?? []);
      setItems(i.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // --- 거래처 ---
  const createPayee = useCallback(async (input: TransferPayeeInput) => {
    const res = await fetch('/api/bulk-transfer/payees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const saved = await jsonOrThrow<TransferPayee>(res);
    setPayees((prev) => [saved, ...prev]);
    return saved;
  }, []);

  const updatePayee = useCallback(async (id: string, input: TransferPayeeInput) => {
    const res = await fetch(`/api/bulk-transfer/payees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const saved = await jsonOrThrow<TransferPayee>(res);
    setPayees((prev) => prev.map((p) => (p.id === id ? saved : p)));
    return saved;
  }, []);

  const deletePayee = useCallback(async (id: string) => {
    const res = await fetch(`/api/bulk-transfer/payees/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? '삭제에 실패했습니다.');
    }
    setPayees((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // --- 이체 건 ---
  const createItem = useCallback(async (input: TransferItemInput) => {
    const res = await fetch('/api/bulk-transfer/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const saved = await jsonOrThrow<TransferItem>(res);
    setItems((prev) => [saved, ...prev]);
    return saved;
  }, []);

  const updateItem = useCallback(async (id: string, input: TransferItemInput) => {
    const res = await fetch(`/api/bulk-transfer/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const saved = await jsonOrThrow<TransferItem>(res);
    setItems((prev) => prev.map((it) => (it.id === id ? saved : it)));
    return saved;
  }, []);

  const setItemStatus = useCallback(async (id: string, status: TransferStatus) => {
    const res = await fetch(`/api/bulk-transfer/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const saved = await jsonOrThrow<TransferItem>(res);
    setItems((prev) => prev.map((it) => (it.id === id ? saved : it)));
    return saved;
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const res = await fetch(`/api/bulk-transfer/items/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? '삭제에 실패했습니다.');
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  /** 선택 건들을 하나은행 .xls로 내려받기. 성공 시 상태 재동기화. */
  const exportItems = useCallback(
    async (ids: string[]) => {
      const res = await fetch('/api/bulk-transfer/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: ids }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? '파일 생성에 실패했습니다.');
      }
      const blob = await res.blob();
      const dateISO = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `하나은행_대량이체_${dateISO}.xls`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1000);
      await load(); // exported 상태 반영
    },
    [load],
  );

  return {
    payees,
    items,
    loading,
    createPayee,
    updatePayee,
    deletePayee,
    createItem,
    updateItem,
    setItemStatus,
    deleteItem,
    exportItems,
  };
}
