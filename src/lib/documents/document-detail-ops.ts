// 문서 상세(GET) 조회 — 문서 본문과 운영 정보(ops: 댓글·버전·공유·관련/원본/파생 문서)를 모아 반환.
// 인증·접근 권한 확인과 응답 생성은 라우트가 맡고, 여기서는 조회·조립만 한다.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { canAccessDocument } from '@/lib/permissions';
import { kstDateFromISO } from '@/lib/utils/date-kst';

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

/** 문서가 없으면 null(라우트가 404로 응답). 관련 문서는 사용자 세션 기준으로 접근 가능한 것만 담는다. */
export async function loadDocumentDetail(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  supabase: SupabaseClient,
  authUserId: string,
  roleInfo: { role: string; department_id: string | null },
  id: string,
) {
  // 문서 조회
  const { data } = await admin
    .from('documents')
    .select('*, templates:template_id(name)')
    .eq('id', id)
    .single();

  if (!data) return null;

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
        createdAt: kstDateFromISO(row.created_at as string),
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

  return {
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
            createdAt: kstDateFromISO(originDocumentResult.data.created_at),
            status: originDocumentResult.data.status,
            versionNumber: Number(originDocumentResult.data.version_number ?? 1),
            relationLabel: formatOriginLabel(originContext),
          }
        : null,
      derivedDocuments: (derivedDocumentsResult.data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: kstDateFromISO(row.created_at),
        status: row.status,
        versionNumber: Number(row.version_number ?? 1),
        relationLabel: formatOriginLabel((row.origin_context as string | null) ?? null),
      })),
    },
  };
}
