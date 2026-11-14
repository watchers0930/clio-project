// 계약서 직접 치환 경로 (AI 미사용) — 시스템 계약서 템플릿에 입력값을 그대로 치환해 HWPX 로 저장
// 해당하지 않으면 null 을 반환한다.
import { NextResponse } from 'next/server';
import { persistCompletedRender } from './context';
import { buildDocumentSummary } from './form-overrides';
import { failureResponse, type PersistContext } from './output-paths';

export async function respondContractDirect(ctx: PersistContext, contractFormData: unknown, templateBuffer: Buffer | null | undefined, todayStr: string) {
  const { supabase, authUserId, templateId, templateName, sourceFileIds, versionFields, originDocumentId, originContext, format } = ctx;
  if (contractFormData && typeof contractFormData === 'object' && Object.keys(contractFormData).length > 0 && templateBuffer) {
    const { isContractTemplate } = await import('@/lib/contract-fields');
    if (isContractTemplate(templateName)) {
      const { renderSystemContract } = await import('@/lib/renderers/contract-renderer');
      const dateStr = todayStr;
      const title = `${templateName} (${dateStr} 생성)`;

      console.log('[generate] 계약서 직접 치환 시작:', templateName, 'buffer:', templateBuffer.length, 'bytes, ZIP magic:', templateBuffer[0] === 0x50 && templateBuffer[1] === 0x4B ? 'OK' : 'FAIL');
      let rendered;
      try {
        rendered = renderSystemContract(templateBuffer, contractFormData as Record<string, string>, title);
        console.log('[generate] 계약서 렌더링 완료:', rendered.buffer.length, 'bytes, ZIP magic:', rendered.buffer[0] === 0x50 && rendered.buffer[1] === 0x4B ? 'OK' : 'FAIL');
      } catch (renderErr) {
        console.error('[generate] 계약서 렌더링 에러:', renderErr instanceof Error ? renderErr.message : renderErr, renderErr instanceof Error ? renderErr.stack : '');
        return NextResponse.json({ error: '계약서 생성 실패: ' + (renderErr instanceof Error ? renderErr.message : '알 수 없는 오류') }, { status: 500 });
      }
      try {
        const content = `[계약서 자동 작성] ${templateName}`;
        const { newDoc, signedUrl, downloadFileName, downloadExtension, downloadMimeType } = await persistCompletedRender({
          supabase,
          authUserId,
          rendered,
          title,
          content,
          templateId,
          sourceFileIds,
          instructions: JSON.stringify(contractFormData),
          versionFields,
          originDocumentId,
          originContext,
          auditDetails: { format: 'hwpx', mode: 'contract-direct' },
        });
        return NextResponse.json({
          document: buildDocumentSummary({
            id: newDoc?.id,
            title,
            templateName,
            createdAt: dateStr,
            status: '완료',
            sourceCount: 0,
            content,
            versionNumber: (newDoc as { version_number?: number | null } | null)?.version_number ?? 1,
            parentId: (newDoc as { parent_id?: string | null } | null)?.parent_id ?? null,
            originDocumentId: (newDoc as { origin_document_id?: string | null } | null)?.origin_document_id ?? null,
            originContext: (newDoc as { origin_context?: string | null } | null)?.origin_context ?? null,
            outputFormat: format,
          }),
          format: 'hwpx',
          mode: 'contract-direct',
          downloadUrl: signedUrl,
          downloadFileName,
          downloadExtension,
          downloadMimeType,
        }, { status: 201 });
      } catch (e) {
        return failureResponse(e, '[generate] Contract upload error:', '파일 업로드 실패');
      }
    }
  }
  return null;
}
