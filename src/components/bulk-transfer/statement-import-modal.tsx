'use client';

import { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, X } from 'lucide-react';
import type { FixedExpense, MonthlyExpense, MonthlyExpenseInput } from '@/lib/bulk-transfer/types';
import {
  CARD_LABEL,
  parseStatement,
  planImport,
  type CardAction,
  type PlannedCard,
  type PlannedTx,
  type TxAction,
} from '@/lib/bulk-transfer/hana-statement';
import { monthLabel } from '@/lib/bulk-transfer/month-utils';

interface Props {
  open: boolean;
  onClose: () => void;
  fixedExpenses: FixedExpense[];
  monthlyExpenses: MonthlyExpense[];
  createMonthly: (input: MonthlyExpenseInput) => Promise<unknown>;
  updateMonthly: (id: string, input: MonthlyExpenseInput) => Promise<unknown>;
  onDone: (msg: string) => void;
}

const TX_ACTIONS: { value: TxAction; label: string }[] = [
  { value: 'add', label: '월지출 추가' },
  { value: 'fixed', label: '고정지출 (건너뜀)' },
  { value: 'duplicate', label: '이미 등록 (건너뜀)' },
  { value: 'skip', label: '제외' },
];

type Filter = 'all' | TxAction;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'add', label: '추가' },
  { value: 'fixed', label: '고정지출' },
  { value: 'duplicate', label: '이미 등록' },
  { value: 'skip', label: '제외' },
];

const won = (n: number) => n.toLocaleString('ko-KR');
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

export function StatementImportModal({
  open,
  onClose,
  fixedExpenses,
  monthlyExpenses,
  createMonthly,
  updateMonthly,
  onDone,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [txs, setTxs] = useState<PlannedTx[]>([]);
  const [cards, setCards] = useState<PlannedCard[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  /** 저장에 성공한 행 — 중간 실패 후 다시 눌러도 중복 등록하지 않게 */
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c: Record<TxAction, number> = { add: 0, fixed: 0, duplicate: 0, skip: 0 };
    for (const t of txs) c[t.action] += 1;
    return c;
  }, [txs]);
  const cardWrites = cards.filter((c) => c.action !== 'skip' && !savedKeys.has(c.key)).length;
  const txWrites = txs.filter((t) => t.action === 'add' && !savedKeys.has(t.key)).length;
  const writes = cardWrites + txWrites;
  const visible = filter === 'all' ? txs : txs.filter((t) => t.action === filter);

  const reset = () => {
    setFileName('');
    setRange(null);
    setTxs([]);
    setCards([]);
    setFilter('all');
    setParsing(false);
    setSaving(false);
    setProgress('');
    setError('');
    setSavedKeys(new Set());
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  if (!open) return null;

  const analyze = async (file: File) => {
    reset();
    setFileName(file.name);
    setParsing(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('엑셀에 시트가 없습니다.');
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' });
      const parsed = parseStatement(rows);
      if (parsed.txs.length === 0) throw new Error('출금 거래가 없습니다.');
      const plan = planImport(parsed.txs, fixedExpenses, monthlyExpenses);
      setRange(parsed.range);
      setTxs(plan.txs);
      setCards(plan.cards);
      setFilter(plan.txs.some((t) => t.action === 'add') ? 'add' : 'all');
    } catch (e) {
      setError(e instanceof Error ? e.message : '파일을 읽지 못했습니다.');
    } finally {
      setParsing(false);
    }
  };

  const setTx = (key: string, patch: Partial<PlannedTx>) =>
    setTxs((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const setCard = (key: string, action: CardAction) =>
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, action } : c)));

  const register = async () => {
    const emptyLabel = txs.find((t) => t.action === 'add' && !t.label.trim());
    if (emptyLabel) {
      setError(`${md(emptyLabel.tx.date)} ${won(emptyLabel.tx.amount)}원 항목명을 입력해 주세요.`);
      return;
    }
    setSaving(true);
    setError('');
    const done = new Set(savedKeys);
    let n = 0;
    try {
      for (const c of cards) {
        if (c.action === 'skip' || done.has(c.key)) continue;
        setProgress(`${n + 1}/${writes} 저장 중…`);
        const input = { label: CARD_LABEL, amount: c.amount, month: c.month, memo: c.memo };
        if (c.action === 'update' && c.existing) await updateMonthly(c.existing.id, input);
        else await createMonthly(input);
        done.add(c.key);
        n += 1;
      }
      for (const t of txs) {
        if (t.action !== 'add' || done.has(t.key)) continue;
        setProgress(`${n + 1}/${writes} 저장 중…`);
        await createMonthly({ label: t.label.trim(), amount: t.tx.amount, month: t.tx.month, memo: t.memo || null });
        done.add(t.key);
        n += 1;
      }
      onDone(`거래내역에서 ${n}건을 월지출에 반영했습니다.`);
      reset();
      onClose();
    } catch (e) {
      setSavedKeys(done);
      setError(
        `${n}건 저장 후 실패했습니다: ${e instanceof Error ? e.message : '알 수 없는 오류'} — 다시 누르면 남은 건만 저장합니다.`,
      );
    } finally {
      setSaving(false);
      setProgress('');
    }
  };

  const hasPlan = txs.length > 0 || cards.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="거래내역 불러오기"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-[15px] font-semibold text-foreground">거래내역 불러오기</h3>
          <button onClick={close} className="text-foreground-secondary hover:text-foreground" title="닫기">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {/* 파일 선택 */}
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-surface-secondary px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[13px] text-foreground-secondary">
              하나은행 <b className="font-medium text-foreground">거래내역조회</b> 엑셀(.xlsx/.xls)을 올리면 출금 건을
              월지출로 정리합니다. 카드 결제는 달마다 합쳐 &lsquo;{CARD_LABEL}&rsquo;로 넣습니다. 파일은 서버로 보내지
              않고 이 화면에서만 읽습니다.
            </div>
            <label className="flex h-9 flex-shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground hover:bg-surface-secondary transition-colors">
              <FileSpreadsheet size={15} strokeWidth={1.5} />
              {fileName ? '다른 파일' : '파일 선택'}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={parsing || saving}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void analyze(f);
                }}
              />
            </label>
          </div>

          {parsing && <p className="text-[13px] text-foreground-secondary">파일을 읽는 중…</p>}

          {hasPlan && (
            <>
              <div className="text-[13px] text-foreground-secondary">
                <span className="font-medium text-foreground">{fileName}</span>
                {range && (
                  <>
                    {' '}
                    · {range.from} ~ {range.to}
                  </>
                )}{' '}
                · 출금 {txs.length + cards.reduce((s, c) => s + c.txs.length, 0)}건
              </div>

              {/* 카드값 */}
              {cards.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h4 className="text-[13px] font-semibold text-foreground">카드값 (월별 합계)</h4>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full min-w-[620px] text-[13px]">
                      <tbody className="divide-y divide-border">
                        {cards.map((c) => (
                          <tr key={c.key} className={savedKeys.has(c.key) ? 'opacity-50' : undefined}>
                            <td className="w-[110px] px-4 py-2.5 font-medium text-foreground">{monthLabel(c.month)}</td>
                            <td className="w-[130px] px-4 py-2.5 text-right font-mono text-foreground">{won(c.amount)}</td>
                            <td className="px-4 py-2.5 text-[12px] text-foreground-secondary">
                              {c.txs.length}건 결제{c.reason && <> · {c.reason}</>}
                            </td>
                            <td className="w-[150px] px-4 py-2.5">
                              <select
                                value={c.action}
                                disabled={saving || savedKeys.has(c.key)}
                                onChange={(e) => setCard(c.key, e.target.value as CardAction)}
                                className="h-8 w-full rounded-lg border border-border bg-white px-2 text-[12px] text-foreground"
                              >
                                {c.existing ? (
                                  <option value="update">기존 값 수정</option>
                                ) : (
                                  <option value="add">월지출 추가</option>
                                )}
                                <option value="skip">건너뜀</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* 출금 건 */}
              <section className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-[13px] font-semibold text-foreground">출금 건</h4>
                  <div className="flex flex-wrap gap-1">
                    {FILTERS.map((f) => {
                      const n = f.value === 'all' ? txs.length : counts[f.value];
                      const active = filter === f.value;
                      return (
                        <button
                          key={f.value}
                          onClick={() => setFilter(f.value)}
                          className={`h-7 rounded-full px-3 text-[12px] transition-colors ${
                            active
                              ? 'bg-sidebar text-white'
                              : 'border border-border text-foreground-secondary hover:bg-surface-secondary'
                          }`}
                        >
                          {f.label} {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[720px] text-[13px]">
                    <thead>
                      <tr className="bg-surface-secondary text-[12px]">
                        <th className="w-[60px] px-3 py-2 text-left font-semibold text-foreground-secondary">날짜</th>
                        <th className="px-3 py-2 text-left font-semibold text-foreground-secondary">항목명 / 근거</th>
                        <th className="w-[120px] px-3 py-2 text-right font-semibold text-foreground-secondary">금액</th>
                        <th className="w-[160px] px-3 py-2 text-left font-semibold text-foreground-secondary">처리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visible.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-foreground-tertiary">
                            해당하는 출금 건이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        visible.map((t) => {
                          const isAdd = t.action === 'add';
                          const saved = savedKeys.has(t.key);
                          return (
                            <tr key={t.key} className={!isAdd || saved ? 'bg-surface-secondary/40' : undefined}>
                              <td className="px-3 py-2 align-top font-mono text-[12px] text-foreground-secondary">
                                {md(t.tx.date)}
                              </td>
                              <td className="px-3 py-2 align-top">
                                {isAdd && !saved ? (
                                  <input
                                    value={t.label}
                                    disabled={saving}
                                    onChange={(e) => setTx(t.key, { label: e.target.value })}
                                    className="h-8 w-full rounded-lg border border-border bg-white px-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                  />
                                ) : (
                                  <span className={isAdd ? 'text-foreground' : 'text-foreground-secondary'}>{t.label}</span>
                                )}
                                <p className="mt-1 text-[11px] text-foreground-quaternary">
                                  {saved ? '저장됨' : t.reason || t.memo}
                                </p>
                              </td>
                              <td className="px-3 py-2 text-right align-top font-mono text-foreground">{won(t.tx.amount)}</td>
                              <td className="px-3 py-2 align-top">
                                <select
                                  value={t.action}
                                  disabled={saving || saved}
                                  onChange={(e) => setTx(t.key, { action: e.target.value as TxAction })}
                                  className="h-8 w-full rounded-lg border border-border bg-white px-2 text-[12px] text-foreground"
                                >
                                  {TX_ACTIONS.map((a) => (
                                    <option key={a.value} value={a.value}>
                                      {a.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {error && <p className="text-[13px] text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <span className="text-[12px] text-foreground-secondary">
            {progress ||
              (hasPlan
                ? `등록할 건: 카드값 ${cardWrites}건 + 월지출 ${txWrites}건`
                : '파일을 선택하면 등록 전에 미리 보여드립니다.')}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={close}
              disabled={saving}
              className="h-9 rounded-xl border border-border px-4 text-[13px] text-foreground hover:bg-surface-secondary disabled:opacity-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => void register()}
              disabled={saving || writes === 0}
              className="h-9 rounded-xl bg-primary px-5 text-[13px] font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {saving ? '저장 중…' : `${writes}건 등록`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
