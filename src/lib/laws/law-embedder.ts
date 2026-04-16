/**
 * 법령 청크 임베딩 생성 유틸리티
 * 기존 lib/ai/embeddings.ts의 generateEmbedding을 재사용
 */

export { generateEmbedding } from '@/lib/ai/embeddings';

/**
 * 배치 단위로 임베딩 생성 (batchSize개씩 순차 처리)
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize = 10,
): Promise<number[][]> {
  const { generateEmbedding } = await import('@/lib/ai/embeddings');
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(
      batch.map((text) => generateEmbedding(text.slice(0, 8000))),
    );
    results.push(...embeddings);

    // Rate limit 보호
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return results;
}
