'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Upload, Search } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { CredentialFormModal, type CredentialRow } from './credential-form-modal';
import { CsvImportModal } from './csv-import-modal';

export function CredentialsTable() {
  const toast = useToast();
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CredentialRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/account-credentials');
      const json = await res.json() as { data?: CredentialRow[] };
      setRows(json.data ?? []);
    } catch {
      // 오류 시 빈 목록 유지
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleVisible = (id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredRows = query.trim()
    ? rows.filter((r) => {
        const q = query.toLowerCase();
        return r.site_name.toLowerCase().includes(q) || r.site_url.toLowerCase().includes(q) || r.username.toLowerCase().includes(q);
      })
    : rows;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-quaternary" />
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="사이트명 · 주소 · 아이디"
                className="h-9 w-56 rounded-xl border border-border bg-surface-secondary pl-8 pr-3 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => setCsvModalOpen(true)}
              className="flex items-center gap-1.5 h-9 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground hover:bg-surface-secondary transition-colors"
            >
              <Upload size={15} strokeWidth={1.5} />
              CSV 가져오기
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 h-9 rounded-xl bg-primary px-4 text-[13px] font-medium text-white hover:bg-primary-dark transition-colors"
            >
              <Plus size={15} strokeWidth={1.5} />
              계정 추가
            </button>
          </div>
        </div>

        {/* 테이블 */}
        <div className="mt-[10px] mb-[10px] overflow-x-auto rounded-xl border border-border">
          <table className="w-full table-fixed text-[13px]">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[40%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="bg-surface-secondary">
                <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">사이트명</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">사이트 주소</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">아이디 / 비밀번호</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">작성일자</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground-secondary">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[13px] text-foreground-tertiary">
                    {query ? `"${query}" 검색 결과가 없습니다.` : '저장된 계정이 없습니다. 계정 추가 버튼을 눌러 등록해주세요.'}
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => {
                  const visible = visibleIds.has(row.id);
                  return (
                    <tr key={row.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground truncate">{row.site_name}</td>
                      <td className="px-4 py-3 overflow-hidden">
                        {row.site_url ? (
                          <a
                            href={row.site_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline whitespace-nowrap overflow-hidden text-ellipsis block"
                          >
                            {row.site_url}
                          </a>
                        ) : (
                          <span className="text-foreground-quaternary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-foreground-secondary truncate">{row.username}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-foreground-tertiary text-[12px] tracking-widest">
                              {visible ? row.password : '•'.repeat(Math.min(row.password.length, 10))}
                            </span>
                            <button
                              onClick={() => toggleVisible(row.id)}
                              className="text-foreground-quaternary hover:text-foreground-secondary transition-colors flex-shrink-0"
                            >
                              {visible
                                ? <EyeOff size={13} strokeWidth={1.5} />
                                : <Eye size={13} strokeWidth={1.5} />
                              }
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground-secondary">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 text-center">
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

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-foreground-quaternary">
            {query ? `${filteredRows.length}개 검색됨 (전체 ${rows.length}개)` : `총 ${rows.length}개 계정`} · 비밀번호는 AES-256 암호화로 저장됩니다.
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 w-8 rounded-lg border border-border text-[13px] text-foreground-secondary hover:bg-surface-secondary disabled:opacity-30 transition-colors"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={[
                    'h-8 w-8 rounded-lg text-[13px] transition-colors',
                    p === page
                      ? 'bg-primary text-white font-semibold'
                      : 'border border-border text-foreground-secondary hover:bg-surface-secondary',
                  ].join(' ')}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 w-8 rounded-lg border border-border text-[13px] text-foreground-secondary hover:bg-surface-secondary disabled:opacity-30 transition-colors"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      <CredentialFormModal
        open={modalOpen}
        editing={editingRow}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <CsvImportModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImported={(count) => {
          toast.success(`${count}개 계정을 가져왔습니다.`);
          void load();
        }}
      />
    </>
  );
}
