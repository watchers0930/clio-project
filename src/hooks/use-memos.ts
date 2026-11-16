'use client';

import { useCallback, useEffect, useState } from 'react';
import { csrfFetch } from '@/hooks/csrf-client';
import { readJsonOk } from '@/lib/http/read-json-ok';
import { useToast } from '@/components/ui/toast';
import type { MemoFormData } from '@/components/memos/memo-form-modal';
import type { MemoItem } from '@/lib/supabase/types';
import type { ExtractedTodo } from '@/components/memos/memo-todo-confirm-modal';

// 메모 목록 조회·저장·고정·삭제와 아이디어 저장·할일 추출 (화면은 UI 상태만 다룬다)
export function useMemos() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [search, setSearch] = useState('');

  const fetchMemos = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    fetch(`/api/memos?${params}`)
      .then((r) => r.json())
      .then((res: { success: boolean; data?: MemoItem[] }) => {
        if (res.success) setMemos(res.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { fetchMemos(); }, [fetchMemos]);

  const embed = (id: string) => {
    csrfFetch(`/api/memos/${id}/embed`, { method: 'POST' }).then(() => {}, () => {});
  };

  // 저장 실패는 사유를 안내하고 오류를 다시 던져 입력창이 닫히지 않게 한다(작성 내용 유지)
  const saveOrThrow = async <T,>(res: Response, fallback: string): Promise<T> => {
    try {
      return await readJsonOk<T>(res, fallback);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : fallback);
      throw e;
    }
  };

  const createMemo = async (data: MemoFormData) => {
    const res = await csrfFetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await saveOrThrow<{ success: boolean; data?: MemoItem }>(res, '메모를 저장하지 못했습니다.');
    fetchMemos();
    if (result.data?.id) embed(result.data.id);
  };

  const updateMemo = async (id: string, data: MemoFormData) => {
    const res = await csrfFetch(`/api/memos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await saveOrThrow(res, '메모를 저장하지 못했습니다.');
    fetchMemos();
    embed(id);
  };

  const togglePin = async (id: string) => {
    const memo = memos.find((m) => m.id === id);
    if (!memo) return;
    const res = await csrfFetch(`/api/memos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !memo.is_pinned }),
    });
    try {
      await readJsonOk(res, '메모 고정을 바꾸지 못했습니다.');
      fetchMemos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '메모 고정을 바꾸지 못했습니다.');
    }
  };

  const deleteMemo = async (id: string) => {
    try {
      const res = await csrfFetch(`/api/memos/${id}`, { method: 'DELETE' });
      await readJsonOk(res, '메모를 삭제하지 못했습니다.');
      fetchMemos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '메모를 삭제하지 못했습니다.');
    }
  };

  const saveIdeaMemo = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('저장할 아이디어가 없습니다');
    }

    const res = await csrfFetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '💡 AI 아이디어', content: trimmed, color: 'blue' }),
    });

    const result = await res.json() as { success: boolean; data?: { id: string }; error?: string };
    if (!result.success) {
      throw new Error(result.error ?? '메모 저장에 실패했습니다');
    }

    if (result.data?.id) {
      csrfFetch(`/api/memos/${result.data.id}/embed`, { method: 'POST' }).catch(() => {});
    }
  }, []);

  const extractIdeaTodos = useCallback(async (text: string): Promise<ExtractedTodo[]> => {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('추출할 아이디어가 없습니다');
    }

    const res = await csrfFetch('/api/todos/from-idea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ideaText: trimmed }),
    });

    const result = await res.json() as {
      success: boolean;
      data?: ExtractedTodo[];
      error?: string;
    };

    if (!result.success || !result.data) {
      throw new Error(result.error ?? '할일 추출에 실패했습니다');
    }

    return result.data;
  }, []);

  return {
    loading, memos, search, setSearch, fetchMemos,
    createMemo, updateMemo, togglePin, deleteMemo, saveIdeaMemo, extractIdeaTodos,
  };
}
