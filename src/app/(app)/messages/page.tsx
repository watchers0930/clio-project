'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, MessageCircle, Send, Paperclip, ChevronRight, ChevronDown, Building2, User, Trash2, FileText, X, Clock, Eye, FolderOpen, Download, Loader2 } from 'lucide-react';

/* ── types ── */
interface Channel { id: string; name: string; type: 'department' | 'dm' | 'group'; unread: number; lastMessage?: string; avatar?: string }
interface SharedFileInfo { id: string; name: string; type: string | null; size: number }
interface Msg { id: string; sender: string; avatar: string; content: string; time: string; isOwn: boolean; attachment?: { name: string; size: string }; sharedFile?: SharedFileInfo | null }
interface DeptTree { id: string; name: string; members: { id: string; name: string; email: string }[] }
interface MyFile { id: string; name: string; type: string; size: string }

export default function MessagesPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, Msg[]>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string } | null>(null);

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

  // 파일 상세 보기 모달
  const [viewingFile, setViewingFile] = useState<{ id: string; name: string; content?: string } | null>(null);
  const [fileViewLoading, setFileViewLoading] = useState(false);

  // 첨부파일 업로드 상태
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { const s = localStorage.getItem('clio_user'); if (s) setCurrentUser(JSON.parse(s)); } catch {}
  }, []);

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
    } catch {}
    finally { setLoading(false); }
  }, [currentUser?.id]);

  useEffect(() => { if (currentUser) loadData(); }, [currentUser, loadData]);

  // 페이지 전환/탭 활성화 시 트리 갱신 (설정에서 부서 변경 후 돌아올 때)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && currentUser) loadData(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', () => { if (currentUser) loadData(); });
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
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
    setExpandedDepts(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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
    } catch {} finally {
      dmCreatingRef.current = false;
    }
  };

  const fetchMessages = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(`/api/messages/channels/${channelId}`);
      if (res.ok) {
        const json = await res.json();
        const apiMsgs = (json.data ?? []).map((m: { id: string; userId: string; userName: string; content: string; createdAt: string; sharedFile?: SharedFileInfo | null; attachmentName?: string | null; attachmentSize?: string | null }) => ({
          id: m.id, sender: m.userName, avatar: m.userName?.charAt(0) ?? '?', content: m.content,
          time: new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          isOwn: m.userId === currentUser?.id,
          sharedFile: m.sharedFile ?? null,
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
    } catch {}
  }, [currentUser?.id]);

  const openChannel = async (channelId: string) => {
    setActiveChannel(channelId);
    setShowSidebar(false);
    setChannels(prev => prev.map(c => (c.id === channelId ? { ...c, unread: 0 } : c)));
    await fetchMessages(channelId);
  };

  // 5초마다 활성 채널 메시지 새로고침 + unread 체크
  useEffect(() => {
    if (!currentUser) return;
    // 브라우저 알림 권한 요청
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const iv = setInterval(async () => {
      // 활성 채널 메시지 갱신
      if (activeChannel) await fetchMessages(activeChannel);

      // unread 체크
      try {
        const res = await fetch('/api/messages/unread');
        if (res.ok) {
          const json = await res.json();
          const unreadMap = (json.channels ?? {}) as Record<string, number>;
          setChannels(prev => prev.map(c => ({
            ...c, unread: c.id === activeChannel ? 0 : (unreadMap[c.id] ?? 0),
          })));

          // 새 unread가 있고 현재 채널이 아니면 알림
          if (json.total > 0 && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            // 채널별로 알림 (너무 자주 안 울리도록 총합만)
          }
        }
      } catch {}
    }, 5000);

    return () => clearInterval(iv);
  }, [currentUser, activeChannel, fetchMessages]);

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
    try { await fetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: activeChannel, content }) }); } catch {}
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
    } catch {} finally { setFilesLoading(false); }
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
      }
    } catch {} finally { setSharing(false); }
  };

  // 공유 파일 열람
  const viewSharedFile = async (fileId: string, fileName: string) => {
    setFileViewLoading(true);
    setViewingFile({ id: fileId, name: fileName });
    try {
      const res = await fetch(`/api/files/${fileId}`);
      if (res.ok) {
        const json = await res.json();
        setViewingFile({
          id: fileId,
          name: fileName,
          content: `파일명: ${json.data.name}\n유형: ${json.data.type ?? '알 수 없음'}\n크기: ${json.data.size}\n업로더: ${json.data.uploader_name ?? json.data.department_name ?? '알 수 없음'}\n접근: ${json.data.accessType === 'shared' ? `공유 (${new Date(json.data.share?.expiresAt).toLocaleDateString('ko-KR')}까지)` : json.data.accessType === 'owner' ? '소유자' : '부서'}`,
        });
      } else {
        const json = await res.json().catch(() => ({ error: '접근 실패' }));
        setViewingFile({ id: fileId, name: fileName, content: `접근 불가: ${json.error}` });
      }
    } catch {
      setViewingFile({ id: fileId, name: fileName, content: '파일 정보를 불러올 수 없습니다.' });
    } finally { setFileViewLoading(false); }
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannel) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (file.size > 50 * 1024 * 1024) {
      alert('파일 크기는 50MB 이하여야 합니다.');
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
        const json = await res.json().catch(() => ({ error: '업로드 실패' }));
        // 실패 시 임시 메시지 제거
        setMessagesMap(prev => ({
          ...prev,
          [activeChannel]: (prev[activeChannel] ?? []).filter(m => m.id !== tempId),
        }));
        alert(json.error ?? '파일 업로드에 실패했습니다.');
      }
    } catch {
      setMessagesMap(prev => ({
        ...prev,
        [activeChannel]: (prev[activeChannel] ?? []).filter(m => m.id !== tempId),
      }));
      alert('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // 첨부파일 다운로드
  const downloadAttachment = async (fileId: string, fileName: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}/download`);
      if (res.ok) {
        const json = await res.json();
        if (json.url) {
          const a = document.createElement('a');
          a.href = json.url;
          a.download = fileName;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        alert('다운로드 링크를 가져올 수 없습니다.');
      }
    } catch {
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const activeChannelData = channels.find(c => c.id === activeChannel);
  const dmChannels = channels.filter(c => c.type === 'dm' || c.type === 'group');

  if (loading) {
    return <div className="flex gap-4 h-[calc(100vh-120px)] animate-pulse"><div className="w-80 bg-white rounded-2xl border border-[#e5e5e7]" /><div className="flex-1 bg-white rounded-2xl border border-[#e5e5e7]" /></div>;
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachFile} />

      {/* ── 파일 공유 모달 ── */}
      {showFileModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowFileModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#e5e5e7] flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1d1d1f]">파일 공유</h3>
              <button onClick={() => setShowFileModal(false)} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              <p className="text-xs text-[#6e6e73] mb-3">내 파일함에서 공유할 파일을 선택하세요. 파일은 이동되지 않고 읽기 권한만 부여됩니다.</p>

              {filesLoading ? (
                <div className="py-8 text-center text-sm text-[#6e6e73]">파일 목록 불러오는 중...</div>
              ) : myFiles.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#6e6e73]">업로드한 파일이 없습니다.</div>
              ) : (
                <div className="space-y-1.5">
                  {myFiles.map(f => (
                    <button key={f.id} onClick={() => setSelectedFileId(f.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${selectedFileId === f.id ? 'bg-[#0071e3]/10 border border-[#0071e3] ring-1 ring-[#0071e3]/30' : 'hover:bg-[#f5f5f7] border border-transparent'}`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${selectedFileId === f.id ? 'bg-[#0071e3]' : 'bg-[#f5f5f7]'}`}>
                        <FileText size={16} className={selectedFileId === f.id ? 'text-white' : 'text-[#6e6e73]'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1d1d1f] truncate">{f.name}</p>
                        <p className="text-xs text-[#6e6e73]">{f.type} · {f.size}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 만료 기간 설정 */}
            <div className="px-5 py-3 border-t border-[#e5e5e7]">
              <div className="flex items-center gap-3 mb-3">
                <Clock size={14} className="text-[#6e6e73] shrink-0" />
                <label className="text-xs text-[#6e6e73]">공유 기간</label>
                <select value={expiresInDays} onChange={e => setExpiresInDays(Number(e.target.value))}
                  className="ml-auto px-3 py-1.5 rounded-lg border border-[#e5e5e7] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
                  <option value={1}>1일</option>
                  <option value={3}>3일</option>
                  <option value={7}>7일</option>
                  <option value={14}>14일</option>
                  <option value={30}>30일</option>
                  <option value={90}>90일</option>
                </select>
              </div>
              <button onClick={shareFile} disabled={!selectedFileId || sharing}
                className="w-full py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {sharing ? '공유 중...' : '파일 공유하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 파일 열람 모달 ── */}
      {viewingFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setViewingFile(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#e5e5e7] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={18} className="text-[#0071e3] shrink-0" />
                <h3 className="text-base font-semibold text-[#1d1d1f] truncate">{viewingFile.name}</h3>
              </div>
              <button onClick={() => setViewingFile(null)} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]"><X size={18} /></button>
            </div>
            <div className="px-5 py-4">
              {fileViewLoading ? (
                <p className="text-sm text-[#6e6e73] text-center py-6">파일 정보를 불러오는 중...</p>
              ) : (
                <pre className="text-sm text-[#1d1d1f] whitespace-pre-wrap bg-[#f5f5f7] rounded-xl px-4 py-3 leading-relaxed">{viewingFile.content}</pre>
              )}
            </div>
            <div className="px-5 py-3 border-t border-[#e5e5e7]">
              <button onClick={() => { if (viewingFile) window.open(`/files?highlight=${viewingFile.id}`, '_blank'); }}
                className="w-full py-2.5 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] text-sm font-medium hover:bg-[#e5e5e7] transition-colors">
                파일함에서 열기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Left Panel: 부서 트리 + DM ── */}
      <div className={`${showSidebar ? 'fixed inset-0 z-40 bg-black/40' : 'hidden'} lg:hidden`} onClick={() => setShowSidebar(false)} />
      <aside className={`${showSidebar ? 'fixed left-0 top-0 bottom-0 z-50' : 'hidden'} lg:relative lg:block w-80 bg-white rounded-2xl border border-[#e5e5e7] shadow-sm flex flex-col shrink-0 overflow-hidden`}>
        {/* 내 프로필 */}
        {currentUser && (
          <div className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-[#e5e5e7]">
            <div className="w-9 h-9 rounded-full bg-[#0071e3] flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-white">{currentUser.name.charAt(0)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1d1d1f] truncate">{currentUser.name}</p>
              <p className="text-xs text-[#6e6e73] truncate">{currentUser.email}</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* 조직도 트리 */}
          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
            <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">조직</p>
          </div>

          {deptTree.map(dept => (
            <div key={dept.id}>
              <button onClick={() => toggleDept(dept.id)}
                className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-[#f5f5f7] transition-colors">
                {expandedDepts.has(dept.id) ? <ChevronDown size={14} className="text-[#6e6e73]" /> : <ChevronRight size={14} className="text-[#6e6e73]" />}
                <Building2 size={14} className="text-[#0071e3]" />
                <span className="text-sm font-medium text-[#1d1d1f]">{dept.name}</span>
                <span className="text-xs text-[#a1a1a6] ml-auto">{dept.members.length}</span>
              </button>
              {expandedDepts.has(dept.id) && dept.members.map(member => {
                const isMe = member.id === currentUser?.id;
                return (
                  <button key={member.id} onClick={() => !isMe && openDmWith(member.id)}
                    className={`w-full pl-10 pr-4 py-2 flex items-center gap-2.5 text-left transition-colors ${isMe ? 'cursor-default' : 'hover:bg-[#f5f5f7]'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isMe ? 'bg-[#0071e3]' : 'bg-[#1d1d1f]'}`}>
                      <span className="text-xs font-medium text-white">{member.name.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-[#1d1d1f] truncate">{member.name}{isMe && <span className="text-[#0071e3] ml-1 text-xs">(나)</span>}</p>
                      <p className="text-[10px] text-[#a1a1a6] truncate">{member.email}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}

          {unassigned.length > 0 && (
            <div>
              <div className="px-4 py-2 flex items-center gap-2">
                <User size={14} className="text-[#a1a1a6]" />
                <span className="text-sm font-medium text-[#6e6e73]">미배정</span>
              </div>
              {unassigned.map(member => (
                <button key={member.id} onClick={() => openDmWith(member.id)}
                  className="w-full pl-10 pr-4 py-2 flex items-center gap-2.5 text-left hover:bg-[#f5f5f7] transition-colors">
                  <div className="w-7 h-7 rounded-full bg-[#6e6e73] flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium text-white">{member.name.charAt(0)}</span>
                  </div>
                  <p className="text-sm text-[#1d1d1f] truncate">{member.name}</p>
                </button>
              ))}
            </div>
          )}

          {/* 이전 대화 목록 */}
          {dmChannels.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-1">
                <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">이전 대화 목록</p>
              </div>
              {dmChannels.map(c => (
                <div key={c.id} className={`group w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#f5f5f7] transition-colors ${activeChannel === c.id ? 'bg-[#f5f5f7] border-l-2 border-[#0071e3]' : ''}`}>
                  <button onClick={() => openChannel(c.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-8 h-8 rounded-full bg-[#1d1d1f] flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-white">{c.avatar}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${c.unread > 0 ? 'font-semibold' : 'font-medium'} text-[#1d1d1f]`}>{c.name}</span>
                        {c.unread > 0 && <span className="ml-2 w-5 h-5 rounded-full bg-[#ff3b30] text-white text-xs flex items-center justify-center shrink-0 font-num">{c.unread}</span>}
                      </div>
                      {c.lastMessage && <p className="text-xs text-[#6e6e73] truncate">{c.lastMessage}</p>}
                    </div>
                  </button>
                  <button onClick={async (e) => { e.stopPropagation(); if (!confirm('이 대화를 삭제하시겠습니까?')) return; try { const admin = await fetch('/api/messages/channels?id=' + c.id, { method: 'DELETE' }); if (admin.ok) { if (activeChannel === c.id) setActiveChannel(null); await loadData(); } } catch {} }}
                    className="p-1 rounded-lg text-transparent group-hover:text-[#a1a1a6] hover:!text-[#ff3b30] hover:bg-red-50 transition-all shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* ── Right Panel ── */}
      <main className="flex-1 bg-white rounded-2xl border border-[#e5e5e7] shadow-sm flex flex-col overflow-hidden">
        {!activeChannel ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <MessageCircle size={32} className="text-[#e5e5e7] mb-4" />
            <h3 className="text-lg font-semibold text-[#1d1d1f] mb-1">대화를 선택하세요</h3>
            <p className="text-sm text-[#6e6e73]">왼쪽 조직도에서 대화할 사람을 클릭하세요.</p>
            <button onClick={() => setShowSidebar(true)} className="mt-4 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium lg:hidden hover:bg-[#0071e3] transition-colors">
              조직도 보기
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-[#e5e5e7] flex items-center gap-3">
              <button onClick={() => setShowSidebar(true)} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] lg:hidden"><Search size={20} /></button>
              <div className="w-8 h-8 rounded-full bg-[#1d1d1f] flex items-center justify-center"><span className="text-xs font-medium text-white">{activeChannelData?.avatar ?? '?'}</span></div>
              <div>
                <h3 className="font-semibold text-[#1d1d1f]">{activeChannelData?.name}</h3>
                <p className="text-xs text-[#6e6e73]">{activeChannelData?.type === 'department' ? '부서 채널' : '다이렉트 메시지'}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 && <p className="text-center text-sm text-[#6e6e73] py-10">아직 메시지가 없습니다. 첫 메시지를 보내보세요!</p>}
              {messages.map(m => (
                <div key={m.id} className={`flex gap-3 ${m.isOwn ? 'flex-row-reverse' : ''}`}>
                  {!m.isOwn && <div className="w-8 h-8 rounded-full bg-[#1d1d1f] flex items-center justify-center shrink-0"><span className="text-xs font-medium text-white">{m.avatar}</span></div>}
                  <div className={`max-w-[70%] ${m.isOwn ? 'items-end' : ''}`}>
                    {!m.isOwn && <p className="text-xs text-[#6e6e73] mb-1">{m.sender}</p>}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.isOwn ? 'bg-[#1d1d1f] text-white rounded-tr-md' : 'bg-[#f5f5f7] text-[#1d1d1f] rounded-tl-md'}`}>
                      {m.sharedFile ? (
                        <>
                          <p className="mb-2">{m.content.replace(/📎\s*/, '')}</p>
                          <div className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${m.isOwn ? 'bg-white/10' : 'bg-white border border-[#e5e5e7]'}`}>
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${m.isOwn ? 'bg-white/20' : 'bg-[#0071e3]/10'}`}>
                              <FileText size={18} className={m.isOwn ? 'text-white' : 'text-[#0071e3]'} />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <p className="text-xs font-semibold truncate">{m.sharedFile.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Paperclip size={10} className={m.isOwn ? 'text-white/60' : 'text-[#6e6e73]'} />
                                <span className={`text-[10px] ${m.isOwn ? 'text-white/60' : 'text-[#6e6e73]'}`}>{m.attachment?.size ?? ''}</span>
                              </div>
                            </div>
                            <button onClick={() => downloadAttachment(m.sharedFile!.id, m.sharedFile!.name)}
                              className={`p-1.5 rounded-lg shrink-0 transition-colors ${m.isOwn ? 'hover:bg-white/20 text-white/80' : 'hover:bg-[#f5f5f7] text-[#6e6e73]'}`}
                              title="다운로드">
                              <Download size={16} />
                            </button>
                            <button onClick={() => viewSharedFile(m.sharedFile!.id, m.sharedFile!.name)}
                              className={`p-1.5 rounded-lg shrink-0 transition-colors ${m.isOwn ? 'hover:bg-white/20 text-white/80' : 'hover:bg-[#f5f5f7] text-[#6e6e73]'}`}
                              title="상세 보기">
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {m.content}
                          {m.attachment && !m.sharedFile && (
                            <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg ${m.isOwn ? 'bg-[#6e6e73]/30' : 'bg-white border border-[#e5e5e7]'}`}>
                              <Paperclip size={14} className="shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">{m.attachment.name}</p>
                                <p className={`text-xs ${m.isOwn ? 'text-white/70' : 'text-[#6e6e73]'}`}>{m.attachment.size}</p>
                              </div>
                              {m.attachment.size !== '업로드 중...' && (
                                <button onClick={(e) => { e.stopPropagation(); downloadAttachment(m.id, m.attachment!.name); }}
                                  className={`p-1 rounded-lg shrink-0 transition-colors ${m.isOwn ? 'hover:bg-white/20 text-white/80' : 'hover:bg-[#f5f5f7] text-[#6e6e73]'}`}
                                  title="다운로드">
                                  <Download size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <p className={`text-xs text-[#6e6e73] mt-1 ${m.isOwn ? 'text-right' : ''}`}>{m.time}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-3 border-t border-[#e5e5e7]">
              <div className="flex items-center gap-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-2 rounded-xl hover:bg-[#f5f5f7] text-[#6e6e73] transition-colors shrink-0 disabled:opacity-40" title="파일 첨부">
                  {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                </button>
                <button onClick={openFileModal} className="p-2 rounded-xl hover:bg-[#f5f5f7] text-[#6e6e73] transition-colors shrink-0" title="파일함에서 공유"><FolderOpen size={20} /></button>
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="메시지를 입력하세요..." className="flex-1 px-4 py-2.5 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-sm placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]" />
                <button onClick={sendMessage} disabled={!input.trim() || uploading} className="p-2.5 rounded-xl bg-[#1d1d1f] text-white hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"><Send size={20} /></button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
