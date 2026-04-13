'use client';

import { useRouter } from 'next/navigation';
import { Spinner, EmptyState } from '@/components/ui';

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
  const router = useRouter();

  const canCompare = items.length >= 2;

  function handleCompare() {
    // 가장 오래된 버전(v1)과 최신 버전 비교
    const sorted = [...items].sort((a, b) => a.versionNumber - b.versionNumber);
    const base = sorted[0];
    const latest = sorted[sorted.length - 1];
    router.push(`/documents/${base.id}/diff?compare=${latest.id}`);
    onClose();
  }

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

        {/* 새 버전 생성 + 버전 비교 버튼 */}
        <div className="px-6 py-4 border-b border-[#e5e5e7] flex flex-col gap-2">
          <button
            onClick={() => onCreateNewVersion(docId)}
            className="w-full py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors"
          >
            + 새 버전 생성
          </button>
          {canCompare && (
            <button
              onClick={handleCompare}
              className="w-full py-2.5 rounded-xl border border-[#d1d1d6] text-[#1d1d1f] text-sm font-medium hover:bg-[#f5f5f7] transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
              </svg>
              버전 비교
            </button>
          )}
        </div>

        {/* 버전 타임라인 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState iconType="file" title="버전 정보가 없습니다" className="py-12" />
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
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => onDownload(v.id, v.title, v.status, v.createdAt)}
                          className="text-[11px] text-[#0071e3] hover:underline"
                        >
                          다운로드
                        </button>
                        {!v.isCurrent && (
                          <button
                            onClick={() => {
                              router.push(`/documents/${v.id}/diff?compare=${docId}`);
                              onClose();
                            }}
                            className="text-[11px] text-[#6e6e73] hover:text-[#0071e3] hover:underline"
                          >
                            현재와 비교
                          </button>
                        )}
                      </div>
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
