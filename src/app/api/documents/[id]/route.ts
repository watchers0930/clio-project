import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { embedDocument } from '@/lib/ai/embed-document';
import { canAccessDocument, canManageDocument, getUserRoleInfo } from '@/lib/permissions';

function extractTitleTokens(title: string) {
  return Array.from(new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  ));
}

function formatOriginLabel(originContext: string | null | undefined) {
  return ({
    meeting_minutes: '회의 기반 문서',
    meeting_followup: '회의 후속 문서',
    report_update: '업데이트 보고서',
    report_draft: '보고서 초안',
    shared_followup: '공유 문서 기반 후속',
    document_followup: '기준 문서 기반 후속',
  } as Record<string, string>)[originContext ?? ''] ?? '연결 문서 기반';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json<ApiResponse>({ success: false, error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, id);
    if (!canAccess) {
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 접근 권한이 없습니다.' }, { status: 403 });
    }

    const admin = createAdminSupabaseClient();

    // 문서 조회
    const { data } = await admin
      .from('documents')
      .select('*, templates:template_id(name)')
      .eq('id', id)
      .single();

    if (!data) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '문서를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const { templates: tmplJoin, ...docData } = data as Record<string, unknown>;
    const tmpl = tmplJoin as { name: string } | null;
    const rootId = (docData.parent_id as string | null) ?? id;
    const originDocumentId = (docData.origin_document_id as string | null) ?? null;
    const originContext = (docData.origin_context as string | null) ?? null;
    const templateId = (docData.template_id as string | null) ?? null;
    const sourceFileIds = Array.isArray(docData.source_file_ids) ? docData.source_file_ids : [];
    const titleTokens = extractTitleTokens((docData.title as string) ?? '');

    const [
      commentsResult,
      versionsResult,
      sharesResult,
      internalSharesResult,
      relatedByTemplateResult,
      relatedBySourceResult,
      relatedByTitleResult,
      originDocumentResult,
      derivedDocumentsResult,
    ] = await Promise.all([
      admin
        .from('document_comments')
        .select('id, created_at')
        .eq('document_id', id)
        .order('created_at', { ascending: false }),
      admin
        .from('documents')
        .select('id, version_number')
        .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
        .order('version_number', { ascending: true }),
      admin
        .from('shared_links')
        .select('id, token, created_at, expires_at, view_count, password_hash')
        .eq('resource_type', 'document')
        .eq('resource_id', id)
        .order('created_at', { ascending: false }),
      admin
        .from('document_permissions')
        .select('id, created_at, users:granted_to_user(name, email), departments:granted_to_dept(name)')
        .eq('document_id', id)
        .order('created_at', { ascending: false }),
      templateId
        ? admin
            .from('documents')
            .select('id, title, created_at, status, version_number, template_id')
            .eq('template_id', templateId)
            .neq('id', id)
            .order('created_at', { ascending: false })
            .limit(4)
        : Promise.resolve({ data: [], error: null }),
      sourceFileIds.length > 0
        ? admin
            .from('documents')
            .select('id, title, created_at, status, version_number, source_file_ids')
            .neq('id', id)
            .contains('source_file_ids', [sourceFileIds[0]])
            .order('created_at', { ascending: false })
            .limit(4)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from('documents')
        .select('id, title, created_at, status, version_number')
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(30),
      originDocumentId
        ? admin
            .from('documents')
            .select('id, title, created_at, status, version_number')
            .eq('id', originDocumentId)
            .single()
        : Promise.resolve({ data: null, error: null }),
      admin
        .from('documents')
        .select('id, title, created_at, status, version_number, origin_context')
        .eq('origin_document_id', id)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    const comments = commentsResult.data ?? [];
    const versions = versionsResult.data ?? [];
    const shares = sharesResult.data ?? [];
    const internalShares = ((internalSharesResult.data ?? []) as Array<{
      id: string;
      created_at: string;
      users?: { name?: string; email?: string } | null;
      departments?: { name?: string } | null;
    }>);
    const nowIso = new Date().toISOString();
    const relatedMap = new Map<string, {
      id: string;
      title: string;
      createdAt: string;
      status: string;
      versionNumber: number;
      relationLabel: string;
      score: number;
    }>();

    const addRelatedDocs = async (
      rows: Array<Record<string, unknown>>,
      relationLabel: string,
      score = 1,
    ) => {
      for (const row of rows) {
        const relatedId = row.id as string;
        if (!relatedId) continue;
        const resolvedRelationLabel = (row.relationLabel as string | undefined) ?? relationLabel;
        const allowed = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, relatedId);
        if (!allowed) continue;
        const existing = relatedMap.get(relatedId);
        if (existing) {
          const labels = new Set(existing.relationLabel.split(' · ').concat(resolvedRelationLabel));
          relatedMap.set(relatedId, {
            ...existing,
            relationLabel: Array.from(labels).join(' · '),
            score: existing.score + score,
          });
          continue;
        }
        relatedMap.set(relatedId, {
          id: relatedId,
          title: (row.title as string) ?? '제목 없음',
          createdAt: ((row.created_at as string) ?? '').split('T')[0] ?? '',
          status: (row.status as string) ?? 'draft',
          versionNumber: Number(row.version_number ?? 1),
          relationLabel: resolvedRelationLabel,
          score,
        });
      }
    };

    await addRelatedDocs((relatedByTemplateResult.data as Array<Record<string, unknown>> | null) ?? [], '같은 템플릿', 3);
    await addRelatedDocs((relatedBySourceResult.data as Array<Record<string, unknown>> | null) ?? [], '같은 소스', 3);

    const titleRelatedCandidates = ((relatedByTitleResult.data as Array<Record<string, unknown>> | null) ?? [])
      .map((row) => {
        const relatedTitle = (row.title as string) ?? '';
        const overlap = extractTitleTokens(relatedTitle).filter((token) => titleTokens.includes(token));
        return { row, overlap };
      })
      .filter(({ overlap }) => overlap.length > 0)
      .sort((a, b) => b.overlap.length - a.overlap.length)
      .slice(0, 6)
      .map(({ row, overlap }) => ({
        ...row,
        relationLabel: `같은 제목/검색어 · ${overlap.slice(0, 2).join(', ')}`,
        overlapCount: overlap.length,
      }));

    await addRelatedDocs(titleRelatedCandidates as Array<Record<string, unknown>>, '같은 제목/검색어', 2);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        ...docData,
        template_name: tmpl?.name,
        origin_document_id: originDocumentId,
        origin_context: originContext,
        ops: {
          rootId,
          commentCount: comments.length,
          latestCommentAt: comments[0]?.created_at ?? null,
          versionCount: versions.length,
          latestVersionNumber: Number(versions[versions.length - 1]?.version_number ?? docData.version_number ?? 1),
          latestVersionAt: (versions[versions.length - 1] as { created_at?: string } | undefined)?.created_at ?? (docData.created_at as string | null) ?? null,
          shareLinkCount: shares.length,
          activeShareCount: shares.filter((share) => !share.expires_at || share.expires_at > nowIso).length,
          latestShareAt: shares[0]?.created_at ?? null,
          totalShareViews: shares.reduce((sum, share) => sum + Number(share.view_count ?? 0), 0),
          internalShareCount: internalShares.length,
          internalShares: internalShares.slice(0, 5).map((share) => {
            const user = share.users as { name?: string; email?: string } | null;
            const department = share.departments as { name?: string } | null;
            return {
              id: share.id,
              targetType: user ? 'user' : 'department',
              targetName: user?.name ?? department?.name ?? '알 수 없음',
              targetMeta: user?.email ?? null,
              createdAt: share.created_at,
            };
          }),
          shareLinks: shares.slice(0, 5).map((share) => ({
            id: share.id,
            token: share.token,
            createdAt: share.created_at,
            expiresAt: share.expires_at,
            viewCount: Number(share.view_count ?? 0),
            hasPassword: !!share.password_hash,
            isActive: !share.expires_at || share.expires_at > nowIso,
          })),
          relatedDocs: Array.from(relatedMap.values())
            .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt))
            .slice(0, 4)
            .map((doc) => ({
              id: doc.id,
              title: doc.title,
              createdAt: doc.createdAt,
              status: doc.status,
              versionNumber: doc.versionNumber,
              relationLabel: doc.relationLabel,
            })),
          originDocument: originDocumentResult.data
            ? {
                id: originDocumentResult.data.id,
                title: originDocumentResult.data.title,
                createdAt: (originDocumentResult.data.created_at ?? '').split('T')[0] ?? '',
                status: originDocumentResult.data.status,
                versionNumber: Number(originDocumentResult.data.version_number ?? 1),
                relationLabel: formatOriginLabel(originContext),
              }
            : null,
          derivedDocuments: (derivedDocumentsResult.data ?? []).map((row) => ({
            id: row.id,
            title: row.title,
            createdAt: (row.created_at ?? '').split('T')[0] ?? '',
            status: row.status,
            versionNumber: Number(row.version_number ?? 1),
            relationLabel: formatOriginLabel((row.origin_context as string | null) ?? null),
          })),
        },
      },
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '문서 상세 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, status, title } = body as { content?: string; status?: string; title?: string };

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'DB 미설정' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json<ApiResponse>({ success: false, error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    const canManage = await canManageDocument(supabase, authUserId, roleInfo.role, id);
    if (!canManage) {
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 수정 권한이 없습니다.' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (content !== undefined) updates.content = content;
    if (status !== undefined) updates.status = status;
    if (title !== undefined) updates.title = title;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: '수정할 내용이 없습니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[documents/[id]/PATCH]', error.message);
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 수정에 실패했습니다.' }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: status ? 'document.status_change' : 'document.edit',
      target_type: 'document',
      target_id: id,
      details: { ...updates },
    }).then(() => {}, () => {});

    // content가 변경된 경우 임베딩 재생성 — fire-and-forget
    if (content !== undefined && data?.content) {
      embedDocument(id, data.content).then(() => {}, (e) => {
        console.error('[documents/[id]/PATCH] embed error:', e);
      });
    }

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: '문서 수정 중 오류' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json<ApiResponse>({ success: false, error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    const canManage = await canManageDocument(supabase, authUserId, roleInfo.role, id);
    if (!canManage) {
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 삭제 권한이 없습니다.' }, { status: 403 });
    }

    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      console.error('[documents/[id]/DELETE]', error.message);
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 삭제에 실패했습니다.' }, { status: 500 });
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

    return NextResponse.json<ApiResponse>({ success: true, data: { id } });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '문서 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
