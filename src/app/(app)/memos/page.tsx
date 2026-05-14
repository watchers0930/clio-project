'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, FileText, Search, Sparkles, StickyNote } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import MemoList from '@/components/memos/memo-list';
import MemoFormModal from '@/components/memos/memo-form-modal';
import MemoViewModal from '@/components/memos/memo-view-modal';
import type { MemoFormData } from '@/components/memos/memo-form-modal';
import type { MemoItem } from '@/lib/supabase/types';
import type { ExtractedTodo } from '@/components/memos/memo-todo-confirm-modal';

export default function MemosPage() {
  return (
    <Suspense fallback={<MemosPageSkeleton />}>
      <MemosPageContent />
    </Suspense>
  );
}

function MemosPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [search, setSearch] = useState('');

  const [viewOpen, setViewOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<MemoItem | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const [selectedMemoIds, setSelectedMemoIds] = useState<Set<string>>(new Set());
  const [ideaPanelOpen, setIdeaPanelOpen] = useState(false);

  const documentContext = useMemo(() => {
    const documentId = searchParams.get('documentId');
    const documentTitle = searchParams.get('documentTitle');
    if (!documentId || !documentTitle) return null;
    return { documentId, documentTitle };
  }, [searchParams]);

  const memoDraftFromContext = useMemo(() => {
    if (!documentContext) return null;
    return {
      title: `${documentContext.documentTitle} 메모`,
      content: `문서: ${documentContext.documentTitle}\n핵심 메모:\n- \n\n다음 작업:\n- `,
      color: 'blue' as const,
    };
  }, [documentContext]);

  const pinnedMemoCount = useMemo(() => memos.filter((memo) => memo.is_pinned).length, [memos]);
  const memoFocus =
    selectedMemo?.title ||
    documentContext?.documentTitle ||
    memos.find((memo) => memo.is_pinned)?.title ||
    memos[0]?.title ||
    '문서 메모';

  const fetchMemos = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    fetch(`/api/memos?${params}`)
      .then((r) => r.json())
      .then((res: { success: boolean; data?: MemoItem[] }) => {
        if (res.success) setMemos(res.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { fetchMemos(); }, [fetchMemos]);

  const handleCreate = async (data: MemoFormData) => {
    const res = await fetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json() as { success: boolean; data?: MemoItem };
    if (result.success) {
      fetchMemos();
      if (result.data?.id) {
        fetch(`/api/memos/${result.data.id}/embed`, { method: 'POST' })
          .then(() => {}, () => {});
      }
    }
  };

  const handleUpdate = async (data: MemoFormData) => {
    if (!selectedMemo) return;
    const res = await fetch(`/api/memos/${selectedMemo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json() as { success: boolean };
    if (result.success) {
      fetchMemos();
      fetch(`/api/memos/${selectedMemo.id}/embed`, { method: 'POST' })
        .then(() => {}, () => {});
    }
  };

  const handlePin = async (id: string) => {
    const memo = memos.find((m) => m.id === id);
    if (!memo) return;
    const res = await fetch(`/api/memos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !memo.is_pinned }),
    });
    if ((await res.json() as { success: boolean }).success) fetchMemos();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/memos/${deleteId}`, { method: 'DELETE' });
      if ((await res.json() as { success: boolean }).success) fetchMemos();
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleSaveIdeaMemo = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('저장할 아이디어가 없습니다');
    }

    const res = await fetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '💡 AI 아이디어', content: trimmed, color: 'blue' }),
    });

    const result = await res.json() as { success: boolean; data?: { id: string }; error?: string };
    if (!result.success) {
      throw new Error(result.error ?? '메모 저장에 실패했습니다');
    }

    if (result.data?.id) {
      fetch(`/api/memos/${result.data.id}/embed`, { method: 'POST' }).catch(() => {});
    }

  }, []);

  const handleExtractIdeaTodos = useCallback(async (text: string): Promise<ExtractedTodo[]> => {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('추출할 아이디어가 없습니다');
    }

    const res = await fetch('/api/todos/from-idea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ideaText: trimmed }),
    });

    const result = await res.json() as {
      success: boolean;
      data?: ExtractedTodo[];
      error?: string;
    };

    if (!result.success || !result.data) {
      throw new Error(result.error ?? '할일 추출에 실패했습니다');
    }

    return result.data;
  }, []);

  return (
    <div className="space-y-[25px] pb-10">
      <section className="rounded-[28px] border border-[#e5e5e7] bg-white overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <div className="px-4 py-5 sm:px-6 sm:py-6 xl:px-[30px] xl:py-[30px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0071e3]">Memo Workflow</p>
              <h1 className="text-[24px] font-bold leading-[1.25] text-[#1d1d1f] sm:text-[28px]">메모</h1>
              <p className="max-w-2xl text-[15px] text-[#6e6e73]" style={{ lineHeight: '20px' }}>
                메모는 문서 작업 사이에서 아이디어와 근거를 붙잡아 두는 중간 작업 공간입니다.
                메모에서 정리한 포인트를 AI 검색, 문서 생성, 공유 가능한 운영 문서로 바로 이어갈 수 있습니다.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricCard label="전체 메모" value={memos.length} />
                <MetricCard label="고정 메모" value={pinnedMemoCount} />
                <MetricCard label="문서 맥락 메모" value={documentContext ? 1 : 0} />
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => { setSelectedMemo(null); setModalOpen(true); }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0071e3] transition-colors"
                >
                  <StickyNote size={16} />
                  메모 시작
                </button>
                <button
                  onClick={() => router.push(`/search?q=${encodeURIComponent(memoFocus)}`)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D7E7FF] bg-white px-4 py-2.5 text-sm font-medium text-[#2E6FF2] hover:bg-[#F3F8FF] transition-colors"
                >
                  <Search size={16} />
                  관련 문서 검색
                </button>
                <button
                  onClick={() => {
                    const params = new URLSearchParams({
                      create: 'true',
                      instructions: `${memoFocus}와 관련된 메모 내용을 기반으로 공유 가능한 문서를 작성하세요.`,
                    });
                    router.push(`/documents?${params.toString()}`);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D7EFDE] bg-white px-4 py-2.5 text-sm font-medium text-[#258A4E] hover:bg-[#F4FBF6] transition-colors"
                >
                  <Sparkles size={16} />
                  메모 기반 문서 작성
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-[#e5e5e7] bg-[#fbfbfc] px-4 py-5 sm:px-6 sm:py-6 xl:border-t-0 xl:border-l xl:px-[28px] xl:py-[28px]">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8494]">Recommended Flow</p>
              <div className="flex flex-col gap-3">
                <QuickAction
                  title="1. 메모 포인트를 정리합니다"
                  description={`현재 기준 항목은 "${memoFocus}"입니다. 문서에서 본 핵심 포인트를 먼저 짧게 남깁니다.`}
                  onClick={() => { setSelectedMemo(null); setModalOpen(true); }}
                />
                <QuickAction
                  title="2. 관련 문서를 다시 찾습니다"
                  description="메모 제목이나 문서 맥락을 바로 검색으로 넘겨 근거 자료와 기존 문서를 확인합니다."
                  onClick={() => router.push(`/search?q=${encodeURIComponent(memoFocus)}`)}
                />
                <QuickAction
                  title="3. 운영 문서로 이어갑니다"
                  description="메모는 초안 단계입니다. 회의록, 보고서, 검토 문서로 바로 이어서 작성할 수 있습니다."
                  onClick={() => {
                    const params = new URLSearchParams({
                      create: 'true',
                      instructions: `${memoFocus}와 관련된 메모 내용을 기반으로 공유 가능한 문서를 작성하세요.`,
                    });
                    router.push(`/documents?${params.toString()}`);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {documentContext && (
        <div className="rounded-2xl border border-[#D7E7FF] bg-[#F7FBFF] px-4 py-4 sm:px-[18px] sm:py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2E6FF2]">Document Note Context</p>
              <p className="text-[13px] font-semibold text-[#1B1F2B]">
                지금 메모는 <span className="text-[#2E6FF2]">{documentContext.documentTitle}</span> 문서 맥락에서 시작합니다.
              </p>
              <p className="text-[12px] leading-5 text-[#5E6573]">
                문서에서 확인한 포인트를 임시 메모로 남긴 뒤, 다시 검색이나 후속 문서 작성으로 이어가세요.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setSelectedMemo(null); setModalOpen(true); }}
                className="rounded-lg bg-[#1B1F2B] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#0071e3] transition-colors"
              >
                이 문서 메모 시작
              </button>
              <button
                onClick={() => router.push(`/documents/${documentContext.documentId}`)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7E7FF] bg-white px-3 py-2 text-[12px] font-medium text-[#2E6FF2] hover:bg-[#F3F8FF] transition-colors"
              >
                문서 열기
                <ArrowUpRight size={13} />
              </button>
              <button
                onClick={() => router.push(`/search?q=${encodeURIComponent(documentContext.documentTitle)}`)}
                className="rounded-lg border border-[#E2E5EA] bg-white px-3 py-2 text-[12px] font-medium text-[#4B5563] hover:bg-[#f5f5f7] transition-colors"
              >
                관련 문서 검색
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#E2E5EA] bg-[#FBFBFC] px-4 py-4 sm:px-[18px] sm:py-4">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8494]">Document Memo Flow</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
            <MemoFlowCard
              title="1. 문서에서 메모를 남깁니다"
              description="문서 상세에서 바로 메모로 들어와 핵심 포인트와 수정 아이디어를 적습니다."
            />
            <MemoFlowCard
              title="2. 메모를 검색과 문서로 연결합니다"
              description="메모 제목과 내용을 기준으로 관련 문서를 다시 찾고 후속 문서 초안을 만듭니다."
            />
            <MemoFlowCard
              title="3. 임시 메모를 운영 문서로 넘깁니다"
              description="메모는 독립 산출물이 아니라 공유 가능한 문서로 이어지는 중간 자산입니다."
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <MemoList
          memos={memos}
          search={search}
          viewMode={viewMode}
          selectedMemoIds={selectedMemoIds}
          ideaPanelOpen={ideaPanelOpen}
          onSearchChange={setSearch}
          onViewModeChange={setViewMode}
          onSelectedMemoIdsChange={setSelectedMemoIds}
          onIdeaPanelOpenChange={setIdeaPanelOpen}
          onAdd={() => { setSelectedMemo(null); setModalOpen(true); }}
          onPin={handlePin}
          onView={(memo) => { setSelectedMemo(memo); setViewOpen(true); }}
          onEdit={(memo) => { setSelectedMemo(memo); setModalOpen(true); }}
          onDelete={(id) => setDeleteId(id)}
          onMemoSaved={fetchMemos}
          onSaveIdeaMemo={handleSaveIdeaMemo}
          onExtractIdeaTodos={handleExtractIdeaTodos}
        />
      )}

      <MemoViewModal
        memo={selectedMemo}
        open={viewOpen}
        onClose={() => { setViewOpen(false); setSelectedMemo(null); }}
        onEdit={(memo) => { setViewOpen(false); setSelectedMemo(memo); setModalOpen(true); }}
        onSearch={(memo) => {
          const params = new URLSearchParams({ q: memo.title });
          router.push(`/search?${params.toString()}`);
        }}
        onCreateDocument={(memo) => {
          const params = new URLSearchParams({
            create: 'true',
            instructions: `${memo.title}\n\n${memo.content ?? ''}\n\n위 메모 내용을 기반으로 공유 가능한 문서를 작성하세요.`,
          });
          router.push(`/documents?${params.toString()}`);
        }}
      />

      <MemoFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedMemo(null); }}
        onSubmit={selectedMemo ? handleUpdate : handleCreate}
        memo={selectedMemo}
        initialData={selectedMemo ? null : memoDraftFromContext}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="메모를 삭제하시겠습니까?"
        description="삭제된 메모는 복구할 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function MemosPageSkeleton() {
  return (
    <div className="space-y-[25px] pb-10">
      <div className="animate-pulse">
        <div className="h-8 w-40 rounded-lg bg-[#e5e5e7]" />
        <div className="mt-4 h-24 rounded-2xl bg-white border border-[#E2E5EA]" />
        <div className="mt-4 h-24 rounded-2xl bg-[#FBFBFC] border border-[#E2E5EA]" />
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-40 rounded-2xl border border-[#E2E5EA] bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}

function MemoFlowCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-[#E2E5EA] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef6ff] text-[#2E6FF2]">
          <FileText size={17} />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#1B1F2B]">{title}</p>
          <p className="mt-1 text-[12px] leading-5 text-[#5E6573]">{description}</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E2E5EA] bg-[#f8f8fa] px-4 py-3.5">
      <p className="text-[12px] text-[#6e6e73]">{label}</p>
      <p className="mt-1 text-[20px] font-bold text-[#1d1d1f] font-num">{value}</p>
    </div>
  );
}

function QuickAction({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-[#E2E5EA] bg-white px-4 py-3.5 text-left hover:border-[#0071e3]/35 transition-colors">
      <p className="text-[14px] font-semibold text-[#1d1d1f]">{title}</p>
      <p className="mt-1 text-[12px] leading-5 text-[#6e6e73]">{description}</p>
    </button>
  );
}
