import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { parseTemplateBundle } from '@/lib/templates/template-schema';
import { renderTemplateFilePreviewHtml } from '@/lib/templates/template-file-preview';

function wrapTemplateHtml(title: string, bodyHtml: string) {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕',sans-serif;max-width:900px;margin:24px auto;padding:0 24px;font-size:13px;line-height:1.8;color:#1d1d1f;background:#fff;}h1{font-size:18px;font-weight:700;margin-bottom:24px;border-bottom:1px solid #e5e5e7;padding-bottom:12px;}p{margin:4px 0;}table{border-collapse:collapse;width:100%;margin:12px 0;}td,th{border:1px solid #ccc;padding:6px 10px;}img{max-width:100%;height:auto;}</style></head><body><h1>${title}</h1>${bodyHtml}</body></html>`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return new NextResponse('DB unavailable', { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { data: templateRow, error } = await supabase
      .from('templates')
      .select('name, description, content, placeholders, template_file_id')
      .eq('id', id)
      .single();

    if (error || !templateRow) {
      return new NextResponse('Template not found', { status: 404 });
    }

    if (templateRow.template_file_id) {
      const { data: fileRow } = await supabase
        .from('files')
        .select('name, storage_path')
        .eq('id', templateRow.template_file_id)
        .single();

      if (fileRow?.storage_path) {
        const { data: blob } = await supabase.storage.from('files').download(fileRow.storage_path);
        if (blob) {
          const html = await renderTemplateFilePreviewHtml({
            buffer: Buffer.from(await blob.arrayBuffer()),
            fileName: fileRow.name,
            title: templateRow.name,
          });
          return new NextResponse(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
      }
    }

    const bundle = parseTemplateBundle(templateRow.content, {
      name: templateRow.name,
      description: templateRow.description,
      placeholders: templateRow.placeholders,
    });

    return new NextResponse(wrapTemplateHtml(templateRow.name, bundle.layoutHtml), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : 'Preview error', { status: 500 });
  }
}
