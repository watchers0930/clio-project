'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Op = '+' | '-' | '×' | '÷';

function compute(a: number, b: number, op: Op): number {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  return b === 0 ? NaN : a / b;
}

function fmt(v: string): string {
  if (v === '오류') return v;
  const [int, dec] = v.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = int.replace('-', '');
  const withComma = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${withComma}${dec !== undefined ? `.${dec}` : ''}`;
}

export function CalculatorModal({ open, onClose }: Props) {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [waiting, setWaiting] = useState(false);

  if (!open) return null;

  const inputDigit = (d: string) => {
    if (display === '오류') { setDisplay(d); setWaiting(false); return; }
    if (waiting) { setDisplay(d); setWaiting(false); return; }
    setDisplay(display === '0' ? d : display + d);
  };
  const inputDot = () => {
    if (waiting || display === '오류') { setDisplay('0.'); setWaiting(false); return; }
    if (!display.includes('.')) setDisplay(display + '.');
  };
  const clearAll = () => { setDisplay('0'); setPrev(null); setOp(null); setWaiting(false); };
  const back = () => setDisplay(display.length > 1 && display !== '오류' ? display.slice(0, -1) : '0');
  const toggleSign = () => { if (display !== '0' && display !== '오류') setDisplay(display.startsWith('-') ? display.slice(1) : `-${display}`); };

  const chooseOp = (next: Op) => {
    if (display === '오류') return;
    const cur = parseFloat(display);
    if (prev === null) {
      setPrev(cur);
    } else if (op && !waiting) {
      const r = compute(prev, cur, op);
      if (!Number.isFinite(r)) { setDisplay('오류'); setPrev(null); setOp(null); setWaiting(true); return; }
      setPrev(r);
      setDisplay(String(r));
    }
    setOp(next);
    setWaiting(true);
  };

  const equals = () => {
    if (op === null || prev === null || display === '오류') return;
    const cur = parseFloat(display);
    const r = compute(prev, cur, op);
    setDisplay(Number.isFinite(r) ? String(r) : '오류');
    setPrev(null);
    setOp(null);
    setWaiting(true);
  };

  const opBtn = 'rounded-xl bg-primary/10 text-[16px] font-semibold text-primary hover:bg-primary/20 h-12';
  const numBtn = 'rounded-xl bg-surface-secondary text-[16px] font-medium text-foreground hover:bg-border h-12';
  const fnBtn = 'rounded-xl bg-surface-secondary text-[14px] font-medium text-foreground-secondary hover:bg-border h-12';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-[280px] rounded-2xl border border-border bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-[14px] font-semibold text-foreground">계산기</h3>
          <button onClick={onClose} className="text-foreground-secondary hover:text-foreground"><X size={16} strokeWidth={1.5} /></button>
        </div>
        <div className="px-4 pb-4 pt-3">
          <div className="mb-6 flex h-16 items-end justify-end overflow-x-auto rounded-xl bg-surface-secondary px-4 py-2 text-right text-[26px] font-semibold text-foreground">
            {fmt(display)}
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            <button onClick={clearAll} className={fnBtn}>C</button>
            <button onClick={toggleSign} className={fnBtn}>±</button>
            <button onClick={back} className={fnBtn}>⌫</button>
            <button onClick={() => chooseOp('÷')} className={opBtn}>÷</button>

            <button onClick={() => inputDigit('7')} className={numBtn}>7</button>
            <button onClick={() => inputDigit('8')} className={numBtn}>8</button>
            <button onClick={() => inputDigit('9')} className={numBtn}>9</button>
            <button onClick={() => chooseOp('×')} className={opBtn}>×</button>

            <button onClick={() => inputDigit('4')} className={numBtn}>4</button>
            <button onClick={() => inputDigit('5')} className={numBtn}>5</button>
            <button onClick={() => inputDigit('6')} className={numBtn}>6</button>
            <button onClick={() => chooseOp('-')} className={opBtn}>−</button>

            <button onClick={() => inputDigit('1')} className={numBtn}>1</button>
            <button onClick={() => inputDigit('2')} className={numBtn}>2</button>
            <button onClick={() => inputDigit('3')} className={numBtn}>3</button>
            <button onClick={() => chooseOp('+')} className={opBtn}>+</button>

            <button onClick={() => inputDigit('0')} className={`${numBtn} col-span-2`}>0</button>
            <button onClick={inputDot} className={numBtn}>.</button>
            <button onClick={equals} className="h-12 rounded-xl bg-primary text-[16px] font-semibold text-white hover:bg-primary-dark">=</button>
          </div>
        </div>
      </div>
    </div>
  );
}
