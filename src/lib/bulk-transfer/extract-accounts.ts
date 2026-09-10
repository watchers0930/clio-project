/**
 * AI 계좌 추출 유틸 (대량이체)
 * 납부서/청구서/세금계산서/거래명세서에서 입금 계좌·금액·적요를 추출한다.
 * - PDF/이미지: GPT-4o Vision(Responses API)에 목적특화 프롬프트로 직접 추출
 *   (범용 "모든 텍스트 추출" OCR은 개인정보 우려로 거부되므로 목적을 명시)
 * - 텍스트 문서: 추출된 텍스트로 추출
 */
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getBankName, normalizeBankToCode } from './bank-codes';

const MAX_CHARS = 12000;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export interface ExtractedAccount {
  bank_code: string;
  bank_name: string;
  account: string; // 하이픈 제외 숫자
  account_display: string; // 원문 표기
}

export interface AccountExtractResult {
  title: string;
  payee_name: string;
  amount: number | null;
  memo: string | null;
  holder: string | null;
  due_date: string | null;
  accounts: ExtractedAccount[];
}

const INSTRUCTION = `당신은 한국의 세금 납부서·공과금 고지서·청구서·세금계산서·거래명세서에서 "입금(이체)할 계좌 정보"를 추출하는 전문가입니다. 이 문서는 사용자 본인의 것으로, 사용자가 이체를 위해 계좌 정보를 정리하려는 목적입니다.
문서에 인쇄된 입금 가능한 모든 은행 계좌를 빠짐없이, 숫자 하나도 틀리지 않게 정확히 읽어 JSON으로만 반환하세요.

JSON 형식:
{
  "title": "문서 제목/발행처 (예: 지방소득세, 전기요금, OO건설 청구서)",
  "payee_name": "수취인/거래처명 (예: 강남구청, 한국전력). 불명확하면 title과 동일",
  "amount": 납부/청구 금액 숫자(콤마·원 제외), 불명확하면 null,
  "memo": "적요로 쓸 짧은 문구(세목·전자납부번호·청구번호). 없으면 null",
  "holder": "예금주명, 없으면 null",
  "due_date": "납부기한 YYYY-MM-DD, 없으면 null",
  "accounts": [ { "bank_name": "문서에 적힌 은행명", "account": "계좌번호(하이픈 포함 원문 그대로)" } ]
}

규칙:
- accounts에는 문서에 나열된 모든 은행 계좌를 포함하세요. 은행별 납부 전용계좌가 여러 개면 전부 넣습니다.
- 계좌번호는 문서에 표기된 숫자를 정확히 그대로(하이픈 포함) 넣으세요. 추측하거나 임의로 바꾸지 마세요.
- 은행명이 없는 식별번호(전자납부번호 등)는 accounts에 넣지 말고 memo에 참고로 넣으세요.
- 금액이 여러 개면 "합계/납부할 세액/청구금액"의 최종 금액을 amount로 하세요.`;

interface RawAccount {
  bank_name?: unknown;
  account?: unknown;
}

/** GPT 응답 JSON → 정규화된 결과 (은행코드 매핑·계좌 숫자화·중복제거·하나은행 우선) */
function normalizeResult(parsed: Record<string, unknown>): AccountExtractResult {
  const rawAccounts = Array.isArray(parsed.accounts) ? (parsed.accounts as RawAccount[]) : [];
  const seen = new Set<string>();
  const accounts: ExtractedAccount[] = [];
  for (const r of rawAccounts) {
    const bankNameRaw = typeof r.bank_name === 'string' ? r.bank_name : '';
    const acctRaw = typeof r.account === 'string' ? r.account : String(r.account ?? '');
    const digits = acctRaw.replace(/\D/g, '');
    if (digits.length < 6 || digits.length > 20) continue;
    const code = normalizeBankToCode(bankNameRaw);
    if (!code) continue;
    const key = `${code}:${digits}`;
    if (seen.has(key)) continue;
    seen.add(key);
    accounts.push({ bank_code: code, bank_name: getBankName(code), account: digits, account_display: acctRaw.trim() });
  }
  accounts.sort((a, b) => (a.bank_code === '081' ? -1 : 0) - (b.bank_code === '081' ? -1 : 0));

  const num = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
    if (typeof v === 'string') {
      const n = Number(v.replace(/[^\d.]/g, ''));
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    }
    return null;
  };
  const str = (v: unknown): string | null => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s || null;
  };
  const due = str(parsed.due_date);

  return {
    title: str(parsed.title) ?? '',
    payee_name: str(parsed.payee_name) ?? str(parsed.title) ?? '',
    amount: num(parsed.amount),
    memo: str(parsed.memo),
    holder: str(parsed.holder),
    due_date: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
    accounts,
  };
}

const EMPTY: AccountExtractResult = {
  title: '', payee_name: '', amount: null, memo: null, holder: null, due_date: null, accounts: [],
};

function parseJson(responseText: string): Record<string, unknown> | null {
  try {
    const cleaned = responseText.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 텍스트 문서(추출된 텍스트) → 계좌 추출 */
export async function extractAccountsFromText(text: string): Promise<AccountExtractResult> {
  const truncated = (text ?? '').slice(0, MAX_CHARS);
  if (!truncated.trim()) return EMPTY;
  try {
    const { text: res } = await generateText({
      model: openai('gpt-4o'),
      system: INSTRUCTION,
      prompt: `다음 문서에서 입금 계좌 정보를 추출하세요:\n\n${truncated}`,
      maxOutputTokens: 1500,
      temperature: 0,
    });
    const parsed = parseJson(res);
    return parsed ? normalizeResult(parsed) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** PDF/이미지 → GPT-4o Vision으로 직접 계좌 추출 (목적특화 프롬프트로 거부 회피) */
export async function extractAccountsFromPdf(buffer: ArrayBuffer, mimeType: string): Promise<AccountExtractResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || buffer.byteLength > MAX_PDF_BYTES) return EMPTY;

  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey });
    const base64 = Buffer.from(buffer).toString('base64');
    const isPdf = mimeType === 'application/pdf' || !mimeType.startsWith('image/');

    const filePart = isPdf
      ? { type: 'input_file' as const, filename: 'document.pdf', file_data: `data:application/pdf;base64,${base64}` }
      : { type: 'input_image' as const, image_url: `data:${mimeType};base64,${base64}`, detail: 'high' as const };

    const response = await client.responses.create({
      model: 'gpt-4o',
      input: [{ role: 'user', content: [filePart, { type: 'input_text', text: INSTRUCTION }] }],
    });

    const parsed = parseJson(response.output_text ?? '');
    return parsed ? normalizeResult(parsed) : EMPTY;
  } catch {
    return EMPTY;
  }
}
