import { Plus, Trash2, Pencil, Save, UserCheck, UserX } from 'lucide-react';
import { Spinner } from '@/components/ui';
import type { Department, UserItem } from '@/components/settings/types';
import { ROLES } from '@/components/settings/types';

interface DepartmentsSectionProps {
  departments: Department[];
  onOpenDeptModal: (dept?: Department) => void;
  onDeleteDept: (id: string) => void;
}

export function DepartmentsSection({ departments, onOpenDeptModal, onDeleteDept }: DepartmentsSectionProps) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-4 border-b border-border sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <h2 className="text-[16px] font-semibold">부서 목록</h2>
        <button
          onClick={() => onOpenDeptModal()}
          className="flex w-full items-center justify-center gap-2 px-4 py-2 rounded-xl bg-foreground text-white text-sm font-medium hover:bg-primary transition-colors sm:w-auto"
        >
          <Plus size={16} /> 부서 추가
        </button>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <thead>
          <tr className="bg-page-bg">
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">부서명</th>
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">코드</th>
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">설명</th>
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">인원</th>
            <th className="text-right px-6 py-4 text-[12px] font-semibold text-muted uppercase">관리</th>
          </tr>
        </thead>
        <tbody>
          {departments.map((department) => (
            <tr key={department.id} className="border-b border-border last:border-b-0 hover:bg-page-bg/50">
              <td className="px-6 py-5 text-sm font-medium">{department.name}</td>
              <td className="px-6 py-5 text-sm text-muted font-num">{department.code}</td>
              <td className="px-6 py-5 text-sm text-muted">{department.description || '-'}</td>
              <td className="px-6 py-5 text-sm font-num">{department.memberCount}명</td>
              <td className="px-6 py-4 text-right">
                <button onClick={() => onOpenDeptModal(department)} className="p-2 rounded-lg hover:bg-surface-secondary text-foreground-secondary"><Pencil size={14} /></button>
                <button onClick={() => onDeleteDept(department.id)} className="ml-1 p-2 rounded-lg hover:bg-red-50 text-foreground-secondary hover:text-red-500"><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

interface UsersSectionProps {
  users: UserItem[];
  departments: Department[];
  pendingChanges: Record<string, { department_id?: string | null; role?: string }>;
  savingUserId: string | null;
  onOpenUserModal: (user?: UserItem) => void;
  onToggleUserActive: (user: UserItem) => void;
  onSetPendingDept: (userId: string, departmentId: string | null) => void;
  onSetPendingRole: (userId: string, role: string) => void;
  onSaveUserChanges: (userId: string) => void;
}

export function UsersSection({
  users,
  departments,
  pendingChanges,
  savingUserId,
  onOpenUserModal,
  onToggleUserActive,
  onSetPendingDept,
  onSetPendingRole,
  onSaveUserChanges,
}: UsersSectionProps) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-4 border-b border-border sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <h2 className="text-[16px] font-semibold">사용자 목록</h2>
        <button
          onClick={() => onOpenUserModal()}
          className="flex w-full items-center justify-center gap-2 px-4 py-2 rounded-xl bg-foreground text-white text-sm font-medium hover:bg-primary transition-colors sm:w-auto"
        >
          <Plus size={16} /> 사용자 추가
        </button>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <thead>
          <tr className="bg-page-bg">
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">이름</th>
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">이메일</th>
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">부서</th>
            <th className="text-left px-6 py-4 text-[12px] font-semibold text-muted uppercase">역할</th>
            <th className="text-right px-6 py-4 text-[12px] font-semibold text-muted uppercase">관리</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const pending = pendingChanges[user.id];
            const hasPending = !!pending;
            const displayDept = pending?.department_id !== undefined ? (pending.department_id ?? '') : (user.department_id ?? '');
            const displayRole = pending?.role !== undefined ? pending.role : user.role;

            return (
              <tr key={user.id} className={`border-b border-border last:border-b-0 transition-colors ${hasPending ? 'bg-blue-50/60' : 'hover:bg-page-bg/50'}`}>
                <td className="px-6 py-5 text-sm font-medium">
                  <span className="inline-flex items-center gap-2">
                    {user.name}
                    {user.is_active === false && <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] font-medium text-muted">비활성</span>}
                  </span>
                </td>
                <td className="px-6 py-5 text-sm text-muted">{user.email}</td>
                <td className="px-6 py-4">
                  <select
                    value={displayDept}
                    onChange={(event) => onSetPendingDept(user.id, event.target.value || null)}
                    className={`rounded-lg border bg-transparent px-3 py-2 text-sm ${hasPending && pending?.department_id !== undefined ? 'border-blue-400' : 'border-border'}`}
                  >
                    <option value="">미배정</option>
                    {departments.filter((department) => department.is_active !== false).map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={displayRole}
                    onChange={(event) => onSetPendingRole(user.id, event.target.value)}
                    className={`rounded-lg border bg-transparent px-3 py-2 text-sm ${hasPending && pending?.role !== undefined ? 'border-blue-400' : 'border-border'}`}
                  >
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 text-right flex items-center justify-end gap-1.5">
                  {hasPending && (
                    <button
                      onClick={() => onSaveUserChanges(user.id)}
                      disabled={savingUserId === user.id}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-white hover:bg-primary transition-colors disabled:opacity-50"
                    >
                      {savingUserId === user.id ? <Spinner size="sm" /> : <Save size={12} />}
                      저장
                    </button>
                  )}
                  <button onClick={() => onOpenUserModal(user)} className="p-2 rounded-lg hover:bg-surface-secondary text-foreground-secondary"><Pencil size={14} /></button>
                  {user.is_active === false ? (
                    <button onClick={() => onToggleUserActive(user)} title="재활성화" aria-label="재활성화" className="p-2 rounded-lg hover:bg-blue-50 text-foreground-secondary hover:text-primary"><UserCheck size={14} /></button>
                  ) : (
                    <button onClick={() => onToggleUserActive(user)} title="비활성화" aria-label="비활성화" className="p-2 rounded-lg hover:bg-red-50 text-foreground-secondary hover:text-red-500"><UserX size={14} /></button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
