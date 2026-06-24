/**
 * 텍스트를 토큰 기반으로 청킹
 * 단락 > 문장 > 단어 경계 우선 분할
 */

export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
}

/** 간이 토큰 카운트 (한국어/영어 혼합 근사치) */
function estimateTokens(text: string): number {
  // 영어: ~4글자/토큰, 한국어: ~2글자/토큰 → 평균 ~3
  return Math.ceil(text.length / 3);
}

// OpenAI text-embedding-3-small 최대 8192 토큰
// 한국어 1자 ≈ 2-3 BPE 토큰 → 4000자 제한으로 안전 마진 확보
const HARD_CAP_CHARS = 4000;

export function chunkText(
  text: string,
  options?: { maxTokens?: number; overlap?: number },
): TextChunk[] {
  const maxTokens = options?.maxTokens ?? 500;
  const overlap = options?.overlap ?? 50;
  const overlapChars = overlap * 3;

  if (!text.trim()) return [];

  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  /** 청크를 push할 때 hard cap 초과 시 강제 분할 */
  function pushChunk(content: string) {
    content = content.trim();
    if (!content) return;
    while (content.length > HARD_CAP_CHARS) {
      const slice = content.slice(0, HARD_CAP_CHARS);
      chunks.push({ content: slice, index: chunkIndex++, tokenCount: estimateTokens(slice) });
      // 오버랩 유지하며 나머지 처리
      content = content.slice(HARD_CAP_CHARS - overlapChars).trim();
    }
    if (content) {
      chunks.push({ content, index: chunkIndex++, tokenCount: estimateTokens(content) });
    }
  }

  // 먼저 단락 단위로 분할
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

  let currentChunk = '';

  for (const para of paragraphs) {
    // 단락 자체가 maxTokens보다 크면 문장 단위로 분할
    if (estimateTokens(para) > maxTokens) {
      // 현재 버퍼가 있으면 먼저 flush
      if (currentChunk.trim()) {
        pushChunk(currentChunk);
        currentChunk = '';
      }

      // 큰 단락을 문장 단위로 분할
      const sentences = para.split(/(?<=[.!?。]\s)/).filter((s) => s.trim());
      for (const sentence of sentences) {
        if (estimateTokens(currentChunk + sentence) > maxTokens && currentChunk.trim()) {
          pushChunk(currentChunk);
          // 오버랩: 이전 청크의 마지막 부분 유지
          const overlapText = currentChunk.slice(-overlapChars);
          currentChunk = overlapText + sentence;
        } else {
          currentChunk += sentence;
        }
      }
      continue;
    }

    // 현재 청크에 단락 추가 시 초과하는지 확인
    const combined = currentChunk ? currentChunk + '\n\n' + para : para;
    if (estimateTokens(combined) > maxTokens && currentChunk.trim()) {
      pushChunk(currentChunk);
      // 오버랩
      const overlapText = currentChunk.slice(-overlapChars);
      currentChunk = overlapText + '\n\n' + para;
    } else {
      currentChunk = combined;
    }
  }

  // 마지막 청크
  if (currentChunk.trim()) {
    pushChunk(currentChunk);
  }

  return chunks;
}
