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
