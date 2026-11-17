export interface DocumentCreateHrefOptions {
  templateId?: string | null;
  originDocumentId?: string | null;
  originContext?: string | null;
  contextTitle?: string | null;
  instructions?: string | null;
  fileIds?: string[];
  versionOf?: string | null;
  openDocId?: string | null;
}

export function buildDocumentCreateHref(options: DocumentCreateHrefOptions = {}) {
  const params = new URLSearchParams({ create: 'true' });

  if (options.templateId) params.set('template', options.templateId);
  if (options.originDocumentId) params.set('originDocumentId', options.originDocumentId);
  if (options.originContext) params.set('originContext', options.originContext);
  if (options.contextTitle) params.set('contextTitle', options.contextTitle);
  if (options.instructions) params.set('instructions', options.instructions);
  if (options.versionOf) params.set('versionOf', options.versionOf);
  if (options.openDocId) params.set('openDoc', options.openDocId);
  if (options.fileIds && options.fileIds.length > 0) params.set('files', options.fileIds.join(','));

  return `/documents?${params.toString()}`;
}

export function buildReportDraftHref(contextTitle = '보고서') {
  return buildDocumentCreateHref({
    originContext: 'report_draft',
    contextTitle,
  });
}

/**
 * 기준 문서로 후속 문서 만들기 — 원본의 양식과 참고 파일을 그대로 넘겨 AI 가 같은 근거로 작성하게 한다
 * (originDocumentId 는 연결 기록용이라 그것만으로는 원본 내용이 생성에 쓰이지 않는다). 문서 목록·검색 결과 공용.
 */
export function buildDocumentFollowupHref(doc: { id: string; title: string; templateId?: string | null; sourceFileIds?: string[] | null }) {
  return buildDocumentCreateHref({
    templateId: doc.templateId,
    fileIds: doc.sourceFileIds ?? [],
    instructions: `${doc.title} 문서를 참고해서 후속 문서를 작성하세요.`,
    originDocumentId: doc.id,
    originContext: 'document_followup',
    contextTitle: doc.title,
  });
}
