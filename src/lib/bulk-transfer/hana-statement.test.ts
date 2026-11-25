import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStatement, planImport, toDate, cleanName } from './hana-statement';

const HEADER = ['No', '거래일시', '적요', '메모', '의뢰인/수취인', '입금', '출금', '거래후잔액', '구분', '거래점', '거래특이사항'];
const row = (date: string, summary: string, party: string, out: number | string, kind: string, memo = '') =>
  [1, date, summary, memo, party, '', out, 0, kind, '', ''];

const sheet: unknown[][] = [
  ['거래내역조회'],
  HEADER,
  row('2026-11-25 12:51:45', '홍길동', '홍길동', 2000000, '당행송금'),
  row('2026-11-25 12:34:51', '가나세무회계-H', '', 100000, '자동이체'),
  row('2026-11-16 10:14:35', '하나카드결제', '', 2800000, '하나카드'),
  row('2026-11-05 11:54:26', '하나카드결제', '', 500000, '하나카드'),
  row('2026-11-13 11:23:21', '명함인쇄', '박민수', '30,000', '타행송금'),
  row('2026-11-03 16:15:35', '임대료-11월', '최임대(가나빌딩)', 600000, '타행송금'),
  row('2026-10-02 09:55:15', '사무실 임대계약 잔금', '최임대(가나빌딩)', 5000000, '타행송금'),
  row('2026-10-19 15:29:30', '호스팅', '', 30000, '대체'),
  row('2026-09-30 10:16:19', '가나테크', '주식회사 가나테크', 100000000, '타행송금'),
  [1, '2026-10-01 10:00:00', '입금건', '', '누군가', 500000, '', 0, '타행입금', '', ''],
  ['', '합   계', '', '', '', 0, 999, '', '', '', ''],
];

const fixed = [
  { label: '월급여', amount: 10000000, memo: '김철수 3,000,000 / 이영희 2,500,000 / 박민수 2,500,000 / 홍길동 2,000,000' },
  { label: '임대료', amount: 600000, memo: '최임대(가나빌딩) · 매월 초' },
  { label: '세무기장료', amount: 100000, memo: '가나세무회계 · 자동이체 매월 25~28일' },
];

test('toDate: 문자열·엑셀 일련번호', () => {
  assert.equal(toDate('2026-11-25 12:54:10'), '2026-11-25');
  assert.equal(toDate('2026.9.4'), '2026-09-04');
  assert.equal(toDate(46351), '2026-11-25');
  assert.equal(toDate('합   계'), null);
});

test('cleanName: 회사 접두·접미 제거', () => {
  assert.equal(cleanName('주식회사 가나테크'), '가나테크');
  assert.equal(cleanName('다라솔루션 주'), '다라솔루션');
  assert.equal(cleanName('국고_주식회사 예시상사'), '국고');
});

test('parseStatement: 머리글을 찾아 출금 건만, 날짜순', () => {
  const { txs, range } = parseStatement(sheet);
  assert.equal(txs.length, 9);
  assert.deepEqual(range, { from: '2026-09-30', to: '2026-11-25' });
  assert.equal(txs.find((t) => t.summary === '명함인쇄')?.amount, 30000);
  assert.ok(!txs.some((t) => t.summary === '입금건'));
});

test('parseStatement: 머리글이 없으면 에러', () => {
  assert.throws(() => parseStatement([['a', 'b'], [1, 2]]), /머리글/);
});

test('planImport: 카드 월별 합산, 고정지출·추가 분류', () => {
  const { txs } = parseStatement(sheet);
  const plan = planImport(txs, fixed, []);
  const by = (s: string) => plan.txs.find((p) => p.tx.summary === s)!;

  assert.equal(plan.cards.length, 1);
  assert.equal(plan.cards[0].month, '2026-11');
  assert.equal(plan.cards[0].amount, 3300000);
  assert.equal(plan.cards[0].action, 'add');

  assert.equal(by('홍길동').action, 'fixed'); // 월급여 메모의 이름
  assert.equal(by('가나세무회계-H').action, 'fixed'); // 자동이체
  assert.equal(by('임대료-11월').action, 'fixed');
  assert.equal(by('사무실 임대계약 잔금').action, 'add'); // 같은 상대방이라도 금액이 임대료의 1.5배 초과
  assert.equal(by('명함인쇄').action, 'add'); // 박민수는 급여 메모에 있지만 금액(2,500,000 ±30%)이 다름
});

test('planImport: 급여 대상자에게 보낸 큰 금액(밀린 급여 등)은 고정지출로 보지 않음', () => {
  const plan = planImport(
    [{ date: '2026-09-04', month: '2026-09', summary: '급여3456', memo: '', counterparty: '이영희', amount: 9000000, kind: '타행송금' }],
    fixed,
    [],
  );
  assert.equal(plan.txs[0].action, 'add');
});

test('planImport: 라벨·메모 — 적요 우선, 상대방은 메모로', () => {
  const { txs } = parseStatement(sheet);
  const plan = planImport(txs, [], []);
  const win = plan.txs.find((p) => p.tx.summary === '가나테크')!;
  assert.equal(win.label, '가나테크');
  assert.equal(win.memo, '9/30 · 타행송금');
  const card = plan.txs.find((p) => p.tx.summary === '명함인쇄')!;
  assert.equal(card.label, '명함인쇄');
  assert.equal(card.memo, '11/13 · 박민수 · 타행송금');
});

test('planImport: 이미 등록된 월지출은 duplicate, 카드값은 기존과 비교', () => {
  const { txs } = parseStatement(sheet);
  const monthly = [
    { id: 'a', label: '호스팅', amount: 30000, month: '2026-10' },
    { id: 'c', label: '카드값', amount: 3700000, month: '2026-11' },
  ];
  const plan = planImport(txs, [], monthly);
  assert.equal(plan.txs.find((p) => p.tx.summary === '호스팅')!.action, 'duplicate');
  assert.equal(plan.cards[0].action, 'skip'); // 새 합계(3,300,000)가 기존보다 작음
  const bigger = planImport(txs, [], [{ id: 'c', label: '카드값', amount: 1000000, month: '2026-11' }]);
  assert.equal(bigger.cards[0].action, 'update');
  const same = planImport(txs, [], [{ id: 'c', label: '카드값', amount: 3300000, month: '2026-11' }]);
  assert.equal(same.cards[0].action, 'skip');
});

test('planImport: 세금은 금액이 달라도 고정지출', () => {
  const plan = planImport(
    [{ date: '2026-09-30', month: '2026-09', summary: '지방소득세', memo: '', counterparty: '', amount: 7000, kind: '대체' }],
    [],
    [],
  );
  assert.equal(plan.txs[0].action, 'fixed');
});
