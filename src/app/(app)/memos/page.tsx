'use client';

import { useState, useEffect, useCallback } from 'react';
import { StickyNote } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import MemoList from '@/components/memos/memo-list';
import MemoFormModal from '@/components/memos/memo-form-modal';
import MemoViewModal from '@/components/memos/memo-view-modal';
import IdeaSuggestPanel from '@/components/memos/IdeaSuggestPanel';
import type { MemoFormData } from '@/components/memos/memo-form-modal';
import type { MemoItem } from '@/lib/supabase/types';
import type { MemoGroup } from '@/hooks/useMemoGroups';

export default function MemosPage() {
  const [loading, setLoading] = useState(true);
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [search, setSearch] = useState('');

  // 모달 상태
  const [viewOpen, setViewOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<MemoItem | null>(null);

  // 삭제 확인
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 아이디어 제안 패널 상태
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<MemoGroup | null>(null);

  // 데이터 로드
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

  // 생성
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

  // 수정
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

  // 핀 토글
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

  // 삭제
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

  // 아이디어 제안
  const handleSuggest = (group: MemoGroup) => {
    setSelectedGroup(group);
    setSuggestOpen(true);
  };

  // "메모로 저장" — 제안 내용을 새 메모로 생성
  const handleSaveAsMemo = async (content: string) => {
    if (!selectedGroup) return;
    const title = `아이디어 제안 — ${selectedGroup.name}`;
    const res = await fetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, color: 'blue' }),
    });
    const result = await res.json() as { success: boolean; data?: MemoItem };
    if (result.success) {
      fetchMemos();
      setSuggestOpen(false);
      if (result.data?.id) {
        fetch(`/api/memos/${result.data.id}/embed`, { method: 'POST' })
          .then(() => {}, () => {});
      }
    }
  };

  // "문서로 생성" — /documents 페이지로 이동 (기존 파이프라인 연결)
  const handleCreateDocument = (content: string) => {
    const encoded = encodeURIComponent(content);
    window.location.href = `/documents?idea=${encoded}`;
  };

  // 관련 메모 클릭 → 해당 메모 뷰 오픈
  const handleNavigateToRelated = (memo: MemoItem) => {
    setSelectedMemo(memo);
    setViewOpen(true);
  };

  return (
    <div className="w-full" style={{ maxWidth: '94%', margin: '0 auto', paddingTop: 36, paddingBottom: 40 }}>
      {/* 헤더 */}
      <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
        <StickyNote size={24} className="text-[#2E6FF2]" />
        <h1 className="text-[22px] font-semibold text-[#1B1F2B]">메모</h1>
      </div>

      {/* 콘텐츠 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <MemoList
          memos={memos}
          search={search}
          onSearchChange={setSearch}
          onAdd={() => { setSelectedMemo(null); setModalOpen(true); }}
          onPin={handlePin}
          onView={(memo) => { setSelectedMemo(memo); setViewOpen(true); }}
          onEdit={(memo) => { setSelectedMemo(memo); setModalOpen(true); }}
          onDelete={(id) => setDeleteId(id)}
          onSuggest={handleSuggest}
        />
      )}

      {/* 메모 뷰 모달 */}
      <MemoViewModal
        memo={selectedMemo}
        open={viewOpen}
        onClose={() => { setViewOpen(false); setSelectedMemo(null); }}
        onEdit={(memo) => { setViewOpen(false); setSelectedMemo(memo); setModalOpen(true); }}
        onNavigateToRelated={handleNavigateToRelated}
      />

      {/* 메모 생성/수정 모달 */}
      <MemoFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedMemo(null); }}
        onSubmit={selectedMemo ? handleUpdate : handleCreate}
        memo={selectedMemo}
      />

      {/* 삭제 확인 */}
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

      {/* 아이디어 제안 패널 */}
      <IdeaSuggestPanel
        open={suggestOpen}
        group={selectedGroup}
        onClose={() => { setSuggestOpen(false); setSelectedGroup(null); }}
        onSaveAsMemo={handleSaveAsMemo}
        onCreateDocument={handleCreateDocument}
      />
    </div>
  );
}
