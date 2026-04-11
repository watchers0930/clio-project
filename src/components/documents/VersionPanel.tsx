'use client';

export interface VersionItem {
  id: string;
  title: string;
  versionNumber: number;
  createdAt: string;
  status: string;
  createdBy: string;
  isCurrent: boolean;
}

interface VersionPanelProps {
  docId: string;
  items: VersionItem[];
  loading: boolean;
  onClose: () => void;
  onCreateNewVersion: (docId: string) => void;
  onDownload: (id: string, title: string, status: string, createdAt: string) => void;
}

export function VersionPanel({
  docId,
  items,
  loading,
  onClose,
  onCreateNewVersion,
  onDownload,
}: VersionPanelProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
    >
      <div className="bg-white h-full w-full max-w-sm flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e5e5e7]">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">버전 이력</h2>
            <p className="text-xs text-[#6e6e73] mt-0.5">문서의 모든 버전을 확인합니다</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 새 버전 생성 버튼 */}
        <div className="px-6 py-4 border-b border-[#e5e5e7]">
          <button
            onClick={() => onCreateNewVersion(docId)}
            className="w-full py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors"
          >
            + 새 버전 생성
          </button>
        </div>

        {/* 버전 타임라인 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-6 h-6 animate-spin text-[#0071e3]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-[#6e6e73] text-center py-12">버전 정보가 없습니다.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[#e5e5e7]" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {items.map((v) => (
                  <div key={v.id} className="flex gap-4 relative">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                        v.isCurrent ? 'bg-[#0071e3] border-[#0071e3]' : 'bg-white border-[#d1d1d6]'
                      }`}
                    >
                      <span className={`text-[9px] font-bold ${v.isCurrent ? 'text-white' : 'text-[#6e6e73]'}`}>
                        {v.versionNumber}
                      </span>
                    </div>
                    <div className="flex-1 pb-1">
                      <p className={`text-sm font-medium ${v.isCurrent ? 'text-[#0071e3]' : 'text-[#1d1d1f]'} leading-snug`}>
                        {v.title}
                        {v.isCurrent && (
                          <span className="ml-1.5 text-[10px] bg-[#0071e3]/10 text-[#0071e3] px-1.5 py-0.5 rounded font-semibold">현재</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] text-[#6e6e73]">{v.createdAt}</span>
                        {v.createdBy && <span className="text-[11px] text-[#6e6e73]">· {v.createdBy}</span>}
                      </div>
                      <button
                        onClick={() => onDownload(v.id, v.title, v.status, v.createdAt)}
                        className="mt-2 text-[11px] text-[#0071e3] hover:underline"
                      >
                        다운로드
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
