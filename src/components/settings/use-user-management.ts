import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import type { UserItem } from '@/components/settings/types';
import { csrfFetch } from '@/hooks/csrf-client';

type ConfirmOptions = { confirmLabel?: string; variant?: 'danger' | 'primary' };
type PendingChanges = Record<string, { department_id?: string | null; role?: string }>;

/**
 * 설정 > 사용자 탭의 사용자 추가·수정 모달, 활성/비활성 전환, 부서·역할 인라인 변경 저장에 대한
 * 상태와 핸들러를 한곳에 응집한 훅.
 * users 목록 로드(loadUsers)와 확인 다이얼로그(openConfirm/closeConfirm)는 페이지 쉘이 소유한 것을 주입받는다.
 */
export function useUserManagement(
  loadUsers: () => Promise<void>,
  openConfirm: (title: string, description: string | undefined, onConfirm: () => void, options?: ConfirmOptions) => void,
  closeConfirm: () => void,
) {
  const toast = useToast();

  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userDeptId, setUserDeptId] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [userHireDate, setUserHireDate] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userResidentNo, setUserResidentNo] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [userPosition, setUserPosition] = useState('');
  const [userSaving, setUserSaving] = useState(false);

  const openUserModal = (user?: UserItem) => {
    setEditUser(user ?? null);
    setUserName(user?.name ?? '');
    setUserEmail(user?.email ?? '');
    setUserPassword('');
    setUserDeptId(user?.department_id ?? '');
    setUserRole(user?.role ?? 'user');
    setUserHireDate((user as { hire_date?: string | null } | undefined)?.hire_date ?? '');
    setUserPhone((user as { phone?: string | null } | undefined)?.phone ?? '');
    setUserResidentNo((user as { resident_no?: string | null } | undefined)?.resident_no ?? '');
    setUserAddress((user as { address?: string | null } | undefined)?.address ?? '');
    setUserPosition((user as { position?: string | null } | undefined)?.position ?? '');
    setShowUserModal(true);
  };

  const saveUser = async () => {
    if (editUser) {
      if (!userName.trim()) return;
      setUserSaving(true);
      try {
        const res = await csrfFetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editUser.id,
            name: userName,
            email: userEmail !== editUser.email ? userEmail : undefined,
            password: userPassword || undefined,
            departmentId: userDeptId || null,
            role: userRole,
            hireDate: userHireDate || null,
            phone: userPhone || null,
            residentNo: userResidentNo || null,
            address: userAddress || null,
            position: userPosition || null,
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
        const res = await csrfFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userName,
            email: userEmail,
            password: userPassword,
            departmentId: userDeptId || null,
            role: userRole,
            hireDate: userHireDate || null,
            phone: userPhone || null,
            residentNo: userResidentNo || null,
            address: userAddress || null,
            position: userPosition || null,
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

  // 퇴사자 등은 영구 삭제하지 않고 비활성화(결재·근태 기록 보존, 로그인 차단)
  const toggleUserActive = (user: UserItem) => {
    const activate = user.is_active === false;
    const action = activate ? '재활성화' : '비활성화';
    const detail = activate ? '재활성화하면 다시 로그인할 수 있습니다.' : '비활성화된 사용자는 로그인할 수 없습니다. 결재·근태 기록은 그대로 보존됩니다.';
    openConfirm(`"${user.name}" 사용자를 ${action}하시겠습니까?`, detail, async () => {
      try {
        const res = await csrfFetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: user.id, isActive: activate }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.error ?? `사용자 ${action}에 실패했습니다.`);
          closeConfirm();
          return;
        }
        await loadUsers();
      } catch {
        toast.error(`사용자 ${action} 중 오류가 발생했습니다.`);
      }
      closeConfirm();
    }, { confirmLabel: action, variant: activate ? 'primary' : 'danger' });
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
      const res = await csrfFetch('/api/users', {
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

  return {
    pendingChanges, savingUserId,
    showUserModal, setShowUserModal, editUser,
    userName, setUserName, userEmail, setUserEmail, userPassword, setUserPassword,
    userDeptId, setUserDeptId, userRole, setUserRole, userHireDate, setUserHireDate,
    userPhone, setUserPhone, userResidentNo, setUserResidentNo,
    userAddress, setUserAddress, userPosition, setUserPosition, userSaving,
    openUserModal, saveUser, toggleUserActive, setPendingDept, setPendingRole, saveUserChanges,
  };
}
