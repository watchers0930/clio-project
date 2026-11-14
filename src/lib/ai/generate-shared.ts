// AI 문서 생성 공용 헬퍼 — 컨텍스트 길이 상수, 참조 자료 결합, JSON 응답 파싱
// generate-document-helpers / generate-office-content / generate-document 등에서 공용으로 사용

export const MAX_CONTEXT_CHARS = 60_000;
export const MAX_TEMPLATE_FILE_CHARS = 30_000;

export function buildContextText(sourceChunks: string[], maxChars = MAX_CONTEXT_CHARS) {
  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > maxChars) break;
    contextText += `${chunk}\n---\n`;
  }
  return contextText;
}

export function parseJsonResponse<T>(text: string, fallback: T): T {
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as T;
      } catch {
        console.error('[generateDocument] JSON 파싱 실패:', jsonStr.slice(0, 200));
      }
    } else {
      console.error('[generateDocument] JSON 파싱 실패:', jsonStr.slice(0, 200));
    }
    return fallback;
  }
}
