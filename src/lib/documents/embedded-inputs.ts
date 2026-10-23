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
