import type { DocumentItem, SourceFile } from '@/components/documents/page-types';
import { ReferenceDocumentPicker } from '@/components/documents/reference-document-picker';

interface NewDocumentSourceStepProps {
  selectedFiles: Set<string>;
  uploadingLocalFiles: boolean;
  fileSearch: string;
  fileDeptFilter: string;
  fileTypeFilter: string;
  departments: string[];
  types: string[];
  sourceFiles: SourceFile[];
  filteredFiles: SourceFile[];
  isProposalTemplate: boolean;
  referenceDocId: string | null;
  referenceDocuments: DocumentItem[];
  onUploadLocalFiles: (files: FileList | null) => Promise<void>;
  onSetFileSearch: (value: string) => void;
  onSetFileDeptFilter: (value: string) => void;
  onSetFileTypeFilter: (value: string) => void;
  onClearSelectedFiles: () => void;
  onToggleFile: (id: string) => void;
  onSetReferenceDocId: (id: string | null) => void;
}

/**
 * 새 문서 생성 폼의 "소스 파일" step.
 * 로컬 업로드·검색·부서/타입 필터·파일 선택과 제안서 참조문서 선택을 그린다.
 */
export function NewDocumentSourceStep({
  selectedFiles,
  uploadingLocalFiles,
  fileSearch,
  fileDeptFilter,
  fileTypeFilter,
  departments,
  types,
  sourceFiles,
  filteredFiles,
  isProposalTemplate,
  referenceDocId,
  referenceDocuments,
  onUploadLocalFiles,
  onSetFileSearch,
  onSetFileDeptFilter,
  onSetFileTypeFilter,
  onClearSelectedFiles,
  onToggleFile,
  onSetReferenceDocId,
}: NewDocumentSourceStepProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground-secondary">참조할 소스 파일을 선택하세요 (선택사항)</p>
        <span className="text-xs font-medium text-primary">{selectedFiles.size}개 선택됨</span>
      </div>
      <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">로컬 파일 추가</p>
            <p className="text-xs text-foreground-secondary">문서허브에 없는 파일은 여기서 바로 업로드하고 참조문서로 선택합니다.</p>
          </div>
          <label className={`inline-flex cursor-pointer items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${uploadingLocalFiles ? 'bg-border text-foreground-secondary' : 'bg-foreground text-white hover:bg-primary'}`}>
            <input
              type="file"
              multiple
              className="hidden"
              disabled={uploadingLocalFiles}
              onChange={(e) => {
                void onUploadLocalFiles(e.target.files);
                e.currentTarget.value = '';
              }}
            />
            {uploadingLocalFiles ? '업로드 중...' : '로컬 파일 선택'}
          </label>
        </div>
      </div>
      {selectedFiles.size === 0 && (
        <p className="text-xs text-warning bg-warning/5 px-3.5 py-2.5 rounded-lg">파일 없이도 템플릿 양식 기반으로 문서를 생성할 수 있습니다.</p>
      )}
      <div className="relative" style={{ marginTop: 10, marginBottom: 15 }}>
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          value={fileSearch}
          onChange={(e) => onSetFileSearch(e.target.value)}
          placeholder="파일명 검색..."
          style={{ paddingLeft: '2.5rem' }}
          className="w-full pr-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="mb-3 flex flex-wrap gap-2.5">
        <select value={fileDeptFilter} onChange={(e) => onSetFileDeptFilter(e.target.value)} className="px-3.5 py-2 rounded-lg border border-border text-xs text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="전체">전체 부서</option>
          {departments.map((department) => <option key={department} value={department}>{department}</option>)}
        </select>
        <select value={fileTypeFilter} onChange={(e) => onSetFileTypeFilter(e.target.value)} className="px-3.5 py-2 rounded-lg border border-border text-xs text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="전체">전체 타입</option>
          {types.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        {selectedFiles.size > 0 && (
          <button onClick={onClearSelectedFiles} className="px-3.5 py-2 rounded-lg text-xs text-danger hover:bg-red-50 transition-colors">
            선택 해제
          </button>
        )}
      </div>
      {sourceFiles.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm font-medium text-foreground">등록된 파일이 없습니다</p>
          <p className="text-xs text-foreground-secondary mt-1">파일 관리에서 먼저 파일을 업로드해 주세요</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-foreground-secondary">검색 결과가 없습니다</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto flex flex-col gap-2">
          {filteredFiles.map((file) => (
            <label
              key={file.id}
              className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${selectedFiles.has(file.id) ? 'border-primary bg-primary-tint' : 'border-border hover:bg-surface-secondary'}`}
            >
              <input type="checkbox" checked={selectedFiles.has(file.id)} onChange={() => onToggleFile(file.id)} className="rounded border-border text-primary focus:ring-primary shrink-0" />
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 bg-gray-50 text-gray-600">{file.type}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{file.name}</p>
                <p className="text-[11px] text-foreground-secondary mt-0.5">{file.department} · {file.size} · {file.uploadDate}</p>
              </div>
            </label>
          ))}
        </div>
      )}
      {isProposalTemplate && (
        <ReferenceDocumentPicker
          referenceDocId={referenceDocId}
          referenceDocuments={referenceDocuments}
          onSetReferenceDocId={onSetReferenceDocId}
        />
      )}
    </div>
  );
}
