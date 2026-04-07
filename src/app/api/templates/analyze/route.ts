import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { analyzeDocumentStructure } from '@/lib/ai/analyze-template';
import { extractText } from '@/lib/ai/extract-text';
import { randomUUID } from 'crypto';

export const maxDuration = 30;

const ALLOWED_EXTENSIONS = ['docx', 'hwpx'];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: '파일이 필요합니다.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ success: false, error: 'DOCX 또는 HWPX 파일만 지원합니다.' }, { status: 400 });
    }

    // 파일명 NFC 정규화
    const normalizedName = file.name.normalize('NFC');

    // Storage 업로드
    const { data: userData } = await supabase.from('users').select('department_id').eq('id', authUserId).single();
    const departmentId = userData?.department_id ?? 'default';
    const storagePath = `uploads/${departmentId}/${randomUUID()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await supabase.storage
      .from('files')
      .upload(storagePath, buffer, { contentType: file.type });

    if (uploadErr) {
      console.error('[templates/analyze] upload error:', uploadErr.message);
      return NextResponse.json({ success: false, error: '파일 업로드 실패' }, { status: 500 });
    }

    // files 테이블에 삽입
    const { data: fileRow, error: insertErr } = await supabase.from('files').insert({
      name: normalizedName,
      type: file.type,
      size: file.size,
      department_id: departmentId === 'default' ? null : departmentId,
      uploaded_by: authUserId,
      status: 'completed',
      storage_path: storagePath,
    }).select().single();

    if (insertErr) {
      console.error('[templates/analyze] insert error:', insertErr.message);
      return NextResponse.json({ success: false, error: '파일 등록 실패' }, { status: 500 });
    }

    // 문서 구조 분석
    const placeholders = await analyzeDocumentStructure(arrayBuffer, file.type, normalizedName);

    // 미리보기 텍스트 추출
    let preview = '';
    try {
      const fullText = await extractText(arrayBuffer, file.type, normalizedName);
      preview = fullText.slice(0, 500);
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        fileId: fileRow.id,
        fileName: normalizedName,
        fileType: ext,
        placeholders,
        preview,
      },
    });
  } catch (err) {
    console.error('[templates/analyze]', err);
    return NextResponse.json({ success: false, error: '분석 중 오류 발생' }, { status: 500 });
  }
}
