// 문서 다운로드 라우트 전용 — 문서 조회·접근 판정, 서명/직인·템플릿 컨텍스트 준비
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { canViewAllWeeklyReports } from '@/lib/permissions';
import { loadCompanySealBuffer } from '@/lib/settings/company-seal';
import { parseTemplateBundle, type TemplateBundle } from '@/lib/templates/template-schema';
import { resolveBuiltinTemplateBundle, resolveBuiltinTemplateBundleByName } from '@/lib/templates/builtin';
import { renderProposalDocumentHtml } from '@/lib/templates/proposal-render';
import { isProposalTemplateName } from '@/lib/templates/proposal';
import { loadCompanyLogoContext } from '@/lib/settings/company-logo';
import { parseEmbeddedInputs } from '@/lib/documents/embedded-inputs';
import { isWeeklyReportDocument } from '@/lib/documents/weekly-report-document';

export type DownloadDoc = {
  id: string;
  title: string;
  content: string | null;
  storage_path: string | null;
  parent_id: string | null;
  template_id?: string | null;
  created_by?: string | null;
};

export type DownloadContext = {
  signatureBuffer: Buffer | null;
  signerName: string;
  templateBundle: TemplateBundle | null;
  templateName: string;
  storedTemplateName: string;
  companyLogoContext: Awaited<ReturnType<typeof loadCompanyLogoContext>>;
  isProposalDocument: boolean;
  isCompanyIssuedDocument: boolean;
  companySealBuffer: Buffer | null;
  proposalPreviewHtml: string;
};

// 접근 가능한 문서를 조회한다. 없거나 권한이 없으면 null(라우트에서 404).
export async function loadDownloadDocument(
  id: string,
  authUserId: string,
  canAccess: boolean,
): Promise<DownloadDoc | null> {
  // 본인 문서 조회, 없으면 결재자인지 확인 후 admin으로 조회
  let doc: DownloadDoc | null = null;
  if (canAccess) {
    const admin = createAdminSupabaseClient();
    const { data: accessibleDoc } = await admin
      .from('documents')
      .select('id, title, content, storage_path, parent_id, template_id, created_by')
      .eq('id', id)
      .single();
    doc = accessibleDoc;
  } else {
    const admin = createAdminSupabaseClient();
    const { data: approval } = await admin
      .from('approvals')
      .select('id')
      .eq('document_id', id)
      .eq('approver_id', authUserId)
      .limit(1)
      .maybeSingle();
    if (approval) {
      const { data: adminDoc } = await admin
        .from('documents')
        .select('id, title, content, storage_path, parent_id, template_id, created_by')
        .eq('id', id)
        .single();
      doc = adminDoc;
    } else {
      // 전사 주간업무 조회 권한자(대표/관리자)는 주간업무 빌트인 문서를 inline 양식으로 열람 허용.
      // overview 조회와 동일 판별(isWeeklyReportDocument + template_id NULL)이라 접근 권한이 일관된다.
      const { data: wr } = await admin
        .from('documents')
        .select('id, title, content, storage_path, parent_id, template_id, created_by')
        .eq('id', id)
        .single();
      if (wr && wr.template_id === null && isWeeklyReportDocument({ title: wr.title ?? '', content: wr.content })) {
        const { data: me } = await admin
          .from('users')
          .select('role, rank_level')
          .eq('id', authUserId)
          .single();
        if (me && canViewAllWeeklyReports(me.role, (me as { rank_level?: number | null }).rank_level)) {
          doc = wr;
        }
      }
    }
  }

  if (!doc) return null;

  // storage_path가 없는 스냅샷 문서: 부모(루트) 문서의 storage_path로 대체
  if (!doc.storage_path && doc.parent_id) {
    const content = doc.content ?? '';
    const isLabel = content.startsWith('[') && content.length < 200;
    if (isLabel) {
      const adminFallback = createAdminSupabaseClient();
      const { data: parentDoc } = await adminFallback
        .from('documents')
        .select('storage_path')
        .eq('id', doc.parent_id)
        .single();
      if (parentDoc?.storage_path) {
        doc = { ...doc, storage_path: parentDoc.storage_path };
      }
    }
  }

  return doc;
}

// 서명 이미지·템플릿 번들·로고·직인·제안서 미리보기 HTML을 준비한다.
export async function loadDownloadContext(
  doc: DownloadDoc,
  authUserId: string,
  inline: boolean,
): Promise<DownloadContext> {
  // 서명 이미지 가져오기 — 다운로드 전용 (inline 미리보기는 서명 제외), 이름은 항상 가져옴
  let signatureBuffer: Buffer | null = null;
  let signerName = '';
  let templateBundle: TemplateBundle | null = null;
  let templateName = '';
  let storedTemplateName = '';
  try {
    const adminClient = createAdminSupabaseClient();
    const signatureOwnerId = doc.created_by ?? authUserId;
    const { data: nameData } = await adminClient
      .from('users').select('name, signature_path').eq('id', signatureOwnerId).maybeSingle();
    signerName = nameData?.name ?? '';
    // 미리보기(inline)에도 담당란 작성자 서명을 표시하기 위해 서명 버퍼를 로드한다.
    if (nameData?.signature_path) {
      const { data: sigBlob } = await adminClient.storage.from('files').download(nameData.signature_path);
      if (sigBlob) signatureBuffer = Buffer.from(await sigBlob.arrayBuffer());
    }
    if (doc.template_id) {
      // 빌트인 템플릿(근로계약서·품의서·휴가원·재직증명서)은 DB에 없고 코드에서 번들 생성.
      // 이 분기가 없으면 templateBundle=null → PDF가 양식(표·조항·결재란) 대신 마크다운 텍스트로 렌더됨.
      const builtin = resolveBuiltinTemplateBundle(doc.template_id);
      if (builtin) {
        templateName = builtin.name;
        templateBundle = builtin.bundle;
      } else {
        const { data: templateData } = await adminClient
          .from('templates')
          .select('name, description, content, placeholders')
          .eq('id', doc.template_id)
          .maybeSingle();
        if (templateData) {
          templateName = templateData.name ?? '';
          storedTemplateName = templateName;
          templateBundle = parseTemplateBundle(templateData.content, {
            name: templateData.name,
            description: templateData.description,
            placeholders: templateData.placeholders,
          });
        }
      }
    }
    // 빌트인 템플릿으로 생성됐지만 template_id가 저장되지 않은(null) 문서 보정.
    // buildDocumentInsertPayload가 '__builtin_' ID를 FK 제약 때문에 저장하지 않아 template_id=null이 됨
    // → 저장된 양식명(__template_name, 제목은 사용자가 바꿀 수 있음) 우선, 없으면 제목으로 번들 복원. 없으면 PDF가 텍스트로 렌더됨.
    if (!templateBundle) {
      const embedded = parseEmbeddedInputs(doc.content ?? '');
      const byName = (embedded.ok && embedded.inputs.__template_name ? resolveBuiltinTemplateBundleByName(embedded.inputs.__template_name) : null)
        ?? resolveBuiltinTemplateBundleByName(doc.title);
      if (byName) {
        templateName = byName.name;
        templateBundle = byName.bundle;
      }
    }
  } catch { /* 이름 없으면 그냥 진행 */ }
  const companyLogoContext = await loadCompanyLogoContext(createAdminSupabaseClient());

  const isProposalDocument = isProposalTemplateName(templateName);
  // 재직증명서·표준근로계약서 등 회사 발급 문서는 신청자가 누구든 회사 공용 직인을 쓴다.
  // (개인 문서는 아래에서 신청자 본인 서명 signatureBuffer 사용)
  const isCompanyIssuedDocument = /재직\s*증명서|근로계약서/.test(templateName);
  const companySealBuffer = !inline && isCompanyIssuedDocument
    ? await loadCompanySealBuffer(createAdminSupabaseClient())
    : null;
  const proposalPreviewHtml = isProposalDocument
    ? renderProposalDocumentHtml({
        title: doc.title,
        content: doc.content ?? '',
      })
    : '';

  return {
    signatureBuffer,
    signerName,
    templateBundle,
    templateName,
    storedTemplateName,
    companyLogoContext,
    isProposalDocument,
    isCompanyIssuedDocument,
    companySealBuffer,
    proposalPreviewHtml,
  };
}
