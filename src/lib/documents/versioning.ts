type DocumentSnapshotInsert = {
  title: string;
  content: string | null;
  status: string;
  parent_id: string;
  version_number: number;
  created_by: string | null;
  storage_path: string | null;
  template_id?: string | null;
  source_file_ids?: string[];
  instructions?: string | null;
  origin_document_id?: string | null;
  origin_context?: string | null;
  input_values?: Record<string, string> | null;
};

export interface VersionedDocumentRow {
  id: string;
  title: string;
  content: string | null;
  status: string | null;
  parent_id: string | null;
  version_number: number | null;
  created_by: string | null;
  storage_path: string | null;
  template_id?: string | null;
  source_file_ids?: string[] | null;
  instructions?: string | null;
  origin_document_id?: string | null;
  origin_context?: string | null;
  input_values?: Record<string, string> | null;
}

export function resolveDocumentRootId(doc: Pick<VersionedDocumentRow, 'id' | 'parent_id'>) {
  return doc.parent_id ?? doc.id;
}

export function buildSnapshotInsertPayload(doc: VersionedDocumentRow) {
  const payload: DocumentSnapshotInsert = {
    title: doc.title,
    content: doc.content,
    status: doc.status ?? 'completed',
    parent_id: resolveDocumentRootId(doc),
    version_number: doc.version_number ?? 1,
    created_by: doc.created_by,
    storage_path: doc.storage_path ?? null,
  };

  if ('template_id' in doc) payload.template_id = doc.template_id ?? null;
  if ('source_file_ids' in doc) payload.source_file_ids = doc.source_file_ids ?? [];
  if ('instructions' in doc) payload.instructions = doc.instructions ?? null;
  if ('origin_document_id' in doc) payload.origin_document_id = doc.origin_document_id ?? null;
  if ('origin_context' in doc) payload.origin_context = doc.origin_context ?? null;
  // 입력값은 본문이 아니라 칸에 있으므로 버전 스냅샷에도 함께 복사(없으면 그 버전의 다운로드·미리보기 입력값이 빈다)
  if ('input_values' in doc) payload.input_values = doc.input_values ?? null;

  return payload;
}

export function buildCurrentDocumentUpdate(doc: VersionedDocumentRow, nextContent: string) {
  const currentVersionNumber = doc.version_number ?? 1;
  const rootId = resolveDocumentRootId(doc);

  return {
    rootId,
    nextVersionNumber: currentVersionNumber + 1,
    updatePayload: {
      content: nextContent,
      version_number: currentVersionNumber + 1,
      parent_id: rootId === doc.id ? null : rootId,
      storage_path: null,
    },
  };
}
