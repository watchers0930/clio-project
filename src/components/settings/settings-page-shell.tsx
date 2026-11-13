'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Users, PenLine, FileText, LayoutGrid, Mail, Lock, HardDrive, Network } from 'lucide-react';
import { Spinner, Tabs, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import TemplatesPage from '@/app/(app)/templates/page';
import { DepartmentModal, UserModal } from '@/components/settings/settings-modals';
import { DepartmentsSection, UsersSection } from '@/components/settings/settings-sections';
import { MenusSection } from '@/components/settings/menus-section';
import { SignatureSection } from '@/components/settings/signature-section';
import { useSignatureSettings } from '@/components/settings/use-signature-settings';
import { useUserManagement } from '@/components/settings/use-user-management';
import { GmailSection } from '@/components/settings/gmail-section';
import { MemoLockSection } from '@/components/settings/memo-lock-section';
import { LocalSyncSection } from '@/components/settings/local-sync-section';
import { OrgChartSection } from '@/components/settings/org-chart-section';
import type { Department, UserItem } from '@/components/settings/types';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

type SettingsTab = 'departments' | 'users' | 'org-chart' | 'signature' | 'templates' | 'menus' | 'gmail' | 'memo-lock' | 'local-sync';

interface SettingsPageShellProps {
  initialTab?: SettingsTab;
  gmailSuccess?: string;
  gmailError?: string;
  gmailMsg?: string;
}

export function SettingsPageShell({ initialTab = 'departments', gmailSuccess, gmailError, gmailMsg }: SettingsPageShellProps) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
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

  const toast = useToast();

  type ConfirmOptions = { confirmLabel?: string; variant?: 'danger' | 'primary' };
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; description?: string; onConfirm: () => void } & ConfirmOptions>({ open: false, title: '', onConfirm: () => {} });
  const openConfirm = (title: string, description: string | undefined, onConfirm: () => void, options: ConfirmOptions = {}) => setConfirmState({ open: true, title, description, onConfirm, ...options });
  const closeConfirm = () => setConfirmState((s) => ({ ...s, open: false }));

  const {
    sigUrl, sigLoading, sigUploading, sigFileRef,
    logoUrl, logoPatternDensity, logoSettingsSaving, logoLoading, logoUploading, logoFileRef,
    sealUrl, sealLoading, sealUploading, sealFileRef,
    uploadSignature, deleteSignature,
    uploadCompanyLogo, deleteCompanyLogo, updateCompanyLogoPatternDensity,
    uploadCompanySeal, deleteCompanySeal,
  } = useSignatureSettings(tab, openConfirm, closeConfirm);

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

  const {
    pendingChanges, savingUserId,
    showUserModal, setShowUserModal, editUser,
    userName, setUserName, userEmail, setUserEmail, userPassword, setUserPassword,
    userDeptId, setUserDeptId, userRole, setUserRole, userHireDate, setUserHireDate,
    userPhone, setUserPhone, userResidentNo, setUserResidentNo,
    userAddress, setUserAddress, userPosition, setUserPosition, userSaving,
    openUserModal, saveUser, toggleUserActive, setPendingDept, setPendingRole, saveUserChanges,
  } = useUserManagement(loadUsers, openConfirm, closeConfirm);

  useEffect(() => {
    Promise.all([loadDepartments(), loadUsers()]).finally(() => setLoading(false));
  }, [loadDepartments, loadUsers]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const settingsTabs = [
    { id: 'menus', label: '메뉴', icon: <LayoutGrid size={15} /> },
    ...(isAdmin ? [{ id: 'departments', label: '부서', icon: <Building2 size={15} /> }] : []),
    ...(isAdmin ? [{ id: 'users', label: '사용자', icon: <Users size={15} /> }] : []),
    ...(isAdmin ? [{ id: 'org-chart', label: '조직도', icon: <Network size={15} /> }] : []),
    { id: 'signature', label: '서명', icon: <PenLine size={15} /> },
    ...(isAdmin ? [{ id: 'templates', label: '템플릿', icon: <FileText size={15} /> }] : []),
    { id: 'memo-lock', label: '메모 잠금', icon: <Lock size={15} /> },
    { id: 'gmail', label: 'Gmail', icon: <Mail size={15} /> },
    { id: 'local-sync', label: '로컬 동기화', icon: <HardDrive size={15} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <h1 className="text-[20px] font-bold text-foreground">설정</h1>
          <p className="mt-1.5 text-[13px] text-foreground-secondary">부서, 사용자, 서명, 템플릿을 관리합니다.</p>
        </div>
      </section>

      {/* 모바일: 3열 그리드 (가로스크롤 대신 전체 메뉴를 한눈에) */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {settingsTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as SettingsTab)}
            className={cn(
              'flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-[12px] font-medium transition-colors',
              tab === t.id
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border bg-white text-foreground-secondary hover:bg-surface-secondary'
            )}
          >
            <span className="flex-shrink-0">{t.icon}</span>
            <span className="truncate max-w-full">{t.label}</span>
          </button>
        ))}
      </div>

      {/* 데스크탑: 기존 pill 탭 */}
      <div className="hidden overflow-x-auto sm:block">
        <Tabs
          tabs={settingsTabs}
          activeTab={tab}
          onChange={(id) => setTab(id as SettingsTab)}
        />
      </div>

      {tab === 'menus' && <div><MenusSection /></div>}
      {tab === 'departments' && isAdmin && <div><DepartmentsSection departments={departments} onOpenDeptModal={openDeptModal} onDeleteDept={deleteDept} /></div>}
      {tab === 'users' && isAdmin && (
        <div>
        <UsersSection
          users={users}
          departments={departments}
          pendingChanges={pendingChanges}
          savingUserId={savingUserId}
          onOpenUserModal={openUserModal}
          onToggleUserActive={toggleUserActive}
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
          logoLoading={logoLoading}
          logoUploading={logoUploading}
          logoUrl={logoUrl}
          logoPatternDensity={logoPatternDensity}
          logoSettingsSaving={logoSettingsSaving}
          sigFileRef={sigFileRef}
          logoFileRef={logoFileRef}
          sealLoading={sealLoading}
          sealUploading={sealUploading}
          sealUrl={sealUrl}
          sealFileRef={sealFileRef}
          onDeleteSignature={deleteSignature}
          onUploadSignature={uploadSignature}
          onDeleteCompanyLogo={deleteCompanyLogo}
          onUploadCompanyLogo={uploadCompanyLogo}
          onUpdateCompanyLogoPatternDensity={updateCompanyLogoPatternDensity}
          onDeleteCompanySeal={deleteCompanySeal}
          onUploadCompanySeal={uploadCompanySeal}
          currentUserIsAdmin={isAdmin}
        />
        </div>
      )}
      {tab === 'templates' && isAdmin && <div><TemplatesPage /></div>}
      {tab === 'gmail' && <GmailSection successParam={gmailSuccess} errorParam={gmailError} msgParam={gmailMsg} />}
      {tab === 'org-chart' && isAdmin && <div><OrgChartSection /></div>}
      {tab === 'memo-lock' && <MemoLockSection />}
      {tab === 'local-sync' && <LocalSyncSection />}

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
        userHireDate={userHireDate}
        userPhone={userPhone}
        userResidentNo={userResidentNo}
        userAddress={userAddress}
        userPosition={userPosition}
        userSaving={userSaving}
        departments={departments}
        onClose={() => setShowUserModal(false)}
        onSave={saveUser}
        onChangeUserName={setUserName}
        onChangeUserEmail={setUserEmail}
        onChangeUserPassword={setUserPassword}
        onChangeUserDeptId={setUserDeptId}
        onChangeUserRole={setUserRole}
        onChangeUserHireDate={setUserHireDate}
        onChangeUserPhone={setUserPhone}
        onChangeUserResidentNo={setUserResidentNo}
        onChangeUserAddress={setUserAddress}
        onChangeUserPosition={setUserPosition}
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
    </div>
  );
}
