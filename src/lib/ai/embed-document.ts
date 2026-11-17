import { after } from 'next/server';
import { generateEmbedding } from './embeddings';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { stripEmbeddedInputs } from '@/lib/documents/embedded-inputs';

const MAX_CONTENT_CHARS = 8000;

export type EmbedResult = 'embedded' | 'empty';

/** 문서 content를 임베딩 생성 후 document_embeddings에 upsert. 본문이 비면 옛 벡터를 지우고 'empty' */
export async function embedDocument(documentId: string, content: string): Promise<EmbedResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminSupabaseClient() as any;

  // 내부 입력값 주석(JSON)은 벡터에서 제외 — 같은 값이 본문에 렌더돼 있어 검색 정보는 잃지 않는다
  const body = stripEmbeddedInputs(content ?? '');
  if (body.trim().length === 0) {
    // 본문이 비면 예전 본문으로 만든 벡터가 남아 엉뚱한 검색 결과를 내지 않게 지운다
    const { error: delErr } = await adminClient.from('document_embeddings').delete().eq('document_id', documentId);
    if (delErr) console.error('[embed-document] stale vector delete error:', delErr.message);
    return 'empty';
  }

  const text = body.slice(0, MAX_CONTENT_CHARS);
  const embedding = await generateEmbedding(text);

  const { error } = await adminClient
    .from('document_embeddings')
    .upsert(
      // created_at 을 '마지막 생성 시각'으로 갱신 — 일괄 재생성(embed-all all 모드)이 진행 위치를 판단한다
      { document_id: documentId, embedding: JSON.stringify(embedding), created_at: new Date().toISOString() },
      { onConflict: 'document_id' }
    );

  if (error) {
    console.error('[embed-document] upsert error:', error.message);
    throw error;
  }
  return 'embedded';
}

/**
 * 문서 본문을 저장한 직후 호출 — 응답을 보낸 뒤(after) 그 시점의 본문을 DB 에서 다시 읽어 벡터를 만든다.
 * 저장 경로마다 본문을 넘기지 않으므로 연달아 저장돼도 마지막 본문 기준이 된다. 실패는 기록만(저장 자체는 성공).
 * 버전·스냅샷 행(parent_id 있음)은 검색에서 걸러지므로 벡터를 만들지 않는다(검색 상위 후보 자리만 차지).
 * 🔴 저장이 성공한 뒤에만 부를 것 — after 는 응답이 실패해도 실행된다.
 */
export function scheduleDocumentEmbedding(documentId: string): void {
  try {
    after(async () => {
      try {
        const { data, error } = await createAdminSupabaseClient()
          .from('documents')
          .select('content, parent_id')
          .eq('id', documentId)
          .maybeSingle();
        if (error) throw error;
        const row = data as { content: string | null; parent_id: string | null } | null;
        if (!row || row.parent_id) return; // 그사이 삭제됐거나 버전 행
        await embedDocument(documentId, row.content ?? '');
      } catch (e) {
        console.error('[embed-document] scheduled embed failed:', documentId, e instanceof Error ? e.message : e);
      }
    });
  } catch (e) {
    // 요청 범위 밖(스크립트 등)에서 불리면 after 가 즉시 예외를 던진다 — 이미 끝난 저장을 실패로 만들지 않게 기록만
    console.error('[embed-document] schedule outside request scope:', documentId, e instanceof Error ? e.message : e);
  }
}
