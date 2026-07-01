'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Building2, Users, PenLine, FileText, LayoutGrid } from 'lucide-react';
import { Spinner, Tabs, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import TemplatesPage from '@/app/(app)/templates/page';
import { DepartmentModal, UserModal } from '@/components/settings/settings-modals';
import { DepartmentsSection, MenusSection, SignatureSection, UsersSection } from '@/components/settings/settings-sections';
import type { Department, UserItem } from '@/components/settings/types';

type SettingsTab = 'departments' | 'users' | 'signature' | 'templates' | 'menus';

interface SettingsPageShellProps {
  initialTab?: SettingsTab;
}

export function SettingsPageShell({ initialTab = 'departments' }: SettingsPageShellProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const [pendingChanges, setPendingChanges] = useState<Record<string, { department_id?: string | null; role?: string }>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const toast = useToast();

  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; description?: string; onConfirm: () => void }>({ open: false, title: '', onConfirm: () => {} });
  const openConfirm = (title: string, description: string | undefined, onConfirm: () => void) => setConfirmState({ open: true, title, description, onConfirm });
  const closeConfirm = () => setConfirmState((s) => ({ ...s, open: false }));

  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userDeptId, setUserDeptId] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [userSaving, setUserSaving] = useState(false);

  const [sigUrl, setSigUrl] = useState<string | null>(null);
  const [sigLoading, setSigLoading] = useState(false);
  const [sigUploading, setSigUploading] = useState(false);
  const sigFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/departments');
      const json = await res.json();
      if (res.ok && json.data) {
        setDepartments(json.data);
      } else {
        console.error('[settings] departments load:', json.error);
      }
    } catch (err) {
      console.error('[settings] departments load error:', err);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    Promise.all([loadDepartments(), loadUsers()]).finally(() => setLoading(false));
  }, [loadDepartments, loadUsers]);

  useEffect(() => {
    if (tab !== 'signature') return;
    setSigLoading(true);
    fetch('/api/auth/signature')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setSigUrl(data.data?.url ?? null);
      })
      .catch(() => {})
      .finally(() => setSigLoading(false));
  }, [tab]);

  const uploadSignature = async (file: File) => {
    if (sigUploading) return;
    setSigUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/auth/signature', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setSigUrl(data.data?.url ?? null);
        toast.success('서명이 등록되었습니다.');
      } else {
        toast.error(data.error ?? '업로드 실패');
      }
    } catch {
      toast.error('업로드 중 오류가 발생했습니다.');
    }
    setSigUploading(false);
  };

  const deleteSignature = () => {
    openConfirm('서명을 삭제하시겠습니까?', '삭제된 서명은 복구할 수 없습니다.', async () => {
      try {
        await fetch('/api/auth/signature', { method: 'DELETE' });
        setSigUrl(null);
        toast.success('서명이 삭제되었습니다.');
      } catch {
        toast.error('삭제 중 오류가 발생했습니다.');
      }
      closeConfirm();
    });
  };

  const openDeptModal = (dept?: Department) => {
    setEditDept(dept ?? null);
    setDeptName(dept?.name ?? '');
    setDeptCode(dept?.code ?? '');
    setDeptDesc(dept?.description ?? '');
    setShowDeptModal(true);
  };

  const saveDept = async () => {
    if (!deptName.trim() || !deptCode.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/departments', {
        method: editDept ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editDept
            ? { id: editDept.id, name: deptName, code: deptCode, description: deptDesc }
            : { name: deptName, code: deptCode, description: deptDesc }
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? '부서 저장에 실패했습니다.');
        return;
      }
      await loadDepartments();
      setShowDeptModal(false);
    } catch {
      toast.error('부서 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const deleteDept = (id: string) => {
    openConfirm('이 부서를 삭제하시겠습니까?', '직원이 있는 부서는 삭제할 수 없습니다.', async () => {
      await fetch(`/api/departments?id=${id}`, { method: 'DELETE' });
      await loadDepartments();
      closeConfirm();
    });
  };

  const openUserModal = (user?: UserItem) => {
    setEditUser(user ?? null);
    setUserName(user?.name ?? '');
    setUserEmail(user?.email ?? '');
    setUserPassword('');
    setUserDeptId(user?.department_id ?? '');
    setUserRole(user?.role ?? 'user');
    setShowUserModal(true);
  };

  const saveUser = async () => {
    if (editUser) {
      if (!userName.trim()) return;
      setUserSaving(true);
      try {
        const res = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editUser.id,
            name: userName,
            email: userEmail !== editUser.email ? userEmail : undefined,
            password: userPassword || undefined,
            departmentId: userDeptId || null,
            role: userRole,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.error ?? '사용자 수정에 실패했습니다.');
          return;
        }
        await loadUsers();
        setShowUserModal(false);
      } catch {
        toast.error('사용자 수정 중 오류가 발생했습니다.');
      } finally {
        setUserSaving(false);
      }
    } else {
      if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) return;
      setUserSaving(true);
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userName,
            email: userEmail,
            password: userPassword,
            departmentId: userDeptId || null,
            role: userRole,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.error ?? '사용자 추가에 실패했습니다.');
          return;
        }
        await loadUsers();
        setShowUserModal(false);
      } catch {
        toast.error('사용자 추가 중 오류가 발생했습니다.');
      } finally {
        setUserSaving(false);
      }
    }
  };

  const deleteUser = (id: string, name: string) => {
    openConfirm(`"${name}" 사용자를 비활성화하시겠습니까?`, '비활성화된 사용자는 로그인할 수 없습니다.', async () => {
      try {
        const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.error ?? '사용자 비활성화에 실패했습니다.');
          closeConfirm();
          return;
        }
        await loadUsers();
      } catch {
        toast.error('사용자 삭제 중 오류가 발생했습니다.');
      }
      closeConfirm();
    });
  };

  const setPendingDept = (userId: string, departmentId: string | null) => {
    setPendingChanges((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], department_id: departmentId },
    }));
  };

  const setPendingRole = (userId: string, role: string) => {
    setPendingChanges((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], role },
    }));
  };

  const saveUserChanges = async (userId: string) => {
    const changes = pendingChanges[userId];
    if (!changes) return;
    setSavingUserId(userId);
    try {
      const body: Record<string, unknown> = { id: userId };
      if (changes.department_id !== undefined) body.departmentId = changes.department_id;
      if (changes.role !== undefined) body.role = changes.role;
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? '저장에 실패했습니다.');
        return;
      }
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      await loadUsers();
      toast.success('저장되었습니다.');
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <h1 className="text-[20px] font-bold text-foreground">설정</h1>
          <p className="mt-1.5 text-[13px] text-foreground-secondary">부서, 사용자, 서명, 템플릿을 관리합니다.</p>
        </div>
      </section>

      <div className="overflow-x-auto">
        <Tabs
        tabs={[
          { id: 'menus', label: '메뉴', icon: <LayoutGrid size={15} /> },
          { id: 'departments', label: '부서', icon: <Building2 size={15} /> },
          { id: 'users', label: '사용자', icon: <Users size={15} /> },
          { id: 'signature', label: '서명', icon: <PenLine size={15} /> },
          { id: 'templates', label: '템플릿', icon: <FileText size={15} /> },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as SettingsTab)}
        />
      </div>

      {tab === 'menus' && <div><MenusSection /></div>}
      {tab === 'departments' && <div><DepartmentsSection departments={departments} onOpenDeptModal={openDeptModal} onDeleteDept={deleteDept} /></div>}
      {tab === 'users' && (
        <div>
        <UsersSection
          users={users}
          departments={departments}
          pendingChanges={pendingChanges}
          savingUserId={savingUserId}
          onOpenUserModal={openUserModal}
          onDeleteUser={deleteUser}
          onSetPendingDept={setPendingDept}
          onSetPendingRole={setPendingRole}
          onSaveUserChanges={saveUserChanges}
        />
        </div>
      )}
      {tab === 'signature' && (
        <div>
        <SignatureSection
          sigLoading={sigLoading}
          sigUploading={sigUploading}
          sigUrl={sigUrl}
          sigFileRef={sigFileRef}
          onDeleteSignature={deleteSignature}
          onUploadSignature={uploadSignature}
        />
        </div>
      )}
      {tab === 'templates' && <div><TemplatesPage /></div>}

      <DepartmentModal
        open={showDeptModal}
        editDept={editDept}
        deptName={deptName}
        deptCode={deptCode}
        deptDesc={deptDesc}
        saving={saving}
        onClose={() => setShowDeptModal(false)}
        onSave={saveDept}
        onChangeDeptName={setDeptName}
        onChangeDeptCode={(value) => setDeptCode(value.toUpperCase())}
        onChangeDeptDesc={setDeptDesc}
      />
      <UserModal
        open={showUserModal}
        editUser={editUser}
        userName={userName}
        userEmail={userEmail}
        userPassword={userPassword}
        userDeptId={userDeptId}
        userRole={userRole}
        userSaving={userSaving}
        departments={departments}
        onClose={() => setShowUserModal(false)}
        onSave={saveUser}
        onChangeUserName={setUserName}
        onChangeUserEmail={setUserEmail}
        onChangeUserPassword={setUserPassword}
        onChangeUserDeptId={setUserDeptId}
        onChangeUserRole={setUserRole}
      />

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}
