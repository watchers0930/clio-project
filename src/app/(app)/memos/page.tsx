'use client';

import { useState, useEffect, useCallback } from 'react';
import { StickyNote } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import MemoList from '@/components/memos/memo-list';
import MemoFormModal from '@/components/memos/memo-form-modal';
import type { MemoFormData } from '@/components/memos/memo-form-modal';
import type { MemoItem } from '@/lib/supabase/types';

export default function MemosPage() {
  const [loading, setLoading] = useState(true);
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [search, setSearch] = useState('');

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<MemoItem | null>(null);

  // 삭제 확인
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 데이터 로드
  const fetchMemos = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);

    fetch(`/api/memos?${params}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setMemos(res.data ?? []); })
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
    if ((await res.json()).success) fetchMemos();
  };

  // 수정
  const handleUpdate = async (data: MemoFormData) => {
    if (!selectedMemo) return;
    const res = await fetch(`/api/memos/${selectedMemo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if ((await res.json()).success) fetchMemos();
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
    if ((await res.json()).success) fetchMemos();
  };

  // 삭제
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/memos/${deleteId}`, { method: 'DELETE' });
      if ((await res.json()).success) fetchMemos();
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
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
          onEdit={(memo) => { setSelectedMemo(memo); setModalOpen(true); }}
          onDelete={(id) => setDeleteId(id)}
        />
      )}

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
    </div>
  );
}
