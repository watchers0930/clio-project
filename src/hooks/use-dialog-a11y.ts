'use client';

// 대화상자 공용 키보드·초점 동작: 열릴 때 초점을 안으로, 닫히면 원래 자리로 복원,
// Escape 닫기, Tab 초점 가두기. 창이 겹치면 맨 위 창만 반응한다(lib/ui/dialog-stack).
// ui/modal.tsx·ui/confirm-dialog.tsx·관리비 창이 함께 쓴다.
import { useEffect, useRef, type RefObject } from 'react';
import { dialogStack } from '@/lib/ui/dialog-stack';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogA11y(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
  const stackId = useRef<number | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // 열릴 때만 순서에 올리고 초점을 옮긴다. deps 는 [open] — onClose 가 매 렌더 바뀌어도 입력 중 초점을 빼앗지 않는다.
  useEffect(() => {
    if (!open) return;
    const id = dialogStack.push();
    stackId.current = id;
    previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null;
    const panel = panelRef.current;
    if (panel) {
      const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      (items.length > 0 ? items[0] : panel).focus();
    }
    return () => {
      dialogStack.remove(id);
      stackId.current = null;
      previouslyFocused.current?.focus?.();
    };
  }, [open, panelRef]);

  // 리스너만 재바인딩하므로 재실행이 초점을 옮기지 않는다.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      const id = stackId.current;
      if (id === null || !dialogStack.isTop(id)) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === panel,
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose, panelRef]);
}
