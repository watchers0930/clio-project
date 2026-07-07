'use client';

import { FolderOpen, RefreshCw, Unlink, AlertCircle, CheckCircle2, Loader2, HardDrive } from 'lucide-react';
import { useLocalFileSync } from '@/hooks/useLocalFileSync';

function formatDate(d: Date | null) {
  if (!d) return '없음';
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function LocalSyncSection() {
  const { state, connect, grantPermission, sync, disconnect } = useLocalFileSync();

  if (state.status === 'unsupported') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">지원되지 않는 브라우저입니다</p>
          <p className="mt-0.5 text-amber-700">Chrome 또는 Whale 브라우저에서 이용해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 상태 카드 */}
      <div className="rounded-xl border border-[#E2E5EA] bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F0F4FF]">
              <HardDrive className="h-5 w-5 text-[#2E6FF2]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1B1F2B]">
                {state.folderName ? `📁 ${state.folderName}` : '로컬 폴더 미연결'}
              </p>
              <p className="mt-0.5 text-xs text-[#6B7280]">
                {state.status === 'ready' && `파일 ${state.indexedCount}개 인덱싱됨 · 마지막 동기화: ${formatDate(state.lastSynced)}`}
                {state.status === 'idle' && '연결된 폴더가 없습니다'}
                {state.status === 'connecting' && '연결 확인 중...'}
                {state.status === 'requesting-permission' && '접근 권한이 필요합니다'}
                {state.status === 'syncing' && (state.progress
                  ? `동기화 중... (${state.progress.current}/${state.progress.total}) ${state.progress.currentFileName}`
                  : '동기화 준비 중...')}
                {state.status === 'error' && (state.errorMessage ?? '오류가 발생했습니다')}
              </p>
            </div>
          </div>

          {/* 상태 뱃지 */}
          <StatusBadge status={state.status} />
        </div>

        {/* 진행 바 */}
        {state.status === 'syncing' && state.progress && (
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E5EA]">
              <div
                className="h-full rounded-full bg-[#2E6FF2] transition-all"
                style={{ width: `${Math.round((state.progress.current / state.progress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-wrap gap-3">
        {(state.status === 'idle' || state.status === 'error') && (
          <button
            onClick={connect}
            className="flex items-center gap-2 rounded-lg bg-[#2E6FF2] px-4 py-2 text-sm font-medium text-white hover:bg-[#2560d8] disabled:opacity-60"
          >
            <FolderOpen className="h-4 w-4" />
            폴더 연결
          </button>
        )}

        {state.status === 'requesting-permission' && (
          <button
            onClick={grantPermission}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            <AlertCircle className="h-4 w-4" />
            접근 허용
          </button>
        )}

        {state.status === 'ready' && (
          <>
            <button
              onClick={() => void sync()}
              className="flex items-center gap-2 rounded-lg bg-[#2E6FF2] px-4 py-2 text-sm font-medium text-white hover:bg-[#2560d8]"
            >
              <RefreshCw className="h-4 w-4" />
              지금 동기화
            </button>
            <button
              onClick={() => void disconnect()}
              className="flex items-center gap-2 rounded-lg border border-[#E2E5EA] bg-white px-4 py-2 text-sm font-medium text-[#4B5563] hover:bg-[#F7F8FA]"
            >
              <Unlink className="h-4 w-4" />
              폴더 연결 해제
            </button>
          </>
        )}

        {state.status === 'syncing' && (
          <button disabled className="flex items-center gap-2 rounded-lg bg-[#2E6FF2] px-4 py-2 text-sm font-medium text-white opacity-60">
            <Loader2 className="h-4 w-4 animate-spin" />
            동기화 중...
          </button>
        )}
      </div>

      {/* 안내 */}
      <div className="rounded-xl border border-[#E2E5EA] bg-[#F7F8FA] p-4 text-xs text-[#6B7280] leading-relaxed">
        <p className="font-medium text-[#374151] mb-1">안내</p>
        <ul className="list-disc list-inside space-y-1">
          <li>파일 원본은 서버에 업로드되지 않으며, 검색용 임베딩만 저장됩니다.</li>
          <li>지원 형식: PDF, DOCX, HWP, HWPX, XLSX, PPTX, TXT, MD, CSV</li>
          <li>Chrome / Whale 브라우저에서 권한이 유지됩니다. Safari는 매번 재선택이 필요합니다.</li>
          <li>변경된 파일만 재인덱싱되므로 두 번째 동기화부터는 빠릅니다.</li>
        </ul>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ready') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> 연결됨
      </span>
    );
  }
  if (status === 'syncing') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
        <Loader2 className="h-3 w-3 animate-spin" /> 동기화 중
      </span>
    );
  }
  if (status === 'requesting-permission') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        <AlertCircle className="h-3 w-3" /> 권한 필요
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        <AlertCircle className="h-3 w-3" /> 오류
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#6B7280]">
      미연결
    </span>
  );
}
