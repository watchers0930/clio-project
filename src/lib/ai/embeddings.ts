/**
 * OpenAI 임베딩 생성 + Supabase file_chunks 저장
 */

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TextChunk } from './chunk-text';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 100;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  return new OpenAI({ apiKey });
}

/** 단일 텍스트의 임베딩 생성 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

/** 배치 임베딩 생성 */
async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** 청크를 임베딩 생성 후 Supabase에 저장 */
export async function generateAndStoreChunks(
  supabase: SupabaseClient,
  fileId: string,
  chunks: TextChunk[],
): Promise<{ stored: number; errors: number }> {
  if (chunks.length === 0) return { stored: 0, errors: 0 };

  // 기존 청크 삭제 (멱등성 보장 - 재처리 시 안전)
  await supabase.from('file_chunks').delete().eq('file_id', fileId);

  let stored = 0;
  let errors = 0;

  // 배치 단위로 처리
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    try {
      const texts = batch.map((c) => c.content);
      const embeddings = await generateBatchEmbeddings(texts);

      const rows = batch.map((chunk, j) => ({
        file_id: fileId,
        content: chunk.content,
        chunk_index: chunk.index,
        embedding: JSON.stringify(embeddings[j]),
        token_count: chunk.tokenCount,
      }));

      const { error } = await supabase.from('file_chunks').insert(rows);
      if (error) {
        console.error(`[embeddings] batch ${i} insert error:`, error.message);
        errors += batch.length;
      } else {
        stored += batch.length;
      }
    } catch (err) {
      console.error(`[embeddings] batch ${i} embedding error:`, err);
      errors += batch.length;
    }

    // Rate limit 대기
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return { stored, errors };
}
