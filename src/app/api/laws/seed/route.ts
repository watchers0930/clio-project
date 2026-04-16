import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { generateEmbeddingsBatch } from '@/lib/laws/law-embedder';
import { LAW_SEED_DATA } from '@/lib/laws/law-seed-data';
import type { LawSeedResponse } from '@/lib/types/contract-suggest';

const BATCH_SIZE = 10;

export async function POST(request: NextRequest) {
  // 관리자 인증 (Service Role Key 헤더 검증)
  const authHeader = request.headers.get('Authorization');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자 권한이 필요합니다.' },
      { status: 403 },
    );
  }

  const admin = createAdminSupabaseClient();

  let inserted = 0;
  let failed = 0;
  const errors: string[] = [];

  // 기존 데이터 삭제 (멱등성 보장)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('law_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  for (let i = 0; i < LAW_SEED_DATA.length; i += BATCH_SIZE) {
    const batch = LAW_SEED_DATA.slice(i, i + BATCH_SIZE);

    try {
      const texts = batch.map((c) => c.content);
      const embeddings = await generateEmbeddingsBatch(texts, BATCH_SIZE);

      const rows = batch.map((chunk, j) => ({
        law_name: chunk.law_name,
        article_no: chunk.article_no,
        clause_no: chunk.clause_no ?? null,
        content: chunk.content,
        category: chunk.category,
        embedding: JSON.stringify(embeddings[j]),
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin as any).from('law_chunks').insert(rows);
      if (error) {
        console.error(`[law-seed] batch ${i} insert error:`, error.message);
        errors.push(`batch ${i}: ${error.message}`);
        failed += batch.length;
      } else {
        inserted += batch.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[law-seed] batch ${i} error:`, msg);
      errors.push(`batch ${i}: ${msg}`);
      failed += batch.length;
    }
  }

  const result: LawSeedResponse = { inserted, failed };
  if (errors.length > 0) result.errors = errors;

  return NextResponse.json(result);
}
