'use client';

import { useEffect, useState } from 'react';
import {
  ExternalShareSection,
  InternalShareSection,
  ReviewRequestSection,
  type InternalShareItem,
  type MessageChannel,
  type ShareDepartment,
  type ShareUser,
} from './share-link-modal-sections';

interface ShareLinkModalProps {
  resourceId: string;
  resourceTitle: string;
  resourceType?: 'document' | 'file';
  onClose: () => void;
}

export function ShareLinkModal({
  resourceId,
  resourceTitle,
  resourceType = 'document',
  onClose,
}: ShareLinkModalProps) {
  const isFileShare = resourceType === 'file';
  const supportsInternalShare = resourceType === 'file' || resourceType === 'document';
  const [shareMode, setShareMode] = useState<'external' | 'internal' | 'review'>('external');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [targetType, setTargetType] = useState<'user' | 'department'>('user');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [users, setUsers] = useState<ShareUser[]>([]);
  const [departments, setDepartments] = useState<ShareDepartment[]>([]);
  const [internalShares, setInternalShares] = useState<InternalShareItem[]>([]);
  const [loadingInternalData, setLoadingInternalData] = useState(false);
  const [submittingInternalShare, setSubmittingInternalShare] = useState(false);
  const [removingShareId, setRemovingShareId] = useState<string | null>(null);
  const [channels, setChannels] = useState<MessageChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [sendingReviewRequest, setSendingReviewRequest] = useState(false);

  useEffect(() => {
    setShareMode('external');
    setResult(null);
    setPassword('');
    setCopied(false);
    setTargetType('user');
    setSelectedUserId('');
    setSelectedDepartmentId('');
    setSelectedChannelId('');
    setReviewMessage(
      resourceType === 'file'
        ? `"${resourceTitle}" 파일 검토를 부탁드립니다. 확인 후 의견을 남겨주세요.`
        : `"${resourceTitle}" 문서 검토를 부탁드립니다. 댓글 패널에 의견을 남겨주세요.`
    );
  }, [resourceId, resourceTitle, resourceType]);

  useEffect(() => {
    let cancelled = false;

    const loadShareSupportData = async () => {
      setLoadingInternalData(true);

      try {
        const channelsRes = await fetch('/api/messages/channels');
        const channelsData = await channelsRes.json();

        let usersData = { success: true, data: [] as ShareUser[] };
        let departmentsData = { success: true, data: [] as ShareDepartment[] };
        let sharesData = { success: true, data: [] as InternalShareItem[] };

        if (supportsInternalShare) {
          const [usersRes, departmentsRes, sharesRes] = await Promise.all([
            fetch('/api/users'),
            fetch('/api/departments'),
            fetch(resourceType === 'file' ? `/api/files/${resourceId}/share` : `/api/documents/${resourceId}/share`),
          ]);

          [usersData, departmentsData, sharesData] = await Promise.all([
            usersRes.json(),
            departmentsRes.json(),
            sharesRes.json(),
          ]);
        }

        if (cancelled) return;

        if (!usersData.success || !departmentsData.success || !sharesData.success || !channelsData.success) {
          throw new Error('내부 공유 정보를 불러오지 못했습니다.');
        }

        setUsers(usersData.data ?? []);
        setDepartments(departmentsData.data ?? []);
        setInternalShares(sharesData.data ?? []);
        setChannels(channelsData.data ?? []);
      } catch {
        if (!cancelled) {
          setUsers([]);
          setDepartments([]);
          setInternalShares([]);
          setChannels([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingInternalData(false);
        }
      }
    };

    void loadShareSupportData();

    return () => {
      cancelled = true;
    };
  }, [resourceId, resourceType, supportsInternalShare]);

  const createLink = async () => {
    if (creating) return;

    setCreating(true);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType,
          resourceId,
          title: resourceTitle,
          expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
          password: password || undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setResult(`${window.location.origin}${data.url}`);
      } else {
        alert(data.error ?? '링크 생성 실패');
      }
    } catch {
      alert('링크 생성 중 오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    if (!result) return;

    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const grantInternalShare = async () => {
    if (!supportsInternalShare || submittingInternalShare) return;

    const payload =
      targetType === 'user'
        ? { userId: selectedUserId }
        : { departmentId: selectedDepartmentId };

    if (!payload.userId && !payload.departmentId) {
      alert(targetType === 'user' ? '공유할 사용자를 선택하세요.' : '공유할 부서를 선택하세요.');
      return;
    }

    setSubmittingInternalShare(true);
    try {
      const res = await fetch(resourceType === 'file' ? `/api/files/${resourceId}/share` : `/api/documents/${resourceId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, permission: 'read' }),
      });
      const data = await res.json();

      if (!data.success) {
        alert(data.error ?? '내부 공유 실패');
        return;
      }

      const refreshRes = await fetch(resourceType === 'file' ? `/api/files/${resourceId}/share` : `/api/documents/${resourceId}/share`);
      const refreshData = await refreshRes.json();
      if (refreshData.success) {
        setInternalShares(refreshData.data ?? []);
      }

      setSelectedUserId('');
      setSelectedDepartmentId('');
    } catch {
      alert('내부 공유 중 오류가 발생했습니다.');
    } finally {
      setSubmittingInternalShare(false);
    }
  };

  const removeInternalShare = async (permissionId: string) => {
    if (!supportsInternalShare || removingShareId) return;

    setRemovingShareId(permissionId);
    try {
      const res = await fetch(
        `${resourceType === 'file' ? `/api/files/${resourceId}/share` : `/api/documents/${resourceId}/share`}?permissionId=${permissionId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();

      if (!data.success) {
        alert(data.error ?? '공유 해제 실패');
        return;
      }

      setInternalShares((prev) => prev.filter((item) => item.id !== permissionId));
    } catch {
      alert('공유 해제 중 오류가 발생했습니다.');
    } finally {
      setRemovingShareId(null);
    }
  };

  const sendReviewRequest = async () => {
    if (sendingReviewRequest) return;
    if (!selectedChannelId) {
      alert('검토 요청을 보낼 채널을 선택하세요.');
      return;
    }

    setSendingReviewRequest(true);
    try {
      const res = isFileShare
        ? await fetch('/api/messages/share-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelId: selectedChannelId,
              fileId: resourceId,
              expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : 7,
              message: reviewMessage,
            }),
          })
        : await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelId: selectedChannelId,
              content: reviewMessage,
              documentId: resourceId,
            }),
          });
      const data = await res.json();

      if (!data.success) {
        alert(data.error ?? '검토 요청 전송 실패');
        return;
      }

      alert('검토 요청을 전송했습니다.');
      onClose();
    } catch {
      alert('검토 요청 전송 중 오류가 발생했습니다.');
    } finally {
      setSendingReviewRequest(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">
              {shareMode === 'internal' ? '내부 공유 관리' : shareMode === 'review' ? '검토 요청 보내기' : '외부 공유 링크 생성'}
            </h2>
            <p className="mt-0.5 max-w-xs truncate text-xs text-foreground-secondary">{resourceTitle}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-foreground-secondary hover:bg-surface-secondary">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 pt-4 sm:px-6">
          <div className="grid grid-cols-1 gap-1.5 rounded-2xl bg-surface-secondary p-1.5 sm:flex sm:items-center">
            <button
              onClick={() => setShareMode('external')}
              className={`flex-1 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                shareMode === 'external' ? 'bg-white text-foreground shadow-sm' : 'text-foreground-secondary'
              }`}
            >
              외부 링크
            </button>
            {supportsInternalShare ? (
              <button
                onClick={() => setShareMode('internal')}
                className={`flex-1 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  shareMode === 'internal' ? 'bg-white text-foreground shadow-sm' : 'text-foreground-secondary'
                }`}
              >
                사용자/부서
              </button>
            ) : null}
            <button
              onClick={() => setShareMode('review')}
              className={`flex-1 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                shareMode === 'review' ? 'bg-white text-foreground shadow-sm' : 'text-foreground-secondary'
              }`}
            >
              검토 요청
            </button>
          </div>
        </div>

        {shareMode === 'internal' && supportsInternalShare ? (
          <InternalShareSection
            targetType={targetType}
            selectedUserId={selectedUserId}
            selectedDepartmentId={selectedDepartmentId}
            users={users}
            departments={departments}
            internalShares={internalShares}
            loadingInternalData={loadingInternalData}
            submittingInternalShare={submittingInternalShare}
            removingShareId={removingShareId}
            onTargetTypeChange={setTargetType}
            onSelectedUserChange={setSelectedUserId}
            onSelectedDepartmentChange={setSelectedDepartmentId}
            onGrantInternalShare={grantInternalShare}
            onRemoveInternalShare={removeInternalShare}
          />
        ) : shareMode === 'review' ? (
          <ReviewRequestSection
            isFileShare={isFileShare}
            loadingInternalData={loadingInternalData}
            channels={channels}
            selectedChannelId={selectedChannelId}
            reviewMessage={reviewMessage}
            expiresInDays={expiresInDays}
            sendingReviewRequest={sendingReviewRequest}
            onSelectedChannelChange={setSelectedChannelId}
            onReviewMessageChange={setReviewMessage}
            onExpiresChange={setExpiresInDays}
            onSendReviewRequest={sendReviewRequest}
          />
        ) : (
          <ExternalShareSection
            result={result}
            copied={copied}
            creating={creating}
            expiresInDays={expiresInDays}
            password={password}
            onChangeExpires={setExpiresInDays}
            onChangePassword={setPassword}
            onCreateLink={createLink}
            onCopyLink={copyLink}
            onResetResult={() => {
              setResult(null);
              setPassword('');
            }}
          />
        )}
      </div>
    </div>
  );
}
