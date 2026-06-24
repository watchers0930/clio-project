import { NextRequest, NextResponse, after } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

export const maxDuration = 60;

type BulkReprocessBody = {
  fileIds?: string[];
  mode?: 'selected' | 'all-errors' | 'all-unprocessed' | 'indexed-no-chunks';
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const body = await request.json().catch(() => ({})) as BulkReprocessBody;
    const mode = body.mode ?? 'selected';
    const admin = createAdminSupabaseClient();

    let targetIds: string[] = [];

    if (mode === 'indexed-no-chunks') {
      // indexed 상태지만 청크가 없는 파일 (스캔 PDF 등 OCR 미처리)
      const { data: indexedFiles } = await admin
        .from('files')
        .select('id')
        .eq('uploaded_by', authUserId)
        .eq('status', 'indexed')
        .not('storage_path', 'is', null);

      if (!indexedFiles || indexedFiles.length === 0) {
        return NextResponse.json({ success: true, reprocessed: 0, skipped: 0, fileIds: [] });
      }

      const allIndexedIds = indexedFiles.map((f) => f.id);

      // 청크가 있는 파일 ID 집합
      const { data: chunkedFiles } = await admin
        .from('file_chunks')
        .select('file_id')
        .in('file_id', allIndexedIds);

      const hasChunks = new Set((chunkedFiles ?? []).map((c) => c.file_id));
      targetIds = allIndexedIds.filter((id) => !hasChunks.has(id));

      if (targetIds.length === 0) {
        return NextResponse.json({ success: true, reprocessed: 0, skipped: allIndexedIds.length, fileIds: [] });
      }
    } else {
      let query = admin
        .from('files')
        .select('id, uploaded_by, storage_path, status')
        .eq('uploaded_by', authUserId)
        .not('storage_path', 'is', null);

      if (mode === 'all-errors') {
        query = query.eq('status', 'error');
      } else if (mode === 'all-unprocessed') {
        // processing(멈춤) + error 상태 모두 대상
        query = query.in('status', ['processing', 'error']);
      } else {
        const fileIds = Array.from(new Set((body.fileIds ?? []).filter(Boolean)));
        if (fileIds.length === 0) {
          return NextResponse.json({ error: '재처리할 파일이 없습니다.' }, { status: 400 });
        }
        query = query.in('id', fileIds);
      }

      const { data: files, error } = await query;
      if (error) {
        console.error('[bulk-reprocess] list error:', error);
        return NextResponse.json({ error: '파일 조회에 실패했습니다.' }, { status: 500 });
      }

      const eligibleFiles = (files ?? []).filter((file) => file.storage_path);
      if (eligibleFiles.length === 0) {
        return NextResponse.json({ success: true, reprocessed: 0, skipped: files?.length ?? 0, fileIds: [] });
      }
      targetIds = eligibleFiles.map((file) => file.id);
    }

    await admin.from('file_chunks').delete().in('file_id', targetIds);
    await admin.from('files').update({ status: 'processing' }).in('id', targetIds);

    const baseUrl = request.nextUrl.origin;
    const secret = process.env.INTERNAL_API_SECRET || '';

    // 응답 먼저 반환 후 background에서 처리
    after(async () => {
      await Promise.allSettled(
        targetIds.map((fileId) =>
          fetch(`${baseUrl}/api/files/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Secret': secret,
            },
            body: JSON.stringify({ fileId }),
          }).catch((e) => console.error('[bulk-reprocess] process trigger failed:', fileId, e))
        )
      );
    });

    return NextResponse.json({
      success: true,
      reprocessed: targetIds.length,
      skipped: 0,
      fileIds: targetIds,
    });
  } catch (err) {
    console.error('[bulk-reprocess] error:', err);
    return NextResponse.json({ error: '일괄 재처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
