'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { ConfirmDialog } from '@/components/ui';
import {
  FileShareModal,
  MessagesMain,
  MessagesSidebar,
  MobileSidebarButton,
  SupportToolBanner,
} from '@/components/messages/messages-layout';
import type { Channel, DeptTree, Msg, MyFile, SharedDocumentInfo, SharedFileInfo } from '@/components/messages/types';

export default function MessagesPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, Msg[]>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);

  // 모바일: 부모 스크롤 방지 (footer 안 보이게)
  useEffect(() => {
    const main = document.querySelector('main.flex-1.overflow-y-auto') as HTMLElement;
    if (main) main.style.overflow = 'hidden';
    return () => { if (main) main.style.overflow = ''; };
  }, []);

  const currentUser = useAuthStore((s) => s.user);
  const toast = useToast();

  // 부서 트리
  const [deptTree, setDeptTree] = useState<DeptTree[]>([]);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [unassigned, setUnassigned] = useState<{ id: string; name: string; email: string }[]>([]);

  // 파일 공유 모달
  const [showFileModal, setShowFileModal] = useState(false);
  const [myFiles, setMyFiles] = useState<MyFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [sharing, setSharing] = useState(false);

  // 첨부파일 업로드 상태
  const [uploading, setUploading] = useState(false);

  // 채널 삭제 확인
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; channelId: string | null }>({ open: false, channelId: null });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // 채널 + 부서/사용자 트리 로드
  const loadData = useCallback(async () => {
    try {
      const [chRes, deptRes, userRes] = await Promise.all([
        fetch('/api/messages/channels'),
        fetch('/api/departments'),
        fetch('/api/users'),
      ]);

      if (chRes.ok) {
        const json = await chRes.json();
        setChannels((json.data ?? []).map((c: { id: string; name: string; type: string }) => ({
          id: c.id, name: c.name,
          type: c.type === 'direct' ? 'dm' as const : c.type === 'group' ? 'group' as const : 'department' as const,
          unread: 0, lastMessage: '', avatar: c.name?.charAt(0),
        })));
      }

      if (deptRes.ok && userRes.ok) {
        const depts = (await deptRes.json()).data ?? [];
        const users = (await userRes.json()).data ?? [];

        const tree: DeptTree[] = depts
          .filter((d: { is_active: boolean }) => d.is_active !== false)
          .map((d: { id: string; name: string }) => {
            const deptUsers = users
              .filter((u: { department_id: string | null }) => u.department_id === d.id)
              .map((u: { id: string; name: string; email: string }) => ({ id: u.id, name: u.name, email: u.email }));
            // 본인을 맨 위로
            deptUsers.sort((a: { id: string }, b: { id: string }) => a.id === currentUser?.id ? -1 : b.id === currentUser?.id ? 1 : 0);
            return { id: d.id, name: d.name, members: deptUsers };
          });
        setDeptTree(tree);
        setUnassigned(users.filter((u: { department_id: string | null }) => !u.department_id)
          .map((u: { id: string; name: string; email: string }) => ({ id: u.id, name: u.name, email: u.email })));
        // 모든 부서 기본 펼침
        setExpandedDepts(new Set(tree.map((d: DeptTree) => d.id)));
      }
    } catch (e) { console.warn("[ui]", e); }
    finally { setLoading(false); }
  }, [currentUser?.id]);

  useEffect(() => { if (currentUser) loadData(); }, [currentUser, loadData]);

  // 페이지 전환/탭 활성화 시 트리 갱신 (설정에서 부서 변경 후 돌아올 때)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && currentUser) loadData(); };
    const onFocus = () => { if (currentUser) loadData(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentUser, loadData]);

  const messages = activeChannel ? (messagesMap[activeChannel] ?? []) : [];
  const msgCountRef = useRef(0);
  useEffect(() => {
    // 메시지 수가 실제로 증가했을 때만 스크롤
    if (messages.length > msgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    msgCountRef.current = messages.length;
  }, [messages.length]);

  const toggleDept = (id: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 사용자 클릭 → DM 생성/열기 (중복 호출 방지)
  const dmCreatingRef = useRef(false);
  const openDmWith = async (targetUserId: string) => {
    if (dmCreatingRef.current) return;
    dmCreatingRef.current = true;
    try {
      const res = await fetch('/api/messages/channels', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'direct', targetUserId }),
      });
      if (res.ok) {
        const json = await res.json();
        await loadData();
        if (json.data?.id) openChannel(json.data.id);
      }
    } catch (e) { console.warn("[ui]", e); } finally {
      dmCreatingRef.current = false;
    }
  };

  const fetchMessages = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(`/api/messages/channels/${channelId}`);
      if (res.ok) {
        const json = await res.json();
        const apiMsgs = (json.data ?? []).map((m: { id: string; userId: string; userName: string; content: string; createdAt: string; sharedFile?: SharedFileInfo | null; document?: SharedDocumentInfo | null; attachmentName?: string | null; attachmentSize?: string | null }) => ({
          id: m.id, sender: m.userName, avatar: m.userName?.charAt(0) ?? '?', content: m.content,
          time: new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          isOwn: m.userId === currentUser?.id,
          sharedFile: m.sharedFile ?? null,
          document: m.document ?? null,
          attachment: m.attachmentName ? { name: m.attachmentName, size: m.attachmentSize ?? '' } : undefined,
        }));
        setMessagesMap(prev => {
          const old = prev[channelId] ?? [];
          // 폴링 레이스 컨디션 방지: 구버전 데이터(메시지 수 감소)로 덮어쓰지 않음
          if (apiMsgs.length < old.length) return prev;
          // 같은 수 + 같은 마지막 메시지면 변경 없음
          if (apiMsgs.length === old.length) {
            if (old.length === 0 || old[old.length - 1]?.id === apiMsgs[apiMsgs.length - 1]?.id) return prev;
          }
          // 새 메시지가 있으면 브라우저 알림
          if (old.length > 0 && apiMsgs.length > old.length) {
            const newest = apiMsgs[apiMsgs.length - 1];
            if (newest && !newest.isOwn && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('CLIO 새 메시지', { body: `${newest.sender}: ${newest.content}`, icon: '/favicon.ico' });
            }
          }
          return { ...prev, [channelId]: apiMsgs };
        });
      }
    } catch (e) { console.warn("[ui]", e); }
  }, [currentUser?.id]);

  const openChannel = async (channelId: string) => {
    setActiveChannel(channelId);
    setShowSidebar(false);
    setChannels(prev => prev.map(c => (c.id === channelId ? { ...c, unread: 0 } : c)));
    await fetchMessages(channelId);
  };

  // 브라우저 알림 권한 요청
  useEffect(() => {
    if (!currentUser) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [currentUser]);

  // 활성 채널 변경 시 Supabase Realtime 구독
  useEffect(() => {
    if (!activeChannel) return;

    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`messages:${activeChannel}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${activeChannel}` },
        () => {
          // 새 메시지 삽입 감지 → 채널 메시지 새로고침
          fetchMessages(activeChannel);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel, fetchMessages]);

  const sendMessage = async () => {
    if (!input.trim() || !activeChannel) return;
    const content = input.trim();
    setInput('');
    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const tempMsg: Msg = {
      id: `m_${Date.now()}`, sender: currentUser?.name ?? '나', avatar: (currentUser?.name ?? '나').charAt(0),
      content, time: timeStr, isOwn: true,
    };
    setMessagesMap(prev => ({ ...prev, [activeChannel]: [...(prev[activeChannel] ?? []), tempMsg] }));
    setChannels(prev => prev.map(c => (c.id === activeChannel ? { ...c, lastMessage: content } : c)));
    try {
      const res = await fetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: activeChannel, content }) });
      if (!res.ok) toast.error('메시지 전송에 실패했습니다.');
    } catch { toast.error('메시지 전송 중 오류가 발생했습니다.'); }
  };

  // 내 파일 목록 로드
  const loadMyFiles = async () => {
    setFilesLoading(true);
    try {
      const res = await fetch('/api/files?limit=50');
      if (res.ok) {
        const json = await res.json();
        setMyFiles((json.files ?? []).map((f: { id: string; name: string; type: string; size: string }) => ({
          id: f.id, name: f.name, type: f.type, size: f.size,
        })));
      }
    } catch (e) { console.warn("[ui]", e); } finally { setFilesLoading(false); }
  };

  // 파일 공유 모달 열기
  const openFileModal = () => {
    setSelectedFileId(null);
    setExpiresInDays(7);
    setShowFileModal(true);
    loadMyFiles();
  };

  // 파일 공유 전송
  const shareFile = async () => {
    if (!selectedFileId || !activeChannel || sharing) return;
    setSharing(true);
    try {
      const res = await fetch('/api/messages/share-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: activeChannel, fileId: selectedFileId, expiresInDays }),
      });
      if (res.ok) {
        setShowFileModal(false);
        await fetchMessages(activeChannel);
      } else {
        toast.error('파일 공유에 실패했습니다.');
      }
    } catch {
      toast.error('파일 공유 중 오류가 발생했습니다.');
    } finally { setSharing(false); }
  };

  // 첨부파일 다운로드
  const downloadFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}/download`);
      if (res.ok) {
        const json = await res.json();
        if (json.url) window.open(json.url, '_blank');
      } else {
        const json = await res.json().catch(() => ({ error: '다운로드 실패' }));
        toast.error(json.error ?? '다운로드에 실패했습니다.');
      }
    } catch { toast.error('다운로드 중 오류가 발생했습니다.'); }
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannel) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (file.size > 50 * 1024 * 1024) {
      toast.error('파일 크기는 50MB 이하여야 합니다.');
      return;
    }

    setUploading(true);

    // Optimistic UI: 업로드 중 임시 메시지
    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const tempId = `upload_${Date.now()}`;
    const tempMsg: Msg = {
      id: tempId, sender: currentUser?.name ?? '나', avatar: (currentUser?.name ?? '나').charAt(0),
      content: `📎 ${file.name}`, time: timeStr, isOwn: true,
      attachment: { name: file.name, size: '업로드 중...' },
    };
    setMessagesMap(prev => ({ ...prev, [activeChannel]: [...(prev[activeChannel] ?? []), tempMsg] }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('channelId', activeChannel);

      const res = await fetch('/api/messages/upload-attachment', { method: 'POST', body: formData });
      if (res.ok) {
        // 업로드 성공 → 서버 메시지로 교체
        await fetchMessages(activeChannel);
      } else {
        const text = await res.text().catch(() => '');
        let errMsg = `업로드 실패 (${res.status})`;
        try { const json = JSON.parse(text); errMsg = json.error || errMsg; } catch { errMsg = text.slice(0, 200) || errMsg; }
        // 실패 시 임시 메시지 제거
        setMessagesMap(prev => ({
          ...prev,
          [activeChannel]: (prev[activeChannel] ?? []).filter(m => m.id !== tempId),
        }));
        toast.error(errMsg);
      }
    } catch {
      setMessagesMap(prev => ({
        ...prev,
        [activeChannel]: (prev[activeChannel] ?? []).filter(m => m.id !== tempId),
      }));
      toast.error('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };


  const activeChannelData = channels.find(c => c.id === activeChannel);
  const dmChannels = channels.filter(c => c.type === 'dm' || c.type === 'group');
  const conversationLabel = activeChannelData?.name ?? '현재 대화';

  if (loading) {
    return <div className="flex h-[calc(100dvh-136px)] gap-3 animate-pulse lg:h-[calc(100vh-120px)] lg:gap-4"><div className="hidden w-80 rounded-2xl border border-[#e5e5e7] bg-white lg:block" /><div className="flex-1 rounded-2xl border border-[#e5e5e7] bg-white" /></div>;
  }

  return (
    <div className="relative flex h-[calc(100dvh-136px)] gap-3 lg:h-[calc(100vh-120px)] lg:gap-4">
      <SupportToolBanner />

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachFile} />

      <FileShareModal
        open={showFileModal}
        filesLoading={filesLoading}
        myFiles={myFiles}
        selectedFileId={selectedFileId}
        expiresInDays={expiresInDays}
        sharing={sharing}
        onClose={() => setShowFileModal(false)}
        onSelectFile={setSelectedFileId}
        onChangeExpires={setExpiresInDays}
        onShare={() => { void shareFile(); }}
      />

      <MessagesSidebar
        showSidebar={showSidebar}
        currentUser={currentUser}
        deptTree={deptTree}
        expandedDepts={expandedDepts}
        unassigned={unassigned}
        dmChannels={dmChannels}
        activeChannel={activeChannel}
        onCloseSidebar={() => setShowSidebar(false)}
        onToggleDept={toggleDept}
        onOpenDm={(userId) => { void openDmWith(userId); }}
        onOpenChannel={(channelId) => { void openChannel(channelId); }}
        onDeleteChannel={(channelId) => setConfirmDelete({ open: true, channelId })}
      />

      <MessagesMain
        activeChannel={activeChannel}
        activeChannelData={activeChannelData}
        messages={messages}
        uploading={uploading}
        input={input}
        messagesEndRef={messagesEndRef}
        onOpenDocumentContext={() => {
          const params = new URLSearchParams({
            create: 'true',
            instructions: `${conversationLabel} 대화 내용을 바탕으로 공유용 회의/업무 정리 문서를 작성하세요.`,
          });
          router.push(`/documents?${params.toString()}`);
        }}
        onSearchDocuments={() => {
          const params = new URLSearchParams({ q: conversationLabel });
          router.push(`/search?${params.toString()}`);
        }}
        onOpenFileHub={() => router.push('/files')}
        onOpenSidebar={() => setShowSidebar(true)}
        onOpenAttach={() => fileInputRef.current?.click()}
        onOpenShareModal={openFileModal}
        onInputChange={setInput}
        onSendMessage={() => { void sendMessage(); }}
        onDownloadSharedFile={(fileId) => { void downloadFile(fileId); }}
      />

      <MobileSidebarButton visible={!showSidebar} onOpen={() => setShowSidebar(true)} />

      {/* 대화 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={confirmDelete.open}
        title="이 대화를 삭제하시겠습니까?"
        description="삭제된 대화는 복구할 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        onConfirm={async () => {
          if (!confirmDelete.channelId) return;
          try {
            const res = await fetch('/api/messages/channels?id=' + confirmDelete.channelId, { method: 'DELETE' });
            if (res.ok) {
              if (activeChannel === confirmDelete.channelId) setActiveChannel(null);
              await loadData();
            }
          } catch (e) { console.warn('[ui]', e); }
          setConfirmDelete({ open: false, channelId: null });
        }}
        onCancel={() => setConfirmDelete({ open: false, channelId: null })}
      />
    </div>
  );
}
