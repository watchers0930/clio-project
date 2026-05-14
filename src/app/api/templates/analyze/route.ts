import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { analyzeDocumentStructure } from '@/lib/ai/analyze-template';
import { extractText } from '@/lib/ai/extract-text';
import { randomUUID } from 'crypto';
import { extractTemplateFileInnerHtml, renderTemplateFilePreviewHtml } from '@/lib/templates/template-file-preview';
import type { DbUser } from '@/lib/supabase/types';

export const maxDuration = 30;

const ALLOWED_EXTENSIONS = ['docx', 'dotx', 'hwpx'];

function compactHtmlToPreviewText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatErrorDetail(error: unknown) {
  if (!error || typeof error !== 'object') {
    return '알 수 없는 오류';
  }

  const maybeError = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };

  const parts = [
    maybeError.message,
    maybeError.code ? `code=${maybeError.code}` : null,
    maybeError.details,
    maybeError.hint,
  ].filter(Boolean);

  return parts.join(' | ') || '알 수 없는 오류';
}

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
    const admin = createAdminSupabaseClient();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: '파일이 필요합니다.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ success: false, error: 'DOCX, DOTX 또는 HWPX 파일만 지원합니다.' }, { status: 400 });
    }

    // 파일명 NFC 정규화
    const normalizedName = file.name.normalize('NFC');

    // Storage 업로드
    const { data: userData } = await admin.from('users').select('department_id').eq('id', authUserId).single();
    const departmentId = (userData as DbUser | null)?.department_id ?? 'default';
    const storagePath = `uploads/${departmentId}/${randomUUID()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await admin.storage
      .from('files')
      .upload(storagePath, buffer, { contentType: file.type });

    if (uploadErr) {
      const detail = formatErrorDetail(uploadErr);
      console.error('[templates/analyze] upload error:', detail);
      return NextResponse.json({ success: false, error: `파일 업로드 실패: ${detail}` }, { status: 500 });
    }

    // files 테이블에 삽입
    const { data: fileRow, error: insertErr } = await admin.from('files').insert({
      name: normalizedName,
      type: file.type,
      size: file.size,
      department_id: departmentId === 'default' ? null : departmentId,
      uploaded_by: authUserId,
      status: 'completed',
      storage_path: storagePath,
    }).select().single();

    if (insertErr) {
      const detail = formatErrorDetail(insertErr);
      console.error('[templates/analyze] insert error:', detail);
      await admin.storage.from('files').remove([storagePath]).catch(() => {});
      return NextResponse.json({ success: false, error: `파일 등록 실패: ${detail}` }, { status: 500 });
    }

    // 문서 구조 분석
    let placeholders: Awaited<ReturnType<typeof analyzeDocumentStructure>> = [];
    try {
      placeholders = await analyzeDocumentStructure(arrayBuffer, file.type, normalizedName);
      if (placeholders.length > 300) {
        placeholders = placeholders.slice(0, 300);
      }
    } catch (e) {
      console.warn('[templates/analyze] structure analysis fallback:', e);
      placeholders = [];
    }

    // HTML 미리보기와 텍스트 미리보기는 가능한 한 같은 추출 결과를 재사용
    let preview = '';
    let previewHtml = '';
    try {
      const innerHtml = await extractTemplateFileInnerHtml({
        buffer,
        fileName: normalizedName,
      });
      const previewText = compactHtmlToPreviewText(innerHtml);
      preview = previewText.slice(0, 500);
      previewHtml = await renderTemplateFilePreviewHtml({
        buffer,
        fileName: normalizedName,
        title: normalizedName.replace(/\.[^.]+$/, ''),
      });
    } catch (e) {
      console.warn('[templates/analyze] html preview fallback:', e);
      previewHtml = '';
    }

    if (!preview) {
      try {
        const fullText = await extractText(arrayBuffer, file.type, normalizedName);
        preview = fullText.slice(0, 500);
      } catch (e) {
        console.warn('[templates/analyze] preview fallback:', e);
        preview = '';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        fileId: fileRow.id,
        fileName: normalizedName,
        fileType: ext,
        placeholders,
        preview,
        previewHtml,
      },
    });
  } catch (err) {
    console.error('[templates/analyze]', err);
    return NextResponse.json({
      success: false,
      error: `분석 중 오류 발생: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
    }, { status: 500 });
  }
}
