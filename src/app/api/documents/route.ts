import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateDocumentContent } from '@/lib/ai/generate-document';
import { extractText } from '@/lib/ai/extract-text';
import { embedDocument } from '@/lib/ai/embed-document';
import type { DbDocument, DbFileRecord, DbTemplate, DbUser } from '@/lib/supabase/types';
import { parseTemplateBundle } from '@/lib/templates/template-schema';
import { canManageDocument, filterAccessibleDocumentRows, getUserRoleInfo } from '@/lib/permissions';
import { buildDocumentInsertPayload, loadSourceChunksFromFiles } from '@/app/api/generate/route-helpers';

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

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json({ documents: [], error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    let query = createAdminSupabaseClient()
      .from('documents')
      .select('*, templates:template_id(name), version_number, parent_id, origin_document_id, origin_context')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error('[documents/GET]', error.message);
      return NextResponse.json({ documents: [], error: '문서 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    type DocumentListRow = DbDocument & {
      version_number?: number | null;
      parent_id?: string | null;
      origin_document_id?: string | null;
      origin_context?: string | null;
      templates?: { name: string } | null;
    };

    const documentRows = (rows ?? []) as DocumentListRow[];
    const accessibleRows = await filterAccessibleDocumentRows(
      supabase,
      authUserId,
      roleInfo.role,
      roleInfo.department_id,
      documentRows,
    );

    const latestRowsByRoot = new Map<string, DocumentListRow>();
    for (const row of accessibleRows) {
      const rootId = row.parent_id ?? row.id;
      const existing = latestRowsByRoot.get(rootId);
      const currentVersion = row.version_number ?? 1;
      const existingVersion = existing?.version_number ?? 1;

      if (!existing || currentVersion > existingVersion) {
        latestRowsByRoot.set(rootId, row);
        continue;
      }

      if (currentVersion === existingVersion) {
        const currentCreatedAt = row.created_at ?? '';
        const existingCreatedAt = existing.created_at ?? '';
        if (currentCreatedAt > existingCreatedAt) {
          latestRowsByRoot.set(rootId, row);
        }
      }
    }

    const docs = Array.from(latestRowsByRoot.values()).map((d) => {
      const tmplJoin = d.templates ?? null;
      return {
        id: d.id,
        title: d.title,
        template: tmplJoin?.name ?? '기본',
        templateId: d.template_id ?? null,
        createdAt: d.created_at?.split('T')[0] ?? '',
        status: ({ completed: '완료', draft: '초안', submitted: '결재중', approved: '승인됨', rejected: '반려됨' } as Record<string, string>)[d.status] ?? d.status,
        sourceCount: d.source_file_ids?.length ?? 0,
        sourceFileIds: d.source_file_ids ?? [],
        content: d.content,
        versionNumber: d.version_number ?? 1,
        parentId: d.parent_id ?? null,
        originDocumentId: d.origin_document_id ?? null,
        originContext: d.origin_context ?? null,
      };
    }).sort((a, b) => `${b.createdAt}`.localeCompare(`${a.createdAt}`));

    return NextResponse.json({ documents: docs });
  } catch {
    return NextResponse.json({ documents: [], error: '문서 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, sourceFileIds, instructions, content: providedContent, parentId, originDocumentId, originContext, documentInputs } = body;

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

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json({ error: '사용자 정보가 없습니다.' }, { status: 403 });
    }
    const { data: authorInfo } = await supabase.from('users').select('name').eq('id', authUserId).single();

    // 템플릿 조회 (양식 파일 포함)
    const { data: tmpl } = await supabase
      .from('templates')
      .select('name, content, placeholders, template_file_id')
      .eq('id', templateId)
      .single();
    const templateRow = tmpl as DbTemplate | null;
    const templateBundle = templateRow ? parseTemplateBundle(templateRow.content, {
      name: templateRow.name,
      placeholders: templateRow.placeholders,
    }) : null;

    const templateName = templateRow?.name ?? '문서';
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const preferredTitle = typeof documentInputs?.report_title === 'string' && documentInputs.report_title.trim()
      ? documentInputs.report_title.trim()
      : templateName;
    const title = `${preferredTitle} (${dateStr} 생성)`;

    let docContent: string;

    if (providedContent) {
      docContent = providedContent;
    } else {
      // source_file_ids는 가능하면 기존 file_chunks를 재사용하고, 없는 경우만 원본 파싱으로 폴백
      const { sourceChunks } = await loadSourceChunksFromFiles(supabase, sourceFileIds);

      // 템플릿 양식 파일에서 직접 텍스트 추출
      let templateFileText: string | null = null;
      if (templateRow?.template_file_id) {
        const { data: tplFile } = await supabase
          .from('files')
          .select('name, type, storage_path')
          .eq('id', templateRow.template_file_id)
          .single();
        const templateFileRow = tplFile as DbFileRecord | null;
        if (templateFileRow?.storage_path) {
          try {
            const { data: blob } = await supabase.storage.from('files').download(templateFileRow.storage_path);
            if (blob) {
              const buf = await blob.arrayBuffer();
              templateFileText = await extractText(buf, templateFileRow.type ?? '', templateFileRow.name);
            }
          } catch (e) {
            console.error(`[documents/POST] extract template:`, e);
          }
        }
      }

      // AI 문서 생성
      try {
        const resolvedDocumentInputs = {
          ...(typeof documentInputs === 'object' && documentInputs ? documentInputs : {}),
          author: (authorInfo as DbUser | null)?.name ?? '',
          report_date: dateStr,
        };
        docContent = await generateDocumentContent({
          templateName,
          templateContent: templateBundle?.outline ?? null,
          templateBundle,
          templateFileText,
          sourceChunks,
          instructions: instructions ?? undefined,
          documentInputs: resolvedDocumentInputs,
        });
      } catch (err) {
        console.error('[documents/POST] AI generation failed:', err);
        const errMsg = err instanceof Error ? err.message : 'AI 문서 생성 실패';
        return NextResponse.json({ error: `문서 생성 실패: ${errMsg}. 다시 시도해 주세요.`, aiError: true }, { status: 500 });
      }
    }

    // 버전 번호 결정 (parentId가 있으면 기존 버전 + 1)
    let versionNumber = 1;
    let resolvedParentId: string | null = null;
    if (parentId) {
      // rootId 계산: parentId 문서의 parent_id가 null이면 parentId 자체가 root
      const { data: parentDoc } = await supabase
        .from('documents')
        .select('parent_id, version_number')
        .eq('id', parentId)
        .single();
      resolvedParentId = parentDoc?.parent_id ?? parentId;
      // 같은 루트의 최대 버전 조회
      const { data: siblings } = await supabase
        .from('documents')
        .select('version_number')
        .or(`id.eq.${resolvedParentId},parent_id.eq.${resolvedParentId}`)
        .order('version_number', { ascending: false })
        .limit(1);
      versionNumber = (siblings?.[0]?.version_number ?? 1) + 1;
    }

    const payload = buildDocumentInsertPayload({
      title,
      content: docContent,
      templateId,
      sourceFileIds,
      instructions,
      status: 'draft',
      createdBy: authUserId,
      versionFields: { parent_id: resolvedParentId ?? undefined, version_number: versionNumber },
      originDocumentId,
      originContext,
    });
    const { data: newDoc, error } = await supabase.from('documents').insert(payload).select().single();

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

    // 임베딩 생성 (검색 인덱싱) — fire-and-forget
    if (newDoc.content) {
      embedDocument(newDoc.id, newDoc.content).then(() => {}, (e) => {
        console.error('[documents/POST] embed error:', e);
      });
    }

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

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json({ error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    const admin = createAdminSupabaseClient();

    const { data: targetDoc, error: targetDocError } = await admin
      .from('documents')
      .select('id, parent_id')
      .eq('id', id)
      .single();

    if (targetDocError || !targetDoc) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const rootId = targetDoc.parent_id ?? targetDoc.id;

    // 문서 소유자 확인 (본인 또는 admin만 삭제)
    const canDelete = await canManageDocument(supabase, authUserId, roleInfo.role, rootId);
    if (!canDelete) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    const { data: chainDocs, error: chainDocsError } = await admin
      .from('documents')
      .select('id')
      .or(`id.eq.${rootId},parent_id.eq.${rootId}`);

    if (chainDocsError) {
      console.error('[documents/DELETE chain]', chainDocsError.message);
      return NextResponse.json({ error: '삭제 대상 조회에 실패했습니다.' }, { status: 500 });
    }

    const chainIds = [...new Set((chainDocs ?? []).map((doc) => doc.id))];
    if (chainIds.length === 0) {
      return NextResponse.json({ error: '삭제할 문서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { error: todoDeleteError } = await admin
      .from('todo_extractions')
      .delete()
      .in('document_id', chainIds);

    if (todoDeleteError) {
      console.error('[documents/DELETE todo_extractions]', todoDeleteError.message);
      return NextResponse.json({ error: '연결 데이터 삭제에 실패했습니다.' }, { status: 500 });
    }

    const { error } = await admin.from('documents').delete().in('id', chainIds);
    if (error) {
      console.error('[documents/DELETE]', error.message);
      return NextResponse.json({ error: '문서 삭제에 실패했습니다.' }, { status: 500 });
    }

    if (authUserId) {
      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'document.delete',
        target_type: 'document',
        target_id: rootId,
        details: { deleted_ids: chainIds, deleted_count: chainIds.length },
      }).then(() => {}, () => {});
    }

    return NextResponse.json({ success: true, deletedIds: chainIds, rootId });
  } catch {
    return NextResponse.json({ error: '문서 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
