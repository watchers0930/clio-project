'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, MessageCircle, Users, Send, Paperclip, X } from 'lucide-react';

/* ── types ── */
interface Channel {
  id: string;
  name: string;
  type: 'department' | 'dm' | 'group';
  unread: number;
  lastMessage?: string;
  avatar?: string;
}

interface Msg {
  id: string;
  sender: string;
  avatar: string;
  content: string;
  time: string;
  isOwn: boolean;
  attachment?: { name: string; size: string };
}

interface UserItem {
  id: string;
  name: string;
  email: string;
}

/* ── page ── */
export default function MessagesPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, Msg[]>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [channelSearch, setChannelSearch] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAttachPicker, setShowAttachPicker] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string } | null>(null);

  // DM 생성 모달
  const [showNewDm, setShowNewDm] = useState(false);
  const [userList, setUserList] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 현재 사용자 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem('clio_user');
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch {}
  }, []);

  // 채널 목록 로드
  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/channels');
      if (res.ok) {
        const json = await res.json();
        const apiChannels = (json.data ?? []).map((c: { id: string; name: string; type: string }) => ({
          id: c.id,
          name: c.name,
          type: c.type === 'direct' ? 'dm' as const : c.type === 'group' ? 'group' as const : 'department' as const,
          unread: 0,
          lastMessage: '',
          avatar: c.name?.charAt(0),
        }));
        setChannels(apiChannels);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const messages = activeChannel ? (messagesMap[activeChannel] ?? []) : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 채널 열기
  const openChannel = async (channelId: string) => {
    setActiveChannel(channelId);
    setShowSidebar(false);
    setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, unread: 0 } : c)));

    if (!messagesMap[channelId]) {
      try {
        const res = await fetch(`/api/messages/channels/${channelId}`);
        if (res.ok) {
          const json = await res.json();
          const apiMsgs = (json.data ?? []).map((m: { id: string; userId: string; userName: string; content: string; createdAt: string }) => ({
            id: m.id,
            sender: m.userName,
            avatar: m.userName?.charAt(0) ?? '?',
            content: m.content,
            time: new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            isOwn: m.userId === currentUser?.id,
          }));
          setMessagesMap((prev) => ({ ...prev, [channelId]: apiMsgs }));
        }
      } catch {}
    }
  };

  // 메시지 전송
  const sendMessage = async () => {
    if (!input.trim() || !activeChannel) return;
    const content = input.trim();
    setInput('');

    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const tempMsg: Msg = {
      id: `m_${Date.now()}`,
      sender: currentUser?.name ?? '나',
      avatar: (currentUser?.name ?? '나').charAt(0),
      content,
      time: timeStr,
      isOwn: true,
    };
    setMessagesMap((prev) => ({
      ...prev,
      [activeChannel]: [...(prev[activeChannel] ?? []), tempMsg],
    }));
    setChannels((prev) => prev.map((c) => (c.id === activeChannel ? { ...c, lastMessage: content } : c)));

    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: activeChannel, content }),
      });
    } catch {}
  };

  // 파일 첨부
  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannel) return;
    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const sizeStr = file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    const newMsg: Msg = {
      id: `m_${Date.now()}`,
      sender: currentUser?.name ?? '나',
      avatar: (currentUser?.name ?? '나').charAt(0),
      content: '파일을 공유했습니다.',
      time: timeStr,
      isOwn: true,
      attachment: { name: file.name, size: sizeStr },
    };
    setMessagesMap((prev) => ({ ...prev, [activeChannel]: [...(prev[activeChannel] ?? []), newMsg] }));
    setChannels((prev) => prev.map((c) => (c.id === activeChannel ? { ...c, lastMessage: `[파일] ${file.name}` } : c)));
    setShowAttachPicker(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // DM 생성
  const openNewDmModal = async () => {
    setShowNewDm(true);
    setUserSearch('');
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        setUserList((json.data ?? []).filter((u: UserItem) => u.id !== currentUser?.id));
      }
    } catch {}
  };

  const createDm = async (targetUserId: string) => {
    try {
      const res = await fetch('/api/messages/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'direct', targetUserId }),
      });
      if (res.ok) {
        const json = await res.json();
        setShowNewDm(false);
        await loadChannels();
        if (json.data?.id) openChannel(json.data.id);
      }
    } catch {}
  };

  const filteredChannels = channels.filter((c) => c.name.includes(channelSearch));
  const deptChannels = filteredChannels.filter((c) => c.type === 'department');
  const dmChannels = filteredChannels.filter((c) => c.type === 'dm' || c.type === 'group');
  const activeChannelData = channels.find((c) => c.id === activeChannel);
  const totalUnread = channels.reduce((sum, c) => sum + c.unread, 0);
  const filteredUsers = userList.filter((u) => u.name.includes(userSearch) || u.email.includes(userSearch));

  if (loading) {
    return (
      <div className="flex gap-4 h-[calc(100vh-120px)] animate-pulse">
        <div className="w-80 bg-white rounded-2xl border border-[#e5e5e7]" />
        <div className="flex-1 bg-white rounded-2xl border border-[#e5e5e7]" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachFile} />

      {/* ── Left Panel ── */}
      <div className={`${showSidebar ? 'fixed inset-0 z-40 bg-black/40' : 'hidden'} lg:hidden`} onClick={() => setShowSidebar(false)} />
      <aside className={`${showSidebar ? 'fixed left-0 top-0 bottom-0 z-50' : 'hidden'} lg:relative lg:block w-80 bg-white rounded-2xl border border-[#e5e5e7] shadow-sm flex flex-col shrink-0 overflow-hidden`}>
        {/* 내 프로필 */}
        {currentUser && (
          <div className="px-4 pt-4 pb-2 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#0071e3] flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-white">{currentUser.name.charAt(0)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1d1d1f] truncate">{currentUser.name}</p>
              <p className="text-xs text-[#6e6e73] truncate">{currentUser.email}</p>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-[#e5e5e7]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#1d1d1f]">메시지</h2>
            <div className="flex items-center gap-1">
              {totalUnread > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#0071e3] text-white font-num">{totalUnread}</span>
              )}
              <button onClick={openNewDmModal} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] transition-colors" title="새 대화">
                <Plus size={18} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e6e73]" />
            <input
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder="채널 검색..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-sm placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessageCircle size={32} className="text-[#e5e5e7] mb-3" />
              <p className="text-sm text-[#6e6e73] mb-1">채널이 없습니다</p>
              <p className="text-xs text-[#a1a1a6] mb-4">새 대화를 시작하거나<br />설정에서 부서를 생성하세요</p>
              <button onClick={openNewDmModal} className="px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors flex items-center gap-2">
                <Plus size={16} /> 새 대화 시작
              </button>
            </div>
          ) : (
            <>
              {deptChannels.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">부서 채널</p>
                  </div>
                  {deptChannels.map((c) => (
                    <button key={c.id} onClick={() => openChannel(c.id)}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#f5f5f7] transition-colors ${activeChannel === c.id ? 'bg-[#f5f5f7] border-l-2 border-[#0071e3]' : ''}`}>
                      <div className="w-9 h-9 rounded-xl bg-[#f5f5f7] flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium text-[#1d1d1f]">#</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm truncate ${c.unread > 0 ? 'font-semibold' : 'font-medium'} text-[#1d1d1f]`}>{c.name}</span>
                          {c.unread > 0 && <span className="ml-2 w-5 h-5 rounded-full bg-[#0071e3] text-white text-xs flex items-center justify-center shrink-0 font-num">{c.unread}</span>}
                        </div>
                        {c.lastMessage && <p className={`text-xs truncate mt-0.5 ${c.unread > 0 ? 'text-[#1d1d1f] font-medium' : 'text-[#6e6e73]'}`}>{c.lastMessage}</p>}
                      </div>
                    </button>
                  ))}
                </>
              )}

              <div className="px-4 pt-4 pb-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">다이렉트 메시지</p>
                <button onClick={openNewDmModal} className="p-1 rounded hover:bg-[#f5f5f7] text-[#6e6e73]"><Plus size={14} /></button>
              </div>
              {dmChannels.length === 0 && (
                <p className="px-4 py-3 text-xs text-[#a1a1a6]">아직 대화가 없습니다</p>
              )}
              {dmChannels.map((c) => (
                <button key={c.id} onClick={() => openChannel(c.id)}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#f5f5f7] transition-colors ${activeChannel === c.id ? 'bg-[#f5f5f7] border-l-2 border-[#0071e3]' : ''}`}>
                  <div className="w-9 h-9 rounded-full bg-[#1d1d1f] flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-white">{c.avatar}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${c.unread > 0 ? 'font-semibold' : 'font-medium'} text-[#1d1d1f]`}>{c.name}</span>
                      {c.unread > 0 && <span className="ml-2 w-5 h-5 rounded-full bg-[#0071e3] text-white text-xs flex items-center justify-center shrink-0 font-num">{c.unread}</span>}
                    </div>
                    {c.lastMessage && <p className={`text-xs truncate mt-0.5 ${c.unread > 0 ? 'text-[#1d1d1f] font-medium' : 'text-[#6e6e73]'}`}>{c.lastMessage}</p>}
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
            <div className="w-20 h-20 rounded-full bg-[#f5f5f7] flex items-center justify-center mb-4">
              <MessageCircle size={32} className="text-[#0071e3]" />
            </div>
            <h3 className="text-lg font-semibold text-[#1d1d1f] mb-1">대화를 선택하세요</h3>
            <p className="text-sm text-[#6e6e73] mb-4">왼쪽 채널 목록에서 대화를 선택하거나<br />새 대화를 시작하세요.</p>
            <button onClick={openNewDmModal} className="px-5 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors flex items-center gap-2">
              <Plus size={16} /> 새 대화 시작
            </button>
            <button onClick={() => setShowSidebar(true)} className="mt-3 px-4 py-2 rounded-xl text-sm font-medium text-[#6e6e73] hover:bg-[#f5f5f7] lg:hidden">
              채널 목록 보기
            </button>
          </div>
        ) : (
          <>
            {/* header */}
            <div className="px-5 py-3 border-b border-[#e5e5e7] flex items-center gap-3">
              <button onClick={() => setShowSidebar(true)} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] lg:hidden">
                <Users size={20} />
              </button>
              {activeChannelData?.type === 'department' ? (
                <div className="w-8 h-8 rounded-xl bg-[#f5f5f7] flex items-center justify-center"><span className="text-sm font-medium text-[#1d1d1f]">#</span></div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1d1d1f] flex items-center justify-center"><span className="text-xs font-medium text-white">{activeChannelData?.avatar ?? '?'}</span></div>
              )}
              <div>
                <h3 className="font-semibold text-[#1d1d1f]">{activeChannelData?.name}</h3>
                <p className="text-xs text-[#6e6e73]">{activeChannelData?.type === 'department' ? '부서 채널' : activeChannelData?.type === 'group' ? '그룹' : '다이렉트 메시지'}</p>
              </div>
            </div>

            {/* messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 && (
                <p className="text-center text-sm text-[#6e6e73] py-10">아직 메시지가 없습니다. 첫 메시지를 보내보세요!</p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.isOwn ? 'flex-row-reverse' : ''}`}>
                  {!m.isOwn && (
                    <div className="w-8 h-8 rounded-full bg-[#1d1d1f] flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-white">{m.avatar}</span>
                    </div>
                  )}
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

            {/* input */}
            <div className="px-4 py-3 border-t border-[#e5e5e7]">
              <div className="flex items-center gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl hover:bg-[#f5f5f7] text-[#6e6e73] transition-colors shrink-0">
                  <Paperclip size={20} />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-sm placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                />
                <button onClick={sendMessage} disabled={!input.trim()} className="p-2.5 rounded-xl bg-[#1d1d1f] text-white hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── DM 생성 모달 ── */}
      {showNewDm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNewDm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5e7]">
              <h3 className="text-lg font-semibold">새 대화</h3>
              <button onClick={() => setShowNewDm(false)} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]"><X size={20} /></button>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e6e73]" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="이름 또는 이메일 검색..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-sm placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                  autoFocus
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <p className="text-center text-sm text-[#6e6e73] py-6">
                    {userList.length === 0 ? '등록된 사용자가 없습니다.\n설정에서 사용자를 추가하세요.' : '검색 결과가 없습니다.'}
                  </p>
                ) : filteredUsers.map((u) => (
                  <button key={u.id} onClick={() => createDm(u.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#f5f5f7] rounded-xl transition-colors">
                    <div className="w-9 h-9 rounded-full bg-[#1d1d1f] flex items-center justify-center shrink-0">
                      <span className="text-sm font-medium text-white">{u.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1d1d1f]">{u.name}</p>
                      <p className="text-xs text-[#6e6e73]">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAttachPicker && <div className="fixed inset-0 z-[5]" onClick={() => setShowAttachPicker(false)} />}
    </div>
  );
}
