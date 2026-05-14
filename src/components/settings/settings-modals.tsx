import type { Department, UserItem } from '@/components/settings/types';

interface DepartmentModalProps {
  open: boolean;
  editDept: Department | null;
  deptName: string;
  deptCode: string;
  deptDesc: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChangeDeptName: (value: string) => void;
  onChangeDeptCode: (value: string) => void;
  onChangeDeptDesc: (value: string) => void;
}

export function DepartmentModal(props: DepartmentModalProps) {
  const {
    open,
    editDept,
    deptName,
    deptCode,
    deptDesc,
    saving,
    onClose,
    onSave,
    onChangeDeptName,
    onChangeDeptCode,
    onChangeDeptDesc,
  } = props;

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 24, border: '1px solid #e5e5e7', padding: '52px 52px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10, color: '#1d1d1f' }}>
          {editDept ? '부서 수정' : '부서 추가'}
        </h2>
        <p style={{ fontSize: 14, color: '#6e6e73', marginBottom: 10 }}>
          {editDept ? '부서 정보를 수정합니다.' : '새로운 부서를 추가합니다.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>부서명 *</label>
            <input value={deptName} onChange={(event) => onChangeDeptName(event.target.value)} placeholder="경영기획팀" style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>코드 *</label>
            <input value={deptCode} onChange={(event) => onChangeDeptCode(event.target.value)} placeholder="BIZ" style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none', textTransform: 'uppercase' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>설명</label>
            <input value={deptDesc} onChange={(event) => onChangeDeptDesc(event.target.value)} placeholder="부서 설명을 입력하세요" style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, marginTop: 18 }}>
          <button onClick={onClose} className="hover:bg-[#f5f5f7] transition-colors" style={{ height: 52, padding: '0 24px', fontSize: 15, fontWeight: 500, borderRadius: 12, border: 'none', backgroundColor: 'transparent', color: '#6e6e73', cursor: 'pointer' }}>취소</button>
          <button onClick={onSave} disabled={saving || !deptName.trim() || !deptCode.trim()} className="hover:bg-[#0071e3] transition-colors" style={{ height: 52, padding: '0 32px', fontSize: 15, fontWeight: 600, borderRadius: 12, border: 'none', backgroundColor: '#1d1d1f', color: '#fff', cursor: 'pointer', opacity: (saving || !deptName.trim() || !deptCode.trim()) ? 0.4 : 1 }}>
            {saving ? '저장 중...' : (editDept ? '수정' : '추가')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface UserModalProps {
  open: boolean;
  editUser: UserItem | null;
  userName: string;
  userEmail: string;
  userPassword: string;
  userDeptId: string;
  userRole: string;
  userSaving: boolean;
  departments: Department[];
  onClose: () => void;
  onSave: () => void;
  onChangeUserName: (value: string) => void;
  onChangeUserEmail: (value: string) => void;
  onChangeUserPassword: (value: string) => void;
  onChangeUserDeptId: (value: string) => void;
  onChangeUserRole: (value: string) => void;
}

export function UserModal(props: UserModalProps) {
  const {
    open,
    editUser,
    userName,
    userEmail,
    userPassword,
    userDeptId,
    userRole,
    userSaving,
    departments,
    onClose,
    onSave,
    onChangeUserName,
    onChangeUserEmail,
    onChangeUserPassword,
    onChangeUserDeptId,
    onChangeUserRole,
  } = props;

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 24, border: '1px solid #e5e5e7', padding: '52px 52px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10, color: '#1d1d1f' }}>{editUser ? '사용자 수정' : '사용자 추가'}</h2>
        <p style={{ fontSize: 14, color: '#6e6e73', marginBottom: 10 }}>{editUser ? '사용자 정보를 수정합니다.' : '새로운 사용자 계정을 생성합니다.'}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>이름 *</label>
            <input value={userName} onChange={(event) => onChangeUserName(event.target.value)} placeholder="홍길동" style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }} />
          </div>
          {!editUser ? (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>이메일 *</label>
                <input value={userEmail} onChange={(event) => onChangeUserEmail(event.target.value)} placeholder="name@company.com" type="email" style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none', fontFamily: 'Verdana, sans-serif' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>비밀번호 *</label>
                <input value={userPassword} onChange={(event) => onChangeUserPassword(event.target.value)} placeholder="6자 이상" type="password" style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>이메일</label>
                <input value={userEmail} onChange={(event) => onChangeUserEmail(event.target.value)} type="email" style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none', fontFamily: 'Verdana, sans-serif' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>비밀번호 초기화 <span style={{ fontSize: 12, color: '#a1a1a6' }}>(변경 시에만 입력)</span></label>
                <input value={userPassword} onChange={(event) => onChangeUserPassword(event.target.value)} placeholder="새 비밀번호 (6자 이상)" type="password" style={{ width: '100%', height: 52, padding: '0 18px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }} />
              </div>
            </>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>부서</label>
              <select value={userDeptId} onChange={(event) => onChangeUserDeptId(event.target.value)} style={{ width: '100%', height: 52, padding: '0 14px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }}>
                <option value="">미배정</option>
                {departments.filter((department) => department.is_active !== false).map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 10, color: '#6e6e73' }}>역할</label>
              <select value={userRole} onChange={(event) => onChangeUserRole(event.target.value)} style={{ width: '100%', height: 52, padding: '0 14px', fontSize: 15, borderRadius: 12, backgroundColor: '#f5f5f7', border: '1px solid #e5e5e7', color: '#1d1d1f', outline: 'none' }}>
                <option value="user">사용자</option>
                <option value="manager">매니저</option>
                <option value="admin">관리자</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, marginTop: 18 }}>
          <button onClick={onClose} className="hover:bg-[#f5f5f7] transition-colors" style={{ height: 52, padding: '0 24px', fontSize: 15, fontWeight: 500, borderRadius: 12, border: 'none', backgroundColor: 'transparent', color: '#6e6e73', cursor: 'pointer' }}>취소</button>
          <button onClick={onSave} disabled={userSaving || !userName.trim() || !userEmail.trim() || (!editUser && !userPassword.trim())} className="hover:bg-[#0071e3] transition-colors" style={{ height: 52, padding: '0 32px', fontSize: 15, fontWeight: 600, borderRadius: 12, border: 'none', backgroundColor: '#1d1d1f', color: '#fff', cursor: 'pointer', opacity: (userSaving || !userName.trim() || !userEmail.trim() || (!editUser && !userPassword.trim())) ? 0.4 : 1 }}>
            {userSaving ? '저장 중...' : (editUser ? '수정' : '추가')}
          </button>
        </div>
      </div>
    </div>
  );
}
