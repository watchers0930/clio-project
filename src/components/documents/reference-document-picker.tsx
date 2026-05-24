import type { DocumentItem } from '@/components/documents/page-types';

interface ReferenceDocumentPickerProps {
  referenceDocId: string | null;
  referenceDocuments: DocumentItem[];
  onSetReferenceDocId: (id: string | null) => void;
}

export function ReferenceDocumentPicker({
  referenceDocId,
  referenceDocuments,
  onSetReferenceDocId,
}: ReferenceDocumentPickerProps) {
  if (referenceDocuments.length === 0) return null;

  return (
    <div className="mt-5 rounded-xl border border-border bg-surface-secondary px-4 py-4">
      <div className="mb-3">
        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <span>📋</span> 참조 제안서
        </p>
        <p className="mt-1 text-xs text-foreground-secondary">
          이전에 잘 작성된 제안서를 선택하면 형식과 구조를 참고하여 생성합니다
        </p>
      </div>
      <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
        {referenceDocuments.map((doc) => (
          <label
            key={doc.id}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
              referenceDocId === doc.id
                ? 'bg-primary-tint border border-primary/30'
                : 'hover:bg-white border border-transparent'
            }`}
          >
            <input
              type="radio"
              name="referenceDoc"
              checked={referenceDocId === doc.id}
              onChange={() =>
                onSetReferenceDocId(referenceDocId === doc.id ? null : doc.id)
              }
              className="shrink-0 text-primary focus:ring-primary"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate">{doc.title}</p>
              <p className="text-[11px] text-foreground-secondary mt-0.5">
                {doc.createdAt} · {doc.status}
              </p>
            </div>
          </label>
        ))}
      </div>
      {referenceDocId && (
        <button
          onClick={() => onSetReferenceDocId(null)}
          className="mt-2 text-xs text-foreground-secondary hover:text-danger transition-colors"
        >
          선택 해제
        </button>
      )}
    </div>
  );
}
