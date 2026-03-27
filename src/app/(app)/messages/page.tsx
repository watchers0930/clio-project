'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, MessageCircle, Send, Paperclip, ChevronRight, ChevronDown, Building2, User } from 'lucide-react';

/* ── types ── */
interface Channel { id: string; name: string; type: 'department' | 'dm' | 'group'; unread: number; lastMessage?: string; avatar?: string }
interface Msg { id: string; sender: string; avatar: string; content: string; time: string; isOwn: boolean; attachment?: { name: string; size: string } }
interface DeptTree { id: string; name: string; members: { id: string; name: string; email: string }[] }

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
          .map((d: { id: string; name: string }) => ({
            id: d.id, name: d.name,
            members: users.filter((u: { department_id: string | null; id: string }) => u.department_id === d.id && u.id !== currentUser?.id)
              .map((u: { id: string; name: string; email: string }) => ({ id: u.id, name: u.name, email: u.email })),
          }));
        setDeptTree(tree);
        setUnassigned(users.filter((u: { department_id: string | null; id: string }) => !u.department_id && u.id !== currentUser?.id)
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
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const toggleDept = (id: string) => {
    setExpandedDepts(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // 사용자 클릭 → DM 생성/열기
  const openDmWith = async (targetUserId: string) => {
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
    } catch {}
  };

  const fetchMessages = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(`/api/messages/channels/${channelId}`);
      if (res.ok) {
        const json = await res.json();
        const apiMsgs = (json.data ?? []).map((m: { id: string; userId: string; userName: string; content: string; createdAt: string }) => ({
          id: m.id, sender: m.userName, avatar: m.userName?.charAt(0) ?? '?', content: m.content,
          time: new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          isOwn: m.userId === currentUser?.id,
        }));
        setMessagesMap(prev => {
          const old = prev[channelId] ?? [];
          // 새 메시지가 있으면 브라우저 알림
          if (old.length > 0 && apiMsgs.length > old.length) {
            const newest = apiMsgs[apiMsgs.length - 1];
            if (newest && !newest.isOwn && Notification.permission === 'granted') {
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

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannel) return;
    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const sizeStr = file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    const newMsg: Msg = {
      id: `m_${Date.now()}`, sender: currentUser?.name ?? '나', avatar: (currentUser?.name ?? '나').charAt(0),
      content: '파일을 공유했습니다.', time: timeStr, isOwn: true, attachment: { name: file.name, size: sizeStr },
    };
    setMessagesMap(prev => ({ ...prev, [activeChannel]: [...(prev[activeChannel] ?? []), newMsg] }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeChannelData = channels.find(c => c.id === activeChannel);
  const dmChannels = channels.filter(c => c.type === 'dm' || c.type === 'group');

  if (loading) {
    return <div className="flex gap-4 h-[calc(100vh-120px)] animate-pulse"><div className="w-80 bg-white rounded-2xl border border-[#e5e5e7]" /><div className="flex-1 bg-white rounded-2xl border border-[#e5e5e7]" /></div>;
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachFile} />

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
              {expandedDepts.has(dept.id) && dept.members.map(member => (
                <button key={member.id} onClick={() => openDmWith(member.id)}
                  className="w-full pl-10 pr-4 py-2 flex items-center gap-2.5 text-left hover:bg-[#f5f5f7] transition-colors">
                  <div className="w-7 h-7 rounded-full bg-[#1d1d1f] flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium text-white">{member.name.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-[#1d1d1f] truncate">{member.name}</p>
                    <p className="text-[10px] text-[#a1a1a6] truncate">{member.email}</p>
                  </div>
                </button>
              ))}
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

          {/* 진행 중인 대화 */}
          {dmChannels.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-1">
                <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">진행 중인 대화</p>
              </div>
              {dmChannels.map(c => (
                <button key={c.id} onClick={() => openChannel(c.id)}
                  className={`w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-[#f5f5f7] transition-colors ${activeChannel === c.id ? 'bg-[#f5f5f7] border-l-2 border-[#0071e3]' : ''}`}>
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
                      {m.content}
                      {m.attachment && (
                        <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg ${m.isOwn ? 'bg-[#6e6e73]/30' : 'bg-white border border-[#e5e5e7]'}`}>
                          <Paperclip size={14} className="shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{m.attachment.name}</p>
                            <p className={`text-xs ${m.isOwn ? 'text-white/70' : 'text-[#6e6e73]'}`}>{m.attachment.size}</p>
                          </div>
                        </div>
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
                <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl hover:bg-[#f5f5f7] text-[#6e6e73] transition-colors shrink-0"><Paperclip size={20} /></button>
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="메시지를 입력하세요..." className="flex-1 px-4 py-2.5 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-sm placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]" />
                <button onClick={sendMessage} disabled={!input.trim()} className="p-2.5 rounded-xl bg-[#1d1d1f] text-white hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"><Send size={20} /></button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
