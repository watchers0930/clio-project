/**
 * 문서 본문 맨 앞에 임베드되는 입력값 메타 주석
 * (<!--DOCUMENT_INPUTS:...--> / <!--PROPOSAL_INPUTS:...-->) 처리 유틸.
 *
 * 이 주석은 레이아웃(서버 양식) 렌더 시 입력값을 복원하는 내부 메타데이터로,
 * 저장 content에는 보존되어야 하지만 사용자에게 보이는 편집 화면에는 노출되면 안 된다.
 */

/**
 * content 맨 앞의 입력값 메타 주석 1건(첫 줄 전체). JSON.stringify 는 줄바꿈을 이스케이프하므로 주석은 항상 한 줄이다.
 * 첫 줄의 '마지막' --> 까지 잡는다 — 옛 저장분 중 값 안의 '-->' 를 이스케이프하지 않은 경우에도 중간에서 끊기지 않게.
 */
const EMBEDDED_INPUTS_RE = /^<!--(?:PROPOSAL_INPUTS|DOCUMENT_INPUTS):[^\r\n]*-->(?:\r?\n)?/;

/** 입력값 메타 주석을 제거한 본문을 반환한다(없으면 원본 그대로). */
export function stripEmbeddedInputs(content: string): string {
  return content.replace(EMBEDDED_INPUTS_RE, '');
}

/** content 맨 앞의 입력값 메타 주석 접두부를 반환한다(없으면 빈 문자열). */
export function getEmbeddedInputsPrefix(content: string): string {
  const match = content.match(EMBEDDED_INPUTS_RE);
  return match ? match[0] : '';
}


export type ParseEmbeddedInputsResult =
  | { ok: true; inputs: Record<string, string>; prefix: string }
  | { ok: false; reason: 'no-comment' | 'proposal' | 'invalid-json' | 'invalid-shape' };

/** Only the leading, single-line DOCUMENT_INPUTS comment is editable. */
export function parseEmbeddedInputs(content: string): ParseEmbeddedInputsResult {
  if (content.startsWith('<!--PROPOSAL_INPUTS:')) return { ok: false, reason: 'proposal' };
  if (!content.startsWith('<!--DOCUMENT_INPUTS:')) return { ok: false, reason: 'no-comment' };
  const match = content.match(/^<!--DOCUMENT_INPUTS:([^\r\n]*)-->(?:\r?\n)?/);
  if (!match) return { ok: false, reason: 'invalid-json' };
  let inputs: unknown;
  try { inputs = JSON.parse(match[1]); }
  catch { return { ok: false, reason: 'invalid-json' }; }
  if (!isStringRecord(inputs)) return { ok: false, reason: 'invalid-shape' };
  return { ok: true, inputs, prefix: match[0] };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
    && Object.values(value).every((entry) => typeof entry === 'string');
}

export type BuildContentResult =
  | { ok: true; content: string; changed: boolean }
  | { ok: false; reason: 'no-comment' | 'proposal' | 'invalid-json' | 'invalid-shape' };

export function buildContentWithInputs(content: string, patch: Record<string, string>): BuildContentResult {
  const parsed = parseEmbeddedInputs(content);
  if (!parsed.ok) return parsed;
  if (!isStringRecord(patch)) return { ok: false, reason: 'invalid-shape' };
  const merged = { ...parsed.inputs, ...patch };
  const keys = Object.keys(merged);
  if (keys.length === Object.keys(parsed.inputs).length
    && keys.every((key) => Object.hasOwn(parsed.inputs, key) && merged[key] === parsed.inputs[key])) {
    return { ok: true, content, changed: false };
  }
  return { ok: true, content: `${serializeInputsComment(merged)}\n${content.slice(parsed.prefix.length)}`, changed: true };
}

/**
 * 입력값을 본문 앞 주석으로 직렬화 — 모든 저장 경로가 이 함수만 쓴다.
 * 값 안의 '-->' 는 이스케이프(JSON.parse 가 되돌림)해 주석이 중간에 닫히지 않게 한다.
 */
export function serializeInputsComment(inputs: Record<string, string>): string {
  return `<!--DOCUMENT_INPUTS:${JSON.stringify(inputs).replace(/-->/g, '--\\u003e')}-->`;
}

export type DocumentInputsSource = { content?: string | null; input_values?: unknown };
export type DocumentInputs = { inputs: Record<string, string>; body: string; hasInputs: boolean };

/**
 * 문서의 입력값과 순수 본문 — 입력값은 DB 칸(input_values)을 먼저, 없으면 본문 주석에서 읽는다.
 * 본문은 언제나 주석을 걷어낸 값이다. 화면 표시·AI 문맥·검색 벡터는 body 만 써야 한다.
 */
export function readDocumentInputs(doc: DocumentInputsSource): DocumentInputs {
  const content = doc.content ?? '';
  const body = stripEmbeddedInputs(content);
  if (isStringRecord(doc.input_values)) {
    return { inputs: doc.input_values, body, hasInputs: true };
  }
  const match = content.match(/^<!--(?:PROPOSAL_INPUTS|DOCUMENT_INPUTS):([^\r\n]*)-->/);
  if (match) {
    try {
      const parsed: unknown = JSON.parse(match[1]);
      if (isStringRecord(parsed)) return { inputs: parsed, body, hasInputs: true };
    } catch { /* 깨진 주석은 입력값 없음으로 본다 */ }
  }
  return { inputs: {}, body, hasInputs: false };
}
