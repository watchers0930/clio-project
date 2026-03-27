import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

/**
 * GET /api/files/shared
 * 나에게 공유된 파일 목록 (유효 기간 내)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from('file_shares')
      .select('*, files:file_id(id, name, type, size, storage_path), sharer:shared_by(name)')
      .eq('shared_with', authUserId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[files/shared]', error.message);
      return NextResponse.json({ success: false, error: '공유 파일 조회 실패' }, { status: 500 });
    }

    interface ShareRow {
      id: string;
      file_id: string;
      permission: string;
      expires_at: string;
      created_at: string;
      files: { id: string; name: string; type: string | null; size: number; storage_path: string | null } | null;
      sharer: { name: string } | null;
    }

    const shares = ((data ?? []) as ShareRow[]).map(s => ({
      shareId: s.id,
      fileId: s.file_id,
      fileName: s.files?.name ?? '알 수 없음',
      fileType: s.files?.type ?? '',
      fileSize: s.files?.size ?? 0,
      sharedBy: s.sharer?.name ?? '알 수 없음',
      permission: s.permission,
      expiresAt: s.expires_at,
      createdAt: s.created_at,
    }));

    return NextResponse.json({ success: true, data: shares });
  } catch {
    return NextResponse.json({ success: false, error: '공유 파일 조회 중 오류' }, { status: 500 });
  }
}
