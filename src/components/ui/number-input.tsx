'use client';

// 쉼표 숫자 입력칸 — 입력·붙여넣기 정리와 커서 위치 복원(lib/format/number-input).
// 숫자로 읽을 수 없는 입력은 무시하고 이전 값을 유지한다. 쉼표에서 Backspace/Delete 는 옆 숫자를 지운다.
import { useLayoutEffect, useRef, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { caretAfterFormat, countSignificant, formatNumberInput, type NumberInputOptions } from '@/lib/format/number-input';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'inputMode'> &
  NumberInputOptions & {
    value: string;
    onValueChange: (next: string) => void;
  };

export function NumberInput({ value, onValueChange, decimals, allowNegative, maxInt, onKeyDown, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  // 값이 다시 그려진 뒤 커서를 같은 숫자 뒤로 되돌린다
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || pendingCaret.current === null) return;
    if (document.activeElement === el) el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);

  const handleChange = (raw: string, caret: number) => {
    const next = formatNumberInput(raw, { decimals, allowNegative, maxInt });
    if (next === null) {
      // 숫자가 아닌 입력: 값이 그대로라 다시 그려지지 않으므로, React 가 값을 되돌린 뒤 커서만 원래 자리로
      const el = ref.current;
      const back = Math.max(0, caret - (raw.length - value.length));
      requestAnimationFrame(() => el?.setSelectionRange(back, back));
      return;
    }
    pendingCaret.current = caretAfterFormat(next, countSignificant(raw, caret));
    onValueChange(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    if (start !== el.selectionEnd) return;
    // 쉼표만 지우면 다시 쉼표가 생겨 아무것도 안 지워진 것처럼 보이므로 커서를 쉼표 너머로 옮긴다
    if (e.key === 'Backspace' && value[start - 1] === ',') el.setSelectionRange(start - 1, start - 1);
    if (e.key === 'Delete' && value[start] === ',') el.setSelectionRange(start + 1, start + 1);
  };

  return (
    <input
      {...rest}
      ref={ref}
      value={value}
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      onChange={(e) => handleChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
      onKeyDown={handleKeyDown}
    />
  );
}
