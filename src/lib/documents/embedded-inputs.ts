/**
 * 문서 본문 맨 앞에 임베드되는 입력값 메타 주석
 * (<!--DOCUMENT_INPUTS:...--> / <!--PROPOSAL_INPUTS:...-->) 처리 유틸.
 *
 * 이 주석은 레이아웃(서버 양식) 렌더 시 입력값을 복원하는 내부 메타데이터로,
 * 저장 content에는 보존되어야 하지만 사용자에게 보이는 편집 화면에는 노출되면 안 된다.
 */

/** content 맨 앞의 입력값 메타 주석 1건을 매칭하는 정규식(JSON은 1줄 가정). */
const EMBEDDED_INPUTS_RE = /^<!--(?:PROPOSAL_INPUTS|DOCUMENT_INPUTS):.*?-->\n?/;

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
  const match = content.match(/^<!--DOCUMENT_INPUTS:([^\r\n]*?)-->(?:\r?\n)?/);
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
  // JSON unicode escapes are decoded by JSON.parse; raw comment terminators never enter HTML.
  const serialized = JSON.stringify(merged).replace(/-->/g, '--\\u003e');
  const commentEnd = content.indexOf('-->') + 3;
  return { ok: true, content: `<!--DOCUMENT_INPUTS:${serialized}-->${content.slice(commentEnd)}`, changed: true };
}
