import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { embedDocument } from '@/lib/ai/embed-document';

// 기존 documents 중 임베딩이 없는 것들을 일괄 처리하는 관리용 API
// INTERNAL_API_SECRET 헤더 인증 필수
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-internal-secret');
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  try {
    const adminClient = createAdminSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = adminClient as any;

    // 임베딩이 없는 document 목록 조회
    const { data: docs, error } = await admin
      .from('documents')
      .select('id, content, title')
      .not('content', 'is', null)
      .not('id', 'in', `(SELECT document_id FROM document_embeddings)`);

    if (error) {
      console.error('[embed-all] query error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const targets = (docs ?? []).filter((d: { content: string | null }) => d.content && d.content.trim().length > 0) as Array<{ id: string; content: string; title: string }>;

    let success = 0;
    let failed = 0;

    for (const doc of targets) {
      try {
        await embedDocument(doc.id, doc.content);
        success++;
      } catch (e) {
        console.error(`[embed-all] doc ${doc.id} (${doc.title}) error:`, e);
        failed++;
      }
      // Rate limit 방어
      await new Promise((r) => setTimeout(r, 200));
    }

    return NextResponse.json({ total: targets.length, success, failed });
  } catch (e) {
    console.error('[embed-all] error:', e);
    return NextResponse.json({ error: '백필 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
