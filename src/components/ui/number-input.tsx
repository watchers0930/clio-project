'use client';

// 쉼표 숫자 입력칸 — 입력·붙여넣기 정리와 커서 위치 복원(lib/format/number-input).
// 값을 몰래 바꿔야 하는 입력은 무시하고 이전 값을 유지한다. 붙여넣기는 문구에서 숫자를 뽑아 넣는다.
// 쉼표에서 Backspace/Delete 는 옆 숫자를 지운다.
import { useEffect, useLayoutEffect, useRef, type ClipboardEvent, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { caretAfterFormat, countSignificant, extractPastedNumber, formatNumberInput, type NumberInputOptions } from '@/lib/format/number-input';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'inputMode'> &
  NumberInputOptions & {
    value: string;
    onValueChange: (next: string) => void;
  };

export function NumberInput({ value, onValueChange, decimals, allowNegative, maxInt, onKeyDown, onPaste, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  // 네이티브 리스너가 볼 최신 값·옵션 (렌더 뒤 동기 갱신 — 다음 입력 이벤트보다 먼저 반영된다)
  const latest = useRef({ value, opts: { decimals, allowNegative, maxInt } });
  useLayoutEffect(() => {
    latest.current = { value, opts: { decimals, allowNegative, maxInt } };
  });

  // 입력되기 전에 거른다: 값을 몰래 바꿀 글자는 입력칸에 아예 들어가지 않게 해서 되돌리기·커서 복원이 필요 없다
  // (빠른 연속 입력에서 다음 글자가 엉뚱한 자리에 들어가던 문제의 근본 해결).
  // React 의 onBeforeInput 은 textInput/keypress 기반 합성 이벤트라 inputType 이 없어 네이티브 beforeinput 을 직접 쓴다.
  // 붙여넣기·지우기·한글 조합은 insertText 가 아니라 onPaste/onChange 가 처리한다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const guard = (e: InputEvent) => {
      if (e.isComposing || e.inputType !== 'insertText' || !e.data) return;
      const { value: current, opts } = latest.current;
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      if (formatNumberInput(current.slice(0, start) + e.data + current.slice(end), opts) === null) e.preventDefault();
    };
    el.addEventListener('beforeinput', guard);
    return () => el.removeEventListener('beforeinput', guard);
  }, []);

  // 값이 다시 그려진 뒤 커서를 같은 숫자 뒤로 되돌린다
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || pendingCaret.current === null) return;
    if (document.activeElement === el) el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);

  // 값이 그대로면 다시 그려지지 않으므로, React 가 입력칸을 되돌린 뒤 커서만 제자리로 돌린다
  const restoreCaretLater = (pos: number) => {
    pendingCaret.current = null;
    const el = ref.current;
    requestAnimationFrame(() => {
      if (el && document.activeElement === el) el.setSelectionRange(pos, pos);
    });
  };

  const handleChange = (raw: string, caret: number) => {
    const next = formatNumberInput(raw, { decimals, allowNegative, maxInt });
    if (next === null) {
      restoreCaretLater(Math.max(0, caret - (raw.length - value.length)));
      return;
    }
    const nextCaret = caretAfterFormat(next, countSignificant(raw, caret));
    if (next === value) {
      restoreCaretLater(nextCaret);
      return;
    }
    pendingCaret.current = nextCaret;
    onValueChange(next);
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    const pasted = extractPastedNumber(e.clipboardData.getData('text'), { decimals, allowNegative, maxInt });
    if (pasted === null) return;
    const el = e.currentTarget;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    handleChange(value.slice(0, start) + pasted + value.slice(end), start + pasted.length);
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
      onPaste={handlePaste}
    />
  );
}
