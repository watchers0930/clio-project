import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  GenerationResult,
  CorporateTheme,
  OutputFormat,
} from "@/lib/renderers/types";
import { renderDocument } from "@/lib/renderers";
import { buildDocumentInsertPayload, type VersionFields } from "./context";
import { buildDocumentSummary, isMouTemplateName } from "./form-overrides";
import { isBusinessPlanTemplateName } from "@/lib/templates/business-plan";
import { isEmploymentCertificateTemplateName } from "@/lib/templates/employment-certificate";
import { isLeaveApplicationTemplateName } from "@/lib/templates/leave-application";
import { isApprovalRequestTemplateName } from "@/lib/templates/approval-request";
import { isStandardLaborContractTemplateName } from "@/lib/templates/standard-labor-contract";
import {
  linkGeneratedLeave,
  leaveLinkFailure,
  embedLeaveInputs,
} from "@/lib/leave/leave-document";
interface SaveMarkdownInput {
  supabase: SupabaseClient<Database>;
  authUserId: string;
  generationResult: GenerationResult;
  theme: CorporateTheme;
  isProposalTemplate: boolean;
  templateName: string;
  resolvedDocumentInputs: Record<string, string>;
  title: string;
  templateId?: string;
  sourceFileIds?: string[];
  instructions?: string;
  versionFields: VersionFields;
  originDocumentId?: string;
  originContext?: string;
  format: OutputFormat;
  leaveInputs: Record<string, string>;
  dateStr: string;
}
export async function saveMarkdown(input: SaveMarkdownInput) {
  const {
    supabase,
    authUserId,
    generationResult,
    theme,
    isProposalTemplate,
    templateName,
    resolvedDocumentInputs,
    title,
    templateId,
    sourceFileIds,
    instructions,
    versionFields,
    originDocumentId,
    originContext,
    format,
    leaveInputs,
    dateStr,
  } = input;

  // 제안서/사업계획서: documentInputs를 콘텐츠 앞에 HTML 코멘트로 저장 (다운로드 시 표지 복원용)
  const shouldEmbedInputs =
    isProposalTemplate ||
    isBusinessPlanTemplateName(templateName) ||
    isMouTemplateName(templateName) ||
    isEmploymentCertificateTemplateName(templateName) ||
    isLeaveApplicationTemplateName(templateName) ||
    isApprovalRequestTemplateName(templateName) ||
    isStandardLaborContractTemplateName(templateName);
  // 서명/로고 base64는 다운로드 시 재생성되므로 embed에서 제외 (DB content 비대화 방지)
  const embeddableDocumentInputs = Object.fromEntries(
    Object.entries(resolvedDocumentInputs).filter(
      ([key]) =>
        key !== "signature_image_src" &&
        key !== "employee_signature_src" &&
        key !== "company_logo_src",
    ),
  );
  const markdownContent = isLeaveApplicationTemplateName(templateName)
    ? embedLeaveInputs(
        generationResult.markdown ?? "",
        embeddableDocumentInputs,
      )
    : shouldEmbedInputs
      ? `<!--DOCUMENT_INPUTS:${JSON.stringify(embeddableDocumentInputs)}-->\n${generationResult.markdown}`
      : (generationResult.markdown ?? "");

  const payload = buildDocumentInsertPayload({
    title,
    content: markdownContent,
    templateId,
    sourceFileIds,
    instructions,
    status: "draft",
    createdBy: authUserId,
    versionFields,
    originDocumentId,
    originContext,
    outputFormat: format,
  });
  const { data: newDoc, error } = await supabase
    .from("documents")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[generate] DB insert error:", error.message);
    return NextResponse.json(
      { error: "문서 생성에 실패했습니다." },
      { status: 500 },
    );
  }

  try {
    await linkGeneratedLeave(authUserId, newDoc.id, templateName, leaveInputs);
  } catch (error) {
    return NextResponse.json(leaveLinkFailure(error, newDoc.id), {
      status: 409,
    });
  }

  // audit
  await supabase
    .from("audit_logs")
    .insert({
      user_id: authUserId,
      action: "document.create",
      target_type: "document",
      target_id: newDoc.id,
      details: { title, format },
    })
    .then(
      () => {},
      () => {},
    );

  // PDF/DOCX/HWPX 마크다운 → 파일 렌더링 → Storage 업로드
  if (format === "pdf" || format === "hwpx" || format === "docx") {
    let rendered = await renderDocument(generationResult, theme);
    // PDF: renderDocument는 HTML을 반환 → 서버에서 실제 PDF로 변환 (인쇄창 불필요, 미리보기와 100% 동일)
    if (format === "pdf" && rendered.extension === "html") {
      const { htmlToPdf } = await import("@/lib/renderers/html-to-pdf");
      const pdfBuffer = await htmlToPdf(rendered.buffer.toString("utf-8"));
      rendered = {
        buffer: pdfBuffer,
        mimeType: "application/pdf",
        extension: "pdf",
        fileName: rendered.fileName.replace(/\.html$/, ".pdf"),
      };
    }
    const filePath = `generated/${authUserId}/${crypto.randomUUID()}.${rendered.extension}`;
    const { error: upErr } = await supabase.storage
      .from("files")
      .upload(filePath, rendered.buffer, {
        contentType: rendered.mimeType,
        upsert: false,
      });
    if (upErr) {
      console.error(
        `[generate] ${format.toUpperCase()} Storage upload error:`,
        upErr.message,
      );
    } else {
      await supabase
        .from("documents")
        .update({ storage_path: filePath })
        .eq("id", newDoc.id)
        .then(
          () => {},
          () => {},
        );
    }
    const { data: fileUrl } = await supabase.storage
      .from("files")
      .createSignedUrl(filePath, 3600);

    return NextResponse.json(
      {
        document: buildDocumentSummary({
          id: newDoc.id,
          title,
          templateName,
          createdAt: dateStr,
          status: "초안",
          sourceCount: (sourceFileIds ?? []).length,
          content: markdownContent,
          versionNumber:
            (newDoc as { version_number?: number | null }).version_number ?? 1,
          parentId: (newDoc as { parent_id?: string | null }).parent_id ?? null,
          originDocumentId:
            (newDoc as { origin_document_id?: string | null })
              .origin_document_id ?? null,
          originContext:
            (newDoc as { origin_context?: string | null }).origin_context ??
            null,
          outputFormat: format,
        }),
        format,
        downloadUrl: fileUrl?.signedUrl ?? null,
        downloadFileName: rendered.fileName,
        downloadExtension: rendered.extension,
        downloadMimeType: rendered.mimeType,
      },
      { status: 201 },
    );
  }

  return NextResponse.json(
    {
      document: buildDocumentSummary({
        id: newDoc.id,
        title,
        templateName,
        createdAt: dateStr,
        status: "초안",
        sourceCount: (sourceFileIds ?? []).length,
        content: markdownContent,
        versionNumber:
          (newDoc as { version_number?: number | null }).version_number ?? 1,
        parentId: (newDoc as { parent_id?: string | null }).parent_id ?? null,
        originDocumentId:
          (newDoc as { origin_document_id?: string | null })
            .origin_document_id ?? null,
        originContext:
          (newDoc as { origin_context?: string | null }).origin_context ?? null,
        outputFormat: format,
      }),
      format,
    },
    { status: 201 },
  );
}
