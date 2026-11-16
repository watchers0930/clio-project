'use client';

import { useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useAuthStore } from '@/store/auth-store';
import { useWorkLedger } from '@/hooks/use-work-ledger';
import { exportWorkLedgerExcel } from '@/lib/work-ledger/excel';
import type { WorkProject, WorkProjectInput } from '@/lib/work-ledger/types';
import { WorkLedgerSummary } from './work-ledger-summary';
import { WorkLedgerFilters, type SortKey, type StatusFilter } from './work-ledger-filters';
import { WorkLedgerTable } from './work-ledger-table';
import { WorkProjectFormModal } from './work-project-form-modal';
import { WorkProjectDetailModal } from './work-project-detail-modal';

/** 미수금 중 가장 빠른 예정일 (정렬용) */
function nextDue(project: WorkProject): string {
  const dues = project.payments.filter((p) => !p.paid && p.due_date).map((p) => p.due_date as string);
  return dues.length ? dues.sort()[0] : '9999-99-99';
}

export function WorkLedgerView() {
  const toast = useToast();
  const { confirmState, openConfirm, closeConfirm } = useConfirmDialog();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const { projects, departments, managers, loading, createProject, updateProject, deleteProject } = useWorkLedger();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkProject | null>(null);
  const [viewing, setViewing] = useState<WorkProject | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.client_name ?? '').toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sortKey === 'amount') return b.contract_amount - a.contract_amount;
      if (sortKey === 'due') return nextDue(a).localeCompare(nextDue(b));
      return b.created_at.localeCompare(a.created_at);
    });
    return list;
  }, [projects, query, statusFilter, sortKey]);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: WorkProject) => { setEditing(p); setModalOpen(true); };

  const handleSubmit = async (input: WorkProjectInput) => {
    if (editing) {
      await updateProject(editing.id, input);
      toast.success('수정되었습니다.');
    } else {
      await createProject(input);
      toast.success('추가되었습니다.');
    }
  };

  // 공용 확인창(Escape=취소) → 확인 시 창을 닫고 삭제
  const handleDelete = (p: WorkProject) =>
    openConfirm('작업 삭제', `'${p.name}' 작업을 삭제합니다.`, () => {
      closeConfirm();
      deleteProject(p.id).then(
        () => toast.success('삭제되었습니다.'),
        (e) => toast.error(e instanceof Error ? e.message : '삭제에 실패했습니다.'),
      );
    }, { confirmLabel: '삭제' });

  const handleExport = async () => {
    try {
      await exportWorkLedgerExcel(visible);
    } catch {
      toast.error('엑셀 내보내기에 실패했습니다.');
    }
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
      <div className="space-y-10">
        <div>
          <h2 className="text-[16px] font-semibold text-foreground">작업내역</h2>
          <p className="mt-1.5 text-[13px] text-foreground-secondary">진행 중인 프로젝트의 계약·수익·수금 일정을 관리합니다.</p>
        </div>

        <WorkLedgerSummary projects={projects} />

        <WorkLedgerFilters
          query={query}
          onQuery={setQuery}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          sortKey={sortKey}
          onSortKey={setSortKey}
          onExport={() => void handleExport()}
          onAdd={openAdd}
          exportDisabled={visible.length === 0}
        />

        <WorkLedgerTable
          projects={visible}
          currentUserId={currentUserId}
          onView={setViewing}
          onEdit={openEdit}
          onDelete={(p) => void handleDelete(p)}
        />

        <p className="text-[11px] text-foreground-quaternary">
          {query || statusFilter !== 'all' ? `${visible.length}개 표시 (전체 ${projects.length}개)` : `총 ${projects.length}개 작업`}
        </p>
      </div>

      <WorkProjectFormModal
        open={modalOpen}
        editing={editing}
        departments={departments}
        managers={managers}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />

      <WorkProjectDetailModal
        open={!!viewing}
        project={viewing}
        departments={departments}
        onClose={() => setViewing(null)}
      />

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel ?? '삭제'}
        variant={confirmState.variant ?? 'danger'}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </>
  );
}
