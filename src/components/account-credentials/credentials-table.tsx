'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { CredentialFormModal, type CredentialRow } from './credential-form-modal';

export function CredentialsTable() {
  const toast = useToast();
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CredentialRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/account-credentials');
      const json = await res.json() as { data?: CredentialRow[] };
      setRows(json.data ?? []);
    } catch {
      toast.error('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const toggleVisible = (id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openAdd = () => { setEditingRow(null); setModalOpen(true); };
  const openEdit = (row: CredentialRow) => { setEditingRow(row); setModalOpen(true); };

  const handleSaved = (saved: CredentialRow) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    toast.success(editingRow ? '수정되었습니다.' : '추가되었습니다.');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 계정을 삭제하시겠습니까?')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/account-credentials/${id}`, { method: 'DELETE' });
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success('삭제되었습니다.');
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-semibold text-foreground">계정관리</h2>
            <p className="mt-0.5 text-[13px] text-foreground-secondary">
              저장된 사이트 계정 정보 — 비밀번호는 암호화되어 보관됩니다.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 h-9 rounded-xl bg-primary px-4 text-[13px] font-medium text-white hover:bg-primary-dark transition-colors"
          >
            <Plus size={15} strokeWidth={1.5} />
            계정 추가
          </button>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-secondary">
                <th className="px-4 py-3 text-left font-semibold text-foreground-secondary w-[220px]">사이트명</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground-secondary w-[220px]">아이디</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">비밀번호</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground-secondary w-[120px]">작성일자</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground-secondary w-[80px]">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[13px] text-foreground-tertiary">
                    저장된 계정이 없습니다. 계정 추가 버튼을 눌러 등록해주세요.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const visible = visibleIds.has(row.id);
                  return (
                    <tr key={row.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{row.site_name}</td>
                      <td className="px-4 py-3 text-foreground-secondary">{row.username}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-foreground-secondary tracking-widest">
                            {visible ? row.password : '•'.repeat(Math.min(row.password.length, 10))}
                          </span>
                          <button
                            onClick={() => toggleVisible(row.id)}
                            className="text-foreground-quaternary hover:text-foreground-secondary transition-colors"
                          >
                            {visible
                              ? <EyeOff size={14} strokeWidth={1.5} />
                              : <Eye size={14} strokeWidth={1.5} />
                            }
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground-secondary">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(row)}
                            className="text-foreground-secondary hover:text-primary transition-colors"
                            title="수정"
                          >
                            <Pencil size={14} strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => void handleDelete(row.id)}
                            disabled={deletingId === row.id}
                            className="text-foreground-secondary hover:text-red-500 transition-colors disabled:opacity-40"
                            title="삭제"
                          >
                            <Trash2 size={14} strokeWidth={1.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-foreground-quaternary">
          총 {rows.length}개 계정 · 비밀번호는 AES-256 암호화로 저장됩니다.
        </p>
      </div>

      <CredentialFormModal
        open={modalOpen}
        editing={editingRow}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}
