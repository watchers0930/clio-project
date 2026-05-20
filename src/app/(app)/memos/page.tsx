'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
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
    <div className="flex flex-col gap-5 pb-10">
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-5 px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[20px] font-bold text-foreground">메모</h1>
              <p className="mt-1.5 text-[13px] text-foreground-secondary">
                아이디어와 포인트를 정리한 뒤, AI 검색이나 문서 생성으로 이어갑니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSelectedMemo(null); setModalOpen(true); }}
                className="h-9 rounded-xl bg-foreground px-4 text-[13px] font-medium text-white transition-colors hover:bg-primary"
              >
                메모 시작
              </button>
              <button
                onClick={() => router.push(`/search?q=${encodeURIComponent(memoFocus)}`)}
                className="h-9 rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary"
              >
                관련 문서 검색
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">전체 메모</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{memos.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">고정 메모</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{pinnedMemoCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold text-foreground-tertiary">문서 맥락 메모</p>
                <p className="text-[18px] font-bold text-foreground font-num leading-tight">{documentContext ? 1 : 0}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {documentContext && (
        <div className="rounded-2xl border border-border-tint bg-primary-tint px-4 py-4 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Document Note Context</p>
              <p className="text-[13px] font-semibold text-foreground">
                지금 메모는 <span className="text-primary">{documentContext.documentTitle}</span> 문서 맥락에서 시작합니다.
              </p>
              <p className="text-[12px] leading-5 text-foreground-secondary">
                문서에서 확인한 포인트를 임시 메모로 남긴 뒤, 다시 검색이나 후속 문서 작성으로 이어가세요.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setSelectedMemo(null); setModalOpen(true); }}
                className="rounded-lg bg-foreground px-3 py-2 text-[12px] font-medium text-white hover:bg-primary transition-colors"
              >
                이 문서 메모 시작
              </button>
              <button
                onClick={() => router.push(`/documents/${documentContext.documentId}`)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-tint bg-white px-3 py-2 text-[12px] font-medium text-primary hover:bg-primary-tint transition-colors"
              >
                문서 열기
                <ArrowUpRight size={13} />
              </button>
              <button
                onClick={() => router.push(`/search?q=${encodeURIComponent(documentContext.documentTitle)}`)}
                className="rounded-lg border border-border bg-white px-3 py-2 text-[12px] font-medium text-foreground-secondary hover:bg-surface-secondary transition-colors"
              >
                관련 문서 검색
              </button>
            </div>
          </div>
        </div>
      )}

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
    <div className="flex flex-col gap-5 pb-10">
      <div className="animate-pulse">
        <div className="h-8 w-40 rounded-lg bg-border" />
        <div className="mt-4 h-24 rounded-2xl bg-white border border-border" />
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-40 rounded-2xl border border-border bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
