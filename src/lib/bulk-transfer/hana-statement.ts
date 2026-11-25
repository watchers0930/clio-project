import { memoLines } from './memo-lines';

// 하나은행 '거래내역조회' 엑셀 → 월지출 불러오기 계획 (순수 함수)
//
// 1) parseStatement: 시트를 2차원 배열로 받아 헤더(거래일시·출금…)를 찾고 출금 건만 뽑는다.
// 2) planImport: 기존 고정지출·월지출과 비교해 건마다 기본 처리(추가/고정지출/이미 등록/제외)를 정하고,
//    카드 결제는 월별로 합쳐 '카드값' 한 건으로 만든다. 최종 결정은 화면에서 사용자가 바꿀 수 있다.

export interface StatementTx {
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'YYYY-MM' */
  month: string;
  summary: string; // 적요
  memo: string; // 메모
  counterparty: string; // 의뢰인/수취인
  amount: number; // 출금액
  kind: string; // 구분 (타행송금, 자동이체, 하나카드 …)
}

export interface ParseResult {
  txs: StatementTx[];
  /** 기간(첫·마지막 거래일), 출금 건이 없으면 null */
  range: { from: string; to: string } | null;
}

const HEADER_KEYS = {
  date: ['거래일시', '거래일자', '거래일'],
  summary: ['적요'],
  memo: ['메모'],
  counterparty: ['의뢰인/수취인', '수취인', '의뢰인', '받는분'],
  withdraw: ['출금', '출금액', '찾으신금액'],
  kind: ['구분', '거래구분'],
} as const;

const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, '').trim();

function findCol(header: string[], keys: readonly string[]): number {
  for (const k of keys) {
    const i = header.indexOf(k);
    if (i >= 0) return i;
  }
  return -1;
}

/** 엑셀 날짜 일련번호(1900 체계) 또는 'YYYY-MM-DD …' 문자열 → 'YYYY-MM-DD' */
export function toDate(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const m = String(v ?? '').match(/(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

function toAmount(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : 0;
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** 시트 2차원 배열 → 출금 거래 목록. 헤더를 못 찾으면 에러 */
export function parseStatement(rows: unknown[][]): ParseResult {
  const headerIdx = rows.findIndex((r) => {
    const h = (r ?? []).map(norm);
    return findCol(h, HEADER_KEYS.date) >= 0 && findCol(h, HEADER_KEYS.withdraw) >= 0;
  });
  if (headerIdx < 0) {
    throw new Error('거래내역 표 머리글(거래일시·출금)을 찾지 못했습니다. 하나은행 거래내역조회 엑셀인지 확인해 주세요.');
  }
  const header = rows[headerIdx].map(norm);
  const col = {
    date: findCol(header, HEADER_KEYS.date),
    summary: findCol(header, HEADER_KEYS.summary),
    memo: findCol(header, HEADER_KEYS.memo),
    counterparty: findCol(header, HEADER_KEYS.counterparty),
    withdraw: findCol(header, HEADER_KEYS.withdraw),
    kind: findCol(header, HEADER_KEYS.kind),
  };
  const cell = (r: unknown[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '');

  const txs: StatementTx[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    if (!r) continue;
    const date = toDate(r[col.date]);
    const amount = toAmount(r[col.withdraw]);
    if (!date || amount <= 0) continue; // 합계 줄·입금 건 제외
    txs.push({
      date,
      month: date.slice(0, 7),
      summary: cell(r, col.summary),
      memo: cell(r, col.memo),
      counterparty: cell(r, col.counterparty),
      amount,
      kind: cell(r, col.kind),
    });
  }
  txs.sort((a, b) => a.date.localeCompare(b.date));
  return { txs, range: txs.length ? { from: txs[0].date, to: txs[txs.length - 1].date } : null };
}

// ── 분류 ──────────────────────────────────────────────────────────────

export type TxAction = 'add' | 'fixed' | 'duplicate' | 'skip';
export type CardAction = 'add' | 'update' | 'skip';

export interface PlannedTx {
  key: string;
  tx: StatementTx;
  label: string;
  memo: string;
  action: TxAction;
  /** 기본 처리 이유 (화면 표시용) */
  reason: string;
}

export interface PlannedCard {
  key: string;
  month: string;
  amount: number;
  memo: string;
  txs: StatementTx[];
  /** 같은 달에 이미 있는 '카드값' */
  existing: { id: string; amount: number } | null;
  action: CardAction;
  reason: string;
}

export interface ImportPlan {
  txs: PlannedTx[];
  cards: PlannedCard[];
}

interface FixedLike {
  label: string;
  amount: number | string;
  memo: string | null;
}
interface MonthlyLike {
  id: string;
  label: string;
  amount: number | string;
  month: string;
}

export const CARD_LABEL = '카드값';

/** 은행이 자동으로 빼가는 반복 출금 구분 → 고정지출로 본다 */
const FIXED_KINDS = ['자동이체', '지로', '국민연금', '대출이자', 'CMS', '공공요금', '공과금'];
/** 매달 금액이 바뀌는 세금 — 금액으로는 못 맞추므로 낱말로 고정지출(지방세·국세)로 본다 */
const TAX_RE = /소득세|원천세|지방세|국세|국고|부가세|부가가치세/;
/** 고정지출 이름·메모에서 뽑은 낱말 중 매칭에 쓰지 않을 일반어 */
const STOP_WORDS = new Set([
  '매월', '매달', '자동이체', '자동출금', '기준', '변동', '확인필요', '대략', '수정필', '금액', '지출', '합계',
  '결제', '월분', '부터', '프로플랜', '유료플랜', '시트', '세전금액', '지로', '중순', '이자',
]);

export function isCardTx(tx: StatementTx): boolean {
  return /카드/.test(tx.kind) || /카드결제|카드대금|하나카드/.test(tx.summary);
}

interface FixedMatcher {
  label: string;
  tokens: string[];
  /** 이 금액 범위 안이어야 해당으로 본다 */
  min: number;
  max: number;
}

const words = (s: string) => [...new Set((s.match(/[가-힣]{2,}/g) ?? []).filter((w) => !STOP_WORDS.has(w)))];

/**
 * 고정지출 매칭 규칙. 항목명 낱말은 항목 금액의 1.5배 이하,
 * 메모 조각('홍길동 2,000,000'처럼 금액이 함께 적힌 것)의 낱말은 그 금액 ±30% 안일 때만 해당으로 본다.
 */
export function fixedMatchers(fixed: FixedLike[]): FixedMatcher[] {
  const out: FixedMatcher[] = [];
  for (const f of fixed) {
    const amount = Number(f.amount);
    const whole = { min: 0, max: amount * 1.5 };
    out.push({ label: f.label, tokens: words(f.label), ...whole });
    for (const seg of memoLines(f.memo)) {
      const m = seg.match(/\d{1,3}(?:,\d{3})+|\d{4,}/);
      const segAmt = m ? Number(m[0].replace(/,/g, '')) : 0;
      const range = segAmt > 0 ? { min: segAmt * 0.7, max: segAmt * 1.3 } : whole;
      out.push({ label: f.label, tokens: words(seg), ...range });
    }
  }
  return out.filter((m) => m.tokens.length > 0);
}

/** 회사 접두·접미어를 걷어낸 상대방 이름 */
export function cleanName(s: string): string {
  return s
    .replace(/주식회사|\(주\)|㈜/g, '')
    .replace(/\s+주$/, '')
    .replace(/_.*$/, '')
    .trim();
}

function txLabel(tx: StatementTx): string {
  const party = cleanName(tx.counterparty);
  const summary = tx.summary.trim();
  const summaryUseful = summary && !/^\d[\d-]*$/.test(summary) && cleanName(summary) !== party;
  if (summaryUseful) return summary;
  return party || summary || tx.kind || '출금';
}

function txMemo(tx: StatementTx, label: string): string {
  const [, m, d] = tx.date.split('-');
  const parts = [`${Number(m)}/${Number(d)}`];
  const party = cleanName(tx.counterparty);
  if (party && party !== label) parts.push(party);
  if (tx.memo) parts.push(tx.memo);
  if (tx.kind) parts.push(tx.kind);
  return parts.join(' · ');
}

const won = (n: number) => n.toLocaleString('ko-KR');

/**
 * 출금 건마다 기본 처리를 정한다.
 * - 카드 결제 → 월별 합계 '카드값' (같은 달 기존 값이 있으면 수정, 새 합계가 더 작으면 파일이 그 달 일부일 수 있어 건너뜀)
 * - 고정지출로 보이는 건 → fixed (구분이 자동 출금류이거나, 고정지출 낱말이 들어 있고 금액이 맞을 때 — fixedMatchers)
 * - 같은 달·같은 금액 월지출이 이미 있으면 → duplicate
 * - 나머지 → add
 */
export function planImport(txs: StatementTx[], fixed: FixedLike[], monthly: MonthlyLike[]): ImportPlan {
  const matchers = fixedMatchers(fixed);
  // 같은 달·금액 기존 월지출 (카드값 제외) — 한 기존 건은 한 번만 중복으로 소모
  const pool = new Map<string, number>();
  for (const e of monthly) {
    if (e.label === CARD_LABEL) continue;
    const k = `${e.month}|${Number(e.amount)}`;
    pool.set(k, (pool.get(k) ?? 0) + 1);
  }

  const planned: PlannedTx[] = [];
  const cardByMonth = new Map<string, StatementTx[]>();

  txs.forEach((tx, i) => {
    if (isCardTx(tx)) {
      cardByMonth.set(tx.month, [...(cardByMonth.get(tx.month) ?? []), tx]);
      return;
    }
    const label = txLabel(tx);
    const memo = txMemo(tx, label);
    const key = `tx-${i}`;
    const text = `${tx.summary} ${tx.counterparty} ${tx.memo}`;

    const dupKey = `${tx.month}|${tx.amount}`;
    if ((pool.get(dupKey) ?? 0) > 0) {
      pool.set(dupKey, (pool.get(dupKey) ?? 0) - 1);
      planned.push({ key, tx, label, memo, action: 'duplicate', reason: '같은 달·같은 금액이 이미 월지출에 있음' });
      return;
    }
    const kindHit = FIXED_KINDS.find((k) => tx.kind.includes(k));
    if (kindHit) {
      planned.push({ key, tx, label, memo, action: 'fixed', reason: `${tx.kind} — 고정지출로 관리` });
      return;
    }
    if (TAX_RE.test(`${tx.summary} ${tx.counterparty}`)) {
      planned.push({ key, tx, label, memo, action: 'fixed', reason: '세금 — 고정지출 지방세·국세로 관리' });
      return;
    }
    const fixedHit = matchers.find(
      (f) => tx.amount >= f.min && tx.amount <= f.max && f.tokens.some((t) => text.includes(t)),
    );
    if (fixedHit) {
      planned.push({ key, tx, label, memo, action: 'fixed', reason: `고정지출 '${fixedHit.label}'에 해당` });
      return;
    }
    planned.push({ key, tx, label, memo, action: 'add', reason: '' });
  });

  const cards: PlannedCard[] = [...cardByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, list]) => {
      const amount = list.reduce((s, t) => s + t.amount, 0);
      const memo =
        list.map((t) => `${Number(t.date.slice(5, 7))}/${Number(t.date.slice(8, 10))} ${won(t.amount)}`).join(' · ') +
        ' (카드 결제)';
      const ex = monthly.find((e) => e.month === month && e.label === CARD_LABEL);
      const existing = ex ? { id: ex.id, amount: Number(ex.amount) } : null;
      let action: CardAction = 'add';
      let reason = '';
      if (existing) {
        if (existing.amount === amount) {
          action = 'skip';
          reason = '이미 같은 금액으로 등록됨';
        } else if (amount < existing.amount) {
          action = 'skip';
          reason = `기존 ${won(existing.amount)}원보다 작음 — 파일이 그 달 일부만 담았을 수 있음`;
        } else {
          action = 'update';
          reason = `기존 ${won(existing.amount)}원 → ${won(amount)}원`;
        }
      }
      return { key: `card-${month}`, month, amount, memo, txs: list, existing, action, reason };
    });

  return { txs: planned, cards };
}
