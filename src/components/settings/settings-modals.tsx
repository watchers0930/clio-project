import type { Department, UserItem } from '@/components/settings/types';

const inputCls = 'h-[52px] w-full rounded-xl border border-border bg-surface-secondary px-4.5 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary';
const labelCls = 'mb-2.5 block text-[14px] font-medium text-foreground-secondary';
const selectCls = 'h-[52px] w-full rounded-xl border border-border bg-surface-secondary px-3.5 text-[15px] text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary';

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
    open, editDept, deptName, deptCode, deptDesc, saving,
    onClose, onSave, onChangeDeptName, onChangeDeptCode, onChangeDeptDesc,
  } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[520px] rounded-xl border border-border bg-white p-10 shadow-xl">
        <h2 className="text-[22px] font-semibold text-foreground">
          {editDept ? '부서 수정' : '부서 추가'}
        </h2>
        <p className="mt-2 mb-4 text-[14px] text-foreground-secondary">
          {editDept ? '부서 정보를 수정합니다.' : '새로운 부서를 추가합니다.'}
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>부서명 *</label>
            <input value={deptName} onChange={(e) => onChangeDeptName(e.target.value)} placeholder="경영기획팀" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>코드 *</label>
            <input value={deptCode} onChange={(e) => onChangeDeptCode(e.target.value)} placeholder="BIZ" className={`${inputCls} uppercase`} />
          </div>
          <div>
            <label className={labelCls}>설명</label>
            <input value={deptDesc} onChange={(e) => onChangeDeptDesc(e.target.value)} placeholder="부서 설명을 입력하세요" className={inputCls} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="h-[48px] rounded-xl px-6 text-[15px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary">
            취소
          </button>
          <button onClick={onSave} disabled={saving || !deptName.trim() || !deptCode.trim()} className="h-[48px] rounded-xl bg-foreground px-8 text-[15px] font-semibold text-white shadow-md transition-all hover:bg-primary disabled:opacity-40">
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
    open, editUser, userName, userEmail, userPassword, userDeptId, userRole, userSaving, departments,
    onClose, onSave, onChangeUserName, onChangeUserEmail, onChangeUserPassword, onChangeUserDeptId, onChangeUserRole,
  } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[520px] rounded-xl border border-border bg-white p-10 shadow-xl">
        <h2 className="text-[22px] font-semibold text-foreground">
          {editUser ? '사용자 수정' : '사용자 추가'}
        </h2>
        <p className="mt-2 mb-4 text-[14px] text-foreground-secondary">
          {editUser ? '사용자 정보를 수정합니다.' : '새로운 사용자 계정을 생성합니다.'}
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>이름 *</label>
            <input value={userName} onChange={(e) => onChangeUserName(e.target.value)} placeholder="홍길동" className={inputCls} />
          </div>
          {!editUser ? (
            <>
              <div>
                <label className={labelCls}>이메일 *</label>
                <input value={userEmail} onChange={(e) => onChangeUserEmail(e.target.value)} placeholder="name@company.com" type="email" className={`${inputCls} font-en`} />
              </div>
              <div>
                <label className={labelCls}>비밀번호 *</label>
                <input value={userPassword} onChange={(e) => onChangeUserPassword(e.target.value)} placeholder="6자 이상" type="password" className={inputCls} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>이메일</label>
                <input value={userEmail} onChange={(e) => onChangeUserEmail(e.target.value)} type="email" className={`${inputCls} font-en`} />
              </div>
              <div>
                <label className={labelCls}>비밀번호 초기화 <span className="text-[12px] text-foreground-quaternary">(변경 시에만 입력)</span></label>
                <input value={userPassword} onChange={(e) => onChangeUserPassword(e.target.value)} placeholder="새 비밀번호 (6자 이상)" type="password" className={inputCls} />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>부서</label>
              <select value={userDeptId} onChange={(e) => onChangeUserDeptId(e.target.value)} className={selectCls}>
                <option value="">미배정</option>
                {departments.filter((d) => d.is_active !== false).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>역할</label>
              <select value={userRole} onChange={(e) => onChangeUserRole(e.target.value)} className={selectCls}>
                <option value="user">사용자</option>
                <option value="manager">매니저</option>
                <option value="admin">관리자</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="h-[48px] rounded-xl px-6 text-[15px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary">
            취소
          </button>
          <button onClick={onSave} disabled={userSaving || !userName.trim() || !userEmail.trim() || (!editUser && !userPassword.trim())} className="h-[48px] rounded-xl bg-foreground px-8 text-[15px] font-semibold text-white shadow-md transition-all hover:bg-primary disabled:opacity-40">
            {userSaving ? '저장 중...' : (editUser ? '수정' : '추가')}
          </button>
        </div>
      </div>
    </div>
  );
}
