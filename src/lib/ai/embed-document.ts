import { generateEmbedding } from './embeddings';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { stripEmbeddedInputs } from '@/lib/documents/embedded-inputs';

const MAX_CONTENT_CHARS = 8000;

/** 문서 content를 임베딩 생성 후 document_embeddings에 upsert */
export async function embedDocument(documentId: string, content: string): Promise<void> {
  // 내부 입력값 주석(JSON)은 벡터에서 제외 — 같은 값이 본문에 렌더돼 있어 검색 정보는 잃지 않는다
  const body = stripEmbeddedInputs(content ?? '');
  if (body.trim().length === 0) return;

  const text = body.slice(0, MAX_CONTENT_CHARS);
  const embedding = await generateEmbedding(text);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminSupabaseClient() as any;
  const { error } = await adminClient
    .from('document_embeddings')
    .upsert(
      { document_id: documentId, embedding: JSON.stringify(embedding) },
      { onConflict: 'document_id' }
    );

  if (error) {
    console.error('[embed-document] upsert error:', error.message);
    throw error;
  }
}
