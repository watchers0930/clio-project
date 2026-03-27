'use client';

import { useState, useEffect, useRef } from 'react';

/* ────────────────────────── types ────────────────────────── */
interface Channel {
  id: string;
  name: string;
  type: 'department' | 'dm';
  unread: number;
  lastMessage?: string;
  avatar?: string;
}

interface Message {
  id: string;
  sender: string;
  avatar: string;
  content: string;
  time: string;
  isOwn: boolean;
  attachment?: { name: string; size: string };
}

/* ────────────────────────── (mock data removed, using API) ── */

/* ────────────────────────── page ─────────────────────────── */
export default function MessagesPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [channelSearch, setChannelSearch] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAttachPicker, setShowAttachPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/messages/channels');
        if (res.ok) {
          const json = await res.json();
          const apiChannels = (json.data ?? []).map((c: { id: string; name: string; type: string }) => ({
            id: c.id,
            name: c.name,
            type: c.type === 'direct' ? 'dm' as const : 'department' as const,
            unread: 0,
            lastMessage: '',
          }));
          setChannels(apiChannels);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const messages = activeChannel ? (messagesMap[activeChannel] ?? []) : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openChannel = async (channelId: string) => {
    setActiveChannel(channelId);
    setShowSidebar(false);
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, unread: 0 } : c))
    );

    // API에서 메시지 로드
    if (!messagesMap[channelId]) {
      try {
        const res = await fetch(`/api/messages/channels/${channelId}`);
        if (res.ok) {
          const json = await res.json();
          const currentUser = JSON.parse(localStorage.getItem('clio_user') ?? '{}');
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
      } catch { /* ignore */ }
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeChannel) return;
    const content = input.trim();
    setInput('');

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const currentUser = JSON.parse(localStorage.getItem('clio_user') ?? '{}');

    // 낙관적 업데이트
    const tempMsg: Message = {
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
    setChannels((prev) =>
      prev.map((c) => (c.id === activeChannel ? { ...c, lastMessage: content } : c))
    );

    // API 전송
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: activeChannel, content }),
      });
    } catch { /* 낙관적 업데이트 유지 */ }
  };

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannel) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const sizeStr = file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(0)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    const currentUser = JSON.parse(localStorage.getItem('clio_user') ?? '{}');
    const userName = currentUser?.name ?? '나';
    const newMsg: Message = {
      id: `m_${Date.now()}`,
      sender: userName,
      avatar: userName.charAt(0),
      content: `파일을 공유했습니다.`,
      time: timeStr,
      isOwn: true,
      attachment: { name: file.name, size: sizeStr },
    };
    setMessagesMap((prev) => ({
      ...prev,
      [activeChannel]: [...(prev[activeChannel] ?? []), newMsg],
    }));
    setChannels((prev) =>
      prev.map((c) => (c.id === activeChannel ? { ...c, lastMessage: `[파일] ${file.name}` } : c))
    );
    setShowAttachPicker(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredChannels = channels.filter((c) => c.name.includes(channelSearch));
  const deptChannels = filteredChannels.filter((c) => c.type === 'department');
  const dmChannels = filteredChannels.filter((c) => c.type === 'dm');
  const activeChannelData = channels.find((c) => c.id === activeChannel);
  const totalUnread = channels.reduce((sum, c) => sum + c.unread, 0);

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
      {/* hidden file input for attachment */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleAttachFile}
      />

      {/* ── Left Panel: Channel list ── */}
      <div className={`${showSidebar ? 'fixed inset-0 z-40 bg-black/40' : 'hidden'} lg:hidden`} onClick={() => setShowSidebar(false)} />
      <aside className={`${showSidebar ? 'fixed left-0 top-0 bottom-0 z-50' : 'hidden'} lg:relative lg:block w-80 bg-white rounded-2xl border border-[#e5e5e7] shadow-sm flex flex-col shrink-0 overflow-hidden`}>
        <div className="p-4 border-b border-[#e5e5e7]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#1d1d1f]">메시지</h2>
            {totalUnread > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#0071e3] text-white font-num">{totalUnread}</span>
            )}
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder="채널 검색..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-sm placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* dept channels */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">부서 채널</p>
          </div>
          {deptChannels.map((c) => (
            <button
              key={c.id}
              onClick={() => openChannel(c.id)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#f5f5f7] transition-colors ${activeChannel === c.id ? 'bg-[#f5f5f7] border-l-2 border-[#0071e3]' : ''}`}
            >
              <div className="w-9 h-9 rounded-xl bg-[#f5f5f7] flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-[#1d1d1f]">#</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm truncate ${c.unread > 0 ? 'font-semibold text-[#1d1d1f]' : 'font-medium text-[#1d1d1f]'}`}>{c.name}</span>
                  {c.unread > 0 && (
                    <span className="ml-2 w-5 h-5 rounded-full bg-[#0071e3] text-white text-xs flex items-center justify-center shrink-0 font-num">
                      {c.unread}
                    </span>
                  )}
                </div>
                {c.lastMessage && <p className={`text-xs truncate mt-0.5 ${c.unread > 0 ? 'text-[#1d1d1f] font-medium' : 'text-[#6e6e73]'}`}>{c.lastMessage}</p>}
              </div>
            </button>
          ))}

          {/* dm channels */}
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">다이렉트 메시지</p>
          </div>
          {dmChannels.map((c) => (
            <button
              key={c.id}
              onClick={() => openChannel(c.id)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#f5f5f7] transition-colors ${activeChannel === c.id ? 'bg-[#f5f5f7] border-l-2 border-[#0071e3]' : ''}`}
            >
              <div className="w-9 h-9 rounded-full bg-[#1d1d1f] flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-white">{c.avatar}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm truncate ${c.unread > 0 ? 'font-semibold text-[#1d1d1f]' : 'font-medium text-[#1d1d1f]'}`}>{c.name}</span>
                  {c.unread > 0 && (
                    <span className="ml-2 w-5 h-5 rounded-full bg-[#0071e3] text-white text-xs flex items-center justify-center shrink-0 font-num">
                      {c.unread}
                    </span>
                  )}
                </div>
                {c.lastMessage && <p className={`text-xs truncate mt-0.5 ${c.unread > 0 ? 'text-[#1d1d1f] font-medium' : 'text-[#6e6e73]'}`}>{c.lastMessage}</p>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Right Panel: Messages ── */}
      <main className="flex-1 bg-white rounded-2xl border border-[#e5e5e7] shadow-sm flex flex-col overflow-hidden">
        {!activeChannel ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-20 h-20 rounded-full bg-[#f5f5f7] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#0071e3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#1d1d1f] mb-1">대화를 선택하세요</h3>
            <p className="text-sm text-[#6e6e73]">왼쪽 채널 목록에서 대화를 선택하면<br />메시지가 표시됩니다.</p>
            <button onClick={() => setShowSidebar(true)} className="mt-4 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium lg:hidden hover:bg-[#0071e3] transition-colors">
              채널 목록 보기
            </button>
          </div>
        ) : (
          <>
            {/* channel header */}
            <div className="px-5 py-3 border-b border-[#e5e5e7] flex items-center gap-3">
              <button onClick={() => setShowSidebar(true)} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] lg:hidden">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
              </button>
              {activeChannelData?.type === 'department' ? (
                <div className="w-8 h-8 rounded-xl bg-[#f5f5f7] flex items-center justify-center">
                  <span className="text-sm font-medium text-[#1d1d1f]">#</span>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1d1d1f] flex items-center justify-center">
                  <span className="text-xs font-medium text-white">{activeChannelData?.avatar ?? '?'}</span>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-[#1d1d1f]">{activeChannelData?.name}</h3>
                <p className="text-xs text-[#6e6e73]">
                  {activeChannelData?.type === 'department' ? '부서 채널' : '다이렉트 메시지'}
                </p>
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
                      {/* attachment in message */}
                      {m.attachment && (
                        <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg ${m.isOwn ? 'bg-[#6e6e73]/30' : 'bg-white border border-[#e5e5e7]'}`}>
                          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
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
                <div className="relative">
                  <button
                    onClick={() => setShowAttachPicker(!showAttachPicker)}
                    className="p-2 rounded-xl hover:bg-[#f5f5f7] text-[#6e6e73] transition-colors shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                  </button>
                  {showAttachPicker && (
                    <div className="absolute bottom-12 left-0 bg-white rounded-xl border border-[#e5e5e7] shadow-lg p-2 w-48 z-10">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-3 py-2 text-left text-sm text-[#1d1d1f] hover:bg-[#f5f5f7] rounded-lg transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-[#6e6e73]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        파일 첨부
                      </button>
                    </div>
                  )}
                </div>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-sm placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="p-2.5 rounded-xl bg-[#1d1d1f] text-white hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* close attachment picker when clicking outside */}
      {showAttachPicker && (
        <div className="fixed inset-0 z-[5]" onClick={() => setShowAttachPicker(false)} />
      )}
    </div>
  );
}
