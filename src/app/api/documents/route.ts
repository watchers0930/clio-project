import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateDocumentContent } from '@/lib/ai/generate-document';
import { extractText } from '@/lib/ai/extract-text';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ documents: [], error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ documents: [], error: '인증이 필요합니다.' }, { status: 401 });
    }

    let query = supabase
      .from('documents')
      .select('*, templates:template_id(name)')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error('[documents/GET]', error.message);
      return NextResponse.json({ documents: [], error: '문서 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    const docs = (rows ?? []).map((d) => {
      const tmplJoin = (d as Record<string, unknown>).templates as { name: string } | null;
      return {
        id: d.id,
        title: d.title,
        template: tmplJoin?.name ?? '기본',
        createdAt: d.created_at?.split('T')[0] ?? '',
        status: d.status === 'completed' ? '완료' : '초안',
        sourceCount: d.source_file_ids?.length ?? 0,
        content: d.content,
      };
    });

    return NextResponse.json({ documents: docs });
  } catch {
    return NextResponse.json({ documents: [], error: '문서 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, sourceFileIds, instructions, content: providedContent } = body;

    if (!templateId) {
      return NextResponse.json({ error: '템플릿을 선택해주세요.' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 템플릿 조회 (양식 파일 포함)
    const { data: tmpl } = await supabase
      .from('templates')
      .select('name, content, placeholders, template_file_id')
      .eq('id', templateId)
      .single();

    const templateName = tmpl?.name ?? '문서';
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const title = `${templateName} (${dateStr} 생성)`;

    let docContent: string;

    if (providedContent) {
      docContent = providedContent;
    } else {
      // 소스 파일에서 직접 텍스트 추출 (file_chunks 미의존)
      let sourceChunks: string[] = [];
      if (sourceFileIds && sourceFileIds.length > 0) {
        const { data: srcFiles } = await supabase
          .from('files')
          .select('id, name, type, storage_path')
          .in('id', sourceFileIds);
        for (const sf of (srcFiles ?? [])) {
          if (!sf.storage_path) continue;
          try {
            const { data: blob } = await supabase.storage.from('files').download(sf.storage_path);
            if (blob) {
              const buf = await blob.arrayBuffer();
              const text = await extractText(buf, sf.type ?? '', sf.name);
              if (text.trim()) sourceChunks.push(text.slice(0, 8000));
            }
          } catch (e) {
            console.error(`[documents/POST] extract source ${sf.name}:`, e);
          }
        }
      }

      // 템플릿 양식 파일에서 직접 텍스트 추출
      let templateFileText: string | null = null;
      if (tmpl?.template_file_id) {
        const { data: tplFile } = await supabase
          .from('files')
          .select('name, type, storage_path')
          .eq('id', tmpl.template_file_id)
          .single();
        if (tplFile?.storage_path) {
          try {
            const { data: blob } = await supabase.storage.from('files').download(tplFile.storage_path);
            if (blob) {
              const buf = await blob.arrayBuffer();
              templateFileText = await extractText(buf, tplFile.type ?? '', tplFile.name);
            }
          } catch (e) {
            console.error(`[documents/POST] extract template:`, e);
          }
        }
      }

      // AI 문서 생성
      try {
        docContent = await generateDocumentContent({
          templateName,
          templateContent: typeof tmpl?.content === 'string' ? tmpl.content : null,
          templateFileText,
          sourceChunks,
          instructions: instructions ?? undefined,
        });
      } catch (err) {
        console.error('[documents/POST] AI generation failed:', err);
        const errMsg = err instanceof Error ? err.message : 'AI 문서 생성 실패';
        return NextResponse.json({ error: `문서 생성 실패: ${errMsg}. 다시 시도해 주세요.`, aiError: true }, { status: 500 });
      }
    }

    const { data: newDoc, error } = await supabase.from('documents').insert({
      title,
      content: docContent,
      template_id: templateId,
      source_file_ids: sourceFileIds ?? [],
      instructions: instructions ?? null,
      status: 'draft',
      created_by: authUserId,
    }).select().single();

    if (error) {
      console.error('[documents/POST]', error.message);
      return NextResponse.json({ error: '문서 생성에 실패했습니다.' }, { status: 500 });
    }

    // audit_logs
    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: 'document.create',
      target_type: 'document',
      target_id: newDoc.id,
      details: { title },
    }).then(() => {}, () => {});

    return NextResponse.json({
      document: {
        id: newDoc.id,
        title: newDoc.title,
        template: templateName,
        createdAt: dateStr,
        status: '초안',
        sourceCount: (sourceFileIds ?? []).length,
        content: newDoc.content,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '문서 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 문서 소유자 확인 (본인 또는 admin만 삭제)
    const { data: doc } = await supabase.from('documents').select('created_by').eq('id', id).single();
    if (doc && doc.created_by !== authUserId) {
      const { data: userInfo } = await supabase.from('users').select('role').eq('id', authUserId).single();
      if (userInfo?.role !== 'admin') {
        return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
      }
    }

    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      console.error('[documents/DELETE]', error.message);
      return NextResponse.json({ error: '문서 삭제에 실패했습니다.' }, { status: 500 });
    }

    if (authUserId) {
      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'document.delete',
        target_type: 'document',
        target_id: id,
        details: {},
      }).then(() => {}, () => {});
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '문서 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
