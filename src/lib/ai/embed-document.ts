import { generateEmbedding } from './embeddings';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const MAX_CONTENT_CHARS = 8000;

/** 문서 content를 임베딩 생성 후 document_embeddings에 upsert */
export async function embedDocument(documentId: string, content: string): Promise<void> {
  if (!content || content.trim().length === 0) return;

  const text = content.slice(0, MAX_CONTENT_CHARS);
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
