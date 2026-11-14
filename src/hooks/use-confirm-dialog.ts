'use client';

// 페이지가 소유하는 확인 다이얼로그(ConfirmDialog) 상태 훅.
// openConfirm은 매 호출마다 상태 전체를 교체하므로 이전 호출의 confirmLabel/variant가 남지 않는다.

import { useCallback, useState } from 'react';

export type ConfirmOptions = { confirmLabel?: string; variant?: 'danger' | 'primary' };

export type ConfirmState = {
  open: boolean;
  title: string;
  description?: string;
  onConfirm: () => void;
} & ConfirmOptions;

export function useConfirmDialog() {
  const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false, title: '', onConfirm: () => {} });

  const openConfirm = useCallback(
    (title: string, description: string | undefined, onConfirm: () => void, options: ConfirmOptions = {}) =>
      setConfirmState({ open: true, title, description, onConfirm, ...options }),
    [],
  );
  const closeConfirm = useCallback(() => setConfirmState((s) => ({ ...s, open: false })), []);

  return { confirmState, openConfirm, closeConfirm };
}
