'use client';

import { Spinner } from '@/components/ui';

export interface ShareUser {
  id: string;
  name: string;
  email: string;
  departmentName?: string;
  role?: string;
}

export interface ShareDepartment {
  id: string;
  name: string;
  memberCount?: number;
}

export interface InternalShareItem {
  id: string;
  permission: 'read' | 'edit';
  created_at?: string;
  users?: {
    id: string;
    name: string;
    email: string;
  } | null;
  departments?: {
    id: string;
    name: string;
  } | null;
  granter?: {
    name: string;
  } | null;
}

export interface MessageChannel {
  id: string;
  name: string;
  type: 'department' | 'direct' | 'group';
}

interface ExternalShareSectionProps {
  result: string | null;
  copied: boolean;
  creating: boolean;
  expiresInDays: string;
  password: string;
  onChangeExpires: (value: string) => void;
  onChangePassword: (value: string) => void;
  onCreateLink: () => void;
  onCopyLink: () => void;
  onResetResult: () => void;
}

export function ExternalShareSection({
  result,
  copied,
  creating,
  expiresInDays,
  password,
  onChangeExpires,
  onChangePassword,
  onCreateLink,
  onCopyLink,
  onResetResult,
}: ExternalShareSectionProps) {
  if (!result) {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#6e6e73]">만료 기간</label>
          <select value={expiresInDays} onChange={(e) => onChangeExpires(e.target.value)} className="w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-3 py-2.5 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
            <option value="1">1일</option>
            <option value="7">7일</option>
            <option value="30">30일</option>
            <option value="90">90일</option>
            <option value="">만료 없음</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[#6e6e73]">
            비밀번호 <span className="text-xs text-[#a1a1a6]">(선택)</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => onChangePassword(e.target.value)}
            placeholder="설정하지 않으면 공개 링크"
            className="w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-3 py-2.5 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
          />
        </div>
        <button onClick={onCreateLink} disabled={creating} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0071e3] py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#005bbf] disabled:opacity-40">
          {creating ? (
            <>
              <Spinner size="sm" variant="white" />
              생성 중...
            </>
          ) : '링크 생성'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-6 py-5">
      <div className="flex items-center gap-2 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] p-3">
        <p className="flex-1 truncate font-mono text-xs text-[#1d1d1f]">{result}</p>
        <button
          onClick={onCopyLink}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            copied ? 'bg-[#34c759] text-white' : 'bg-[#0071e3] text-white hover:bg-[#005bbf]'
          }`}
        >
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
      <div className="flex gap-2 text-xs text-[#6e6e73]">
        {expiresInDays ? <span>⏱ {expiresInDays}일 후 만료</span> : null}
        {password ? <span>🔒 비밀번호 설정됨</span> : null}
      </div>
      <button onClick={onResetResult} className="w-full rounded-xl border border-[#e5e5e7] py-2 text-[13px] text-[#6e6e73] transition-colors hover:bg-[#f5f5f7]">
        새 링크 생성
      </button>
    </div>
  );
}

interface InternalShareSectionProps {
  targetType: 'user' | 'department';
  selectedUserId: string;
  selectedDepartmentId: string;
  users: ShareUser[];
  departments: ShareDepartment[];
  internalShares: InternalShareItem[];
  loadingInternalData: boolean;
  submittingInternalShare: boolean;
  removingShareId: string | null;
  onTargetTypeChange: (value: 'user' | 'department') => void;
  onSelectedUserChange: (value: string) => void;
  onSelectedDepartmentChange: (value: string) => void;
  onGrantInternalShare: () => void;
  onRemoveInternalShare: (permissionId: string) => void;
}

export function InternalShareSection({
  targetType,
  selectedUserId,
  selectedDepartmentId,
  users,
  departments,
  internalShares,
  loadingInternalData,
  submittingInternalShare,
  removingShareId,
  onTargetTypeChange,
  onSelectedUserChange,
  onSelectedDepartmentChange,
  onGrantInternalShare,
  onRemoveInternalShare,
}: InternalShareSectionProps) {
  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e5e5e7] bg-[#fafafc] p-4">
        <div className="flex items-center gap-2">
          <button onClick={() => onTargetTypeChange('user')} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${targetType === 'user' ? 'bg-[#1B1F2B] text-white' : 'border border-[#e5e5e7] bg-white text-[#6e6e73]'}`}>
            사용자 공유
          </button>
          <button onClick={() => onTargetTypeChange('department')} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${targetType === 'department' ? 'bg-[#1B1F2B] text-white' : 'border border-[#e5e5e7] bg-white text-[#6e6e73]'}`}>
            부서 공유
          </button>
        </div>

        {targetType === 'user' ? (
          <select value={selectedUserId} onChange={(e) => onSelectedUserChange(e.target.value)} className="w-full rounded-xl border border-[#e5e5e7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
            <option value="">공유할 사용자 선택</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.departmentName ?? '미배정'}
              </option>
            ))}
          </select>
        ) : (
          <select value={selectedDepartmentId} onChange={(e) => onSelectedDepartmentChange(e.target.value)} className="w-full rounded-xl border border-[#e5e5e7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
            <option value="">공유할 부서 선택</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}{typeof department.memberCount === 'number' ? ` · ${department.memberCount}명` : ''}
              </option>
            ))}
          </select>
        )}

        <button onClick={onGrantInternalShare} disabled={submittingInternalShare || loadingInternalData} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B1F2B] py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#11141d] disabled:opacity-40">
          {submittingInternalShare ? (
            <>
              <Spinner size="sm" variant="white" />
              공유 중...
            </>
          ) : '내부 공유 추가'}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1B1F2B]">현재 내부 공유</h3>
          <span className="text-xs text-[#6e6e73]">{internalShares.length}건</span>
        </div>

        {loadingInternalData ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#6e6e73]">
            <Spinner size="sm" />
            공유 대상 불러오는 중...
          </div>
        ) : internalShares.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d7d7dc] bg-[#fafafc] p-4 text-sm text-[#6e6e73]">아직 내부 공유 대상이 없습니다.</div>
        ) : (
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
            {internalShares.map((share) => {
              const label = share.users ? `${share.users.name} · ${share.users.email}` : `${share.departments?.name ?? '알 수 없는 부서'} 부서`;
              const meta = share.users ? '사용자' : '부서';
              return (
                <div key={share.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#e5e5e7] bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#1d1d1f]">{label}</p>
                    <p className="mt-1 text-xs text-[#6e6e73]">
                      {meta} · 읽기 권한
                      {share.granter?.name ? ` · ${share.granter.name} 부여` : ''}
                    </p>
                  </div>
                  <button onClick={() => onRemoveInternalShare(share.id)} disabled={removingShareId === share.id} className="shrink-0 rounded-lg border border-[#e5e5e7] px-3 py-1.5 text-xs text-[#6e6e73] hover:bg-[#f5f5f7] disabled:opacity-40">
                    {removingShareId === share.id ? '해제 중...' : '해제'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface ReviewRequestSectionProps {
  isFileShare: boolean;
  loadingInternalData: boolean;
  channels: MessageChannel[];
  selectedChannelId: string;
  reviewMessage: string;
  expiresInDays: string;
  sendingReviewRequest: boolean;
  onSelectedChannelChange: (value: string) => void;
  onReviewMessageChange: (value: string) => void;
  onExpiresChange: (value: string) => void;
  onSendReviewRequest: () => void;
}

export function ReviewRequestSection({
  isFileShare,
  loadingInternalData,
  channels,
  selectedChannelId,
  reviewMessage,
  expiresInDays,
  sendingReviewRequest,
  onSelectedChannelChange,
  onReviewMessageChange,
  onExpiresChange,
  onSendReviewRequest,
}: ReviewRequestSectionProps) {
  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <div className="rounded-2xl border border-[#E9E4FF] bg-[#FAF7FF] p-4">
        <p className="text-sm font-semibold text-[#1B1F2B]">공유 후 바로 검토 요청</p>
        <p className="mt-1 text-xs leading-5 text-[#6e6e73]">
          {isFileShare ? '메시지 채널에 파일을 공유하고 검토 요청 문구를 함께 보냅니다.' : '메시지 채널에 문서 링크와 검토 요청 문구를 함께 보냅니다.'}
        </p>
      </div>

      {loadingInternalData ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#6e6e73]">
          <Spinner size="sm" />
          채널 목록 불러오는 중...
        </div>
      ) : (
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-[#6e6e73]">대화 채널</label>
            <select value={selectedChannelId} onChange={(e) => onSelectedChannelChange(e.target.value)} className="w-full rounded-xl border border-[#e5e5e7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
              <option value="">검토 요청을 보낼 채널 선택</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name} · {channel.type === 'department' ? '부서 채널' : channel.type === 'group' ? '그룹' : 'DM'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#6e6e73]">요청 메시지</label>
            <textarea
              value={reviewMessage}
              onChange={(e) => onReviewMessageChange(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-[#e5e5e7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
            />
          </div>

          {isFileShare ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-[#6e6e73]">열람 만료 기간</label>
              <select value={expiresInDays} onChange={(e) => onExpiresChange(e.target.value)} className="w-full rounded-xl border border-[#e5e5e7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
                <option value="1">1일</option>
                <option value="7">7일</option>
                <option value="30">30일</option>
                <option value="90">90일</option>
              </select>
            </div>
          ) : null}

          <button onClick={onSendReviewRequest} disabled={sendingReviewRequest || channels.length === 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#6D28D9] disabled:opacity-40">
            {sendingReviewRequest ? (
              <>
                <Spinner size="sm" variant="white" />
                전송 중...
              </>
            ) : isFileShare ? '파일 검토 요청 보내기' : '문서 검토 요청 보내기'}
          </button>

          {channels.length === 0 ? <p className="text-xs text-[#6e6e73]">사용 가능한 메시지 채널이 없습니다. 메시지 화면에서 채널을 먼저 만들어 주세요.</p> : null}
        </>
      )}
    </div>
  );
}
