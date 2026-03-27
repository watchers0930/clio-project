'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Users, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

/* ── types ── */
interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  manager_id: string | null;
  is_active: boolean;
  memberCount: number;
}

interface UserItem {
  id: string;
  email: string;
  name: string;
  department_id: string | null;
  departmentName: string;
  role: string;
  is_active: boolean;
}

const ROLES = [
  { value: 'admin', label: '관리자', color: 'text-red-500' },
  { value: 'manager', label: '매니저', color: 'text-blue-500' },
  { value: 'user', label: '사용자', color: 'text-gray-500' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<'departments' | 'users'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 부서 모달
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // 사용자 추가/수정 모달
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userDeptId, setUserDeptId] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [userSaving, setUserSaving] = useState(false);

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
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([loadDepartments(), loadUsers()]).finally(() => setLoading(false));
  }, [loadDepartments, loadUsers]);

  /* ── 부서 CRUD ── */
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
        body: JSON.stringify(editDept
          ? { id: editDept.id, name: deptName, code: deptCode, description: deptDesc }
          : { name: deptName, code: deptCode, description: deptDesc }
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error ?? '부서 저장에 실패했습니다.');
        return;
      }
      await loadDepartments();
      setShowDeptModal(false);
    } catch {
      alert('부서 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const deleteDept = async (id: string) => {
    if (!confirm('이 부서를 비활성화하시겠습니까?')) return;
    await fetch(`/api/departments?id=${id}`, { method: 'DELETE' });
    await loadDepartments();
  };

  /* ── 사용자 추가/수정 ── */
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
      // 수정 모드
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
            departmentId: userDeptId || null,
            role: userRole,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          alert(json.error ?? '사용자 수정에 실패했습니다.');
          return;
        }
        await loadUsers();
        setShowUserModal(false);
      } catch {
        alert('사용자 수정 중 오류가 발생했습니다.');
      } finally {
        setUserSaving(false);
      }
    } else {
      // 추가 모드
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
          alert(json.error ?? '사용자 추가에 실패했습니다.');
          return;
        }
        await loadUsers();
        setShowUserModal(false);
      } catch {
        alert('사용자 추가 중 오류가 발생했습니다.');
      } finally {
        setUserSaving(false);
      }
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`"${name}" 사용자를 비활성화하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error ?? '사용자 비활성화에 실패했습니다.');
        return;
      }
      await loadUsers();
    } catch {
      alert('사용자 삭제 중 오류가 발생했습니다.');
    }
  };

  /* ── 사용자 수정 ── */
  const updateUserRole = async (userId: string, role: string) => {
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, role }),
    });
    await loadUsers();
  };

  const updateUserDept = async (userId: string, departmentId: string | null) => {
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, departmentId }),
    });
    await loadUsers();
  };

  const toggleUserActive = async (userId: string, isActive: boolean) => {
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, isActive }),
    });
    await loadUsers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ borderBottom: '1px solid #e5e5e7', paddingBottom: 12 }}>
        <h1 className="text-[24px] font-bold text-foreground">설정</h1>
        <p className="text-[14px] text-muted mt-1">부서와 사용자를 관리합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-[#f5f5f7] rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('departments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'departments' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'}`}
        >
          <Building2 size={16} /> 부서 관리
        </button>
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'users' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'}`}
        >
          <Users size={16} /> 사용자 관리
        </button>
      </div>

      {/* 부서 관리 */}
      {tab === 'departments' && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-[16px] font-semibold">부서 목록</h2>
            <button
              onClick={() => openDeptModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors"
            >
              <Plus size={16} /> 부서 추가
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-page-bg">
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">부서명</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">코드</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">설명</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">인원</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">상태</th>
                <th className="text-right px-6 py-3 text-[12px] font-semibold text-muted uppercase">관리</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-b-0 hover:bg-page-bg/50">
                  <td className="px-6 py-4 text-sm font-medium">{d.name}</td>
                  <td className="px-6 py-4 text-sm text-muted font-num">{d.code}</td>
                  <td className="px-6 py-4 text-sm text-muted">{d.description || '-'}</td>
                  <td className="px-6 py-4 text-sm font-num">{d.memberCount}명</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.is_active !== false ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      {d.is_active !== false ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openDeptModal(d)} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]"><Pencil size={14} /></button>
                    <button onClick={() => deleteDept(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#6e6e73] hover:text-red-500 ml-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 사용자 관리 */}
      {tab === 'users' && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-[16px] font-semibold">사용자 목록</h2>
            <button
              onClick={() => openUserModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors"
            >
              <Plus size={16} /> 사용자 추가
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-page-bg">
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">이름</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">이메일</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">부서</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">역할</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-muted uppercase">상태</th>
                <th className="text-right px-6 py-3 text-[12px] font-semibold text-muted uppercase">관리</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-b-0 hover:bg-page-bg/50">
                  <td className="px-6 py-4 text-sm font-medium">{u.name}</td>
                  <td className="px-6 py-4 text-sm text-muted">{u.email}</td>
                  <td className="px-6 py-4">
                    <select
                      value={u.department_id ?? ''}
                      onChange={(e) => updateUserDept(u.id, e.target.value || null)}
                      className="text-sm border border-border rounded-lg px-2 py-1 bg-transparent"
                    >
                      <option value="">미배정</option>
                      {departments.filter((d) => d.is_active !== false).map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      onChange={(e) => updateUserRole(u.id, e.target.value)}
                      className="text-sm border border-border rounded-lg px-2 py-1 bg-transparent"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleUserActive(u.id, !u.is_active)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${u.is_active ? 'bg-green-50 text-green-600 hover:bg-red-50 hover:text-red-500' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'}`}
                    >
                      {u.is_active ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openUserModal(u)} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]"><Pencil size={14} /></button>
                    <button onClick={() => deleteUser(u.id, u.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#6e6e73] hover:text-red-500 ml-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 부서 추가/수정 모달 — 로그인 페이지 스타일 */}
      {showDeptModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowDeptModal(false)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 480, backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e5e5e7', padding: '40px 48px' }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, color: '#1d1d1f' }}>
              {editDept ? '부서 수정' : '부서 추가'}
            </h2>
            <p style={{ fontSize: 14, color: '#6e6e73', marginBottom: 32 }}>
              {editDept ? '부서 정보를 수정합니다.' : '새로운 부서를 추가합니다.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>부서명 *</label>
                <input
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="경영기획팀"
                  style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>코드 *</label>
                <input
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                  placeholder="BIZ"
                  style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none', textTransform: 'uppercase' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>설명</label>
                <input
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  placeholder="부서 설명을 입력하세요"
                  style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
              <button
                onClick={() => setShowDeptModal(false)}
                className="hover:bg-[#f5f5f7] transition-colors"
                style={{ padding: '12px 24px', fontSize: 15, fontWeight: 500, borderRadius: 12, border: 'none', backgroundColor: 'transparent', color: '#6e6e73', cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={saveDept}
                disabled={saving || !deptName.trim() || !deptCode.trim()}
                className="hover:bg-[#0071e3] transition-colors"
                style={{ padding: '12px 32px', fontSize: 15, fontWeight: 600, borderRadius: 12, border: 'none', backgroundColor: '#1d1d1f', color: '#fff', cursor: 'pointer', opacity: (saving || !deptName.trim() || !deptCode.trim()) ? 0.4 : 1 }}
              >
                {saving ? '저장 중...' : (editDept ? '수정' : '추가')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사용자 추가 모달 — 로그인 페이지 스타일 */}
      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setShowUserModal(false)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 480, backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e5e5e7', padding: '40px 48px' }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, color: '#1d1d1f' }}>{editUser ? '사용자 수정' : '사용자 추가'}</h2>
            <p style={{ fontSize: 14, color: '#6e6e73', marginBottom: 32 }}>{editUser ? '사용자 정보를 수정합니다.' : '새로운 사용자 계정을 생성합니다.'}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>이름 *</label>
                <input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="홍길동"
                  style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }} />
              </div>
              {!editUser && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>이메일 *</label>
                    <input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="name@company.com" type="email"
                      style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none', fontFamily: 'Verdana, sans-serif' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>비밀번호 *</label>
                    <input value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="6자 이상" type="password"
                      style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }} />
                  </div>
                </>
              )}
              {editUser && (
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>이메일</label>
                  <input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} type="email"
                    style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none', fontFamily: 'Verdana, sans-serif' }} />
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>부서</label>
                  <select value={userDeptId} onChange={(e) => setUserDeptId(e.target.value)}
                    style={{ width: '100%', height: 52, padding: '0 14px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }}>
                    <option value="">미배정</option>
                    {departments.filter((d) => d.is_active !== false).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>역할</label>
                  <select value={userRole} onChange={(e) => setUserRole(e.target.value)}
                    style={{ width: '100%', height: 52, padding: '0 14px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }}>
                    <option value="user">사용자</option>
                    <option value="manager">매니저</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
              <button onClick={() => setShowUserModal(false)} className="hover:bg-[#f5f5f7] transition-colors"
                style={{ padding: '12px 24px', fontSize: 15, fontWeight: 500, borderRadius: 12, border: 'none', backgroundColor: 'transparent', color: '#6e6e73', cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={saveUser} disabled={userSaving || !userName.trim() || !userEmail.trim() || (!editUser && !userPassword.trim())}
                className="hover:bg-[#0071e3] transition-colors"
                style={{ padding: '12px 32px', fontSize: 15, fontWeight: 600, borderRadius: 12, border: 'none', backgroundColor: '#1d1d1f', color: '#fff', cursor: 'pointer', opacity: (userSaving || !userName.trim() || !userEmail.trim() || (!editUser && !userPassword.trim())) ? 0.4 : 1 }}>
                {userSaving ? '저장 중...' : (editUser ? '수정' : '추가')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
