import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { extractText, isAudioFile } from '@/lib/ai/extract-text';
import { chunkText } from '@/lib/ai/chunk-text';
import { generateAndStoreChunks } from '@/lib/ai/embeddings';

/**
 * POST /api/files/process
 * 업로드된 파일의 텍스트 추출 → 청킹 → 임베딩 → file_chunks 저장
 * Service Role Key 사용 (RLS bypass)
 */
export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({ success: false, error: 'fileId가 필요합니다.' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();

    // 1. 파일 메타데이터 조회
    const { data: file, error: fileErr } = await supabase
      .from('files')
      .select('id, name, type, storage_path, status')
      .eq('id', fileId)
      .single();

    if (fileErr || !file) {
      console.error('[process] file not found:', fileId);
      return NextResponse.json({ success: false, error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 오디오 파일은 STT 처리가 필요하므로 여기서는 스킵
    if (isAudioFile(file.type ?? '', file.name)) {
      await supabase.from('files').update({ status: 'indexed' }).eq('id', fileId);
      return NextResponse.json({ success: true, message: '오디오 파일은 STT 별도 처리 필요' });
    }

    // 이미 indexed 상태면 스킵 (멱등성)
    if (file.status === 'indexed') {
      // 하지만 file_chunks가 없으면 재처리
      const { count } = await supabase
        .from('file_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('file_id', fileId);
      if ((count ?? 0) > 0) {
        return NextResponse.json({ success: true, message: '이미 처리됨' });
      }
    }

    // 2. Storage에서 파일 다운로드
    if (!file.storage_path) {
      // storage_path 없는 파일 (메타데이터만 등록된 경우) → indexed로 표시
      await supabase.from('files').update({ status: 'indexed' }).eq('id', fileId);
      return NextResponse.json({ success: true, message: 'storage_path 없음, 건너뜀' });
    }

    const { data: fileData, error: dlErr } = await supabase.storage
      .from('files')
      .download(file.storage_path);

    if (dlErr || !fileData) {
      console.error('[process] download error:', dlErr?.message);
      await supabase.from('files').update({ status: 'error' }).eq('id', fileId);
      return NextResponse.json({ success: false, error: '파일 다운로드 실패' }, { status: 500 });
    }

    // 3. 텍스트 추출
    let text: string;
    try {
      const buffer = await fileData.arrayBuffer();
      text = await extractText(buffer, file.type ?? '', file.name);
    } catch (err) {
      console.error('[process] extract error:', err);
      await supabase.from('files').update({ status: 'error' }).eq('id', fileId);
      return NextResponse.json({ success: false, error: '텍스트 추출 실패' }, { status: 500 });
    }

    if (!text.trim()) {
      await supabase.from('files').update({ status: 'indexed' }).eq('id', fileId);
      return NextResponse.json({ success: true, message: '추출된 텍스트 없음' });
    }

    // 4. 청킹
    const chunks = chunkText(text);
    console.log(`[process] ${file.name}: ${text.length}자 → ${chunks.length}개 청크`);

    // 5. 임베딩 생성 + 저장
    const { stored, errors } = await generateAndStoreChunks(supabase, fileId, chunks);
    console.log(`[process] ${file.name}: ${stored}개 저장, ${errors}개 실패`);

    // 6. 상태 업데이트
    const newStatus = errors === 0 ? 'indexed' : (stored > 0 ? 'indexed' : 'error');
    await supabase.from('files').update({ status: newStatus }).eq('id', fileId);

    return NextResponse.json({
      success: true,
      data: { fileId, chunks: stored, errors, textLength: text.length },
    });
  } catch (err) {
    console.error('[process] unexpected error:', err);
    return NextResponse.json({ success: false, error: '파일 처리 중 오류' }, { status: 500 });
  }
}
