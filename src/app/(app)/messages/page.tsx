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
}

/* ────────────────────────── mock ─────────────────────────── */
const MOCK_CHANNELS: Channel[] = [
  { id: 'c1', name: '경영기획팀', type: 'department', unread: 3, lastMessage: '내일 보고서 마감입니다' },
  { id: 'c2', name: '개발팀', type: 'department', unread: 0, lastMessage: '배포 완료했습니다' },
  { id: 'c3', name: '마케팅팀', type: 'department', unread: 1, lastMessage: '캠페인 결과 공유드립니다' },
  { id: 'c4', name: '인사팀', type: 'department', unread: 0, lastMessage: '면접 일정 확인 부탁드립니다' },
  { id: 'c5', name: '법무팀', type: 'department', unread: 0, lastMessage: '계약서 검토 완료' },
  { id: 'd1', name: '김민수', type: 'dm', unread: 2, lastMessage: '보고서 파일 보내드렸습니다', avatar: '김' },
  { id: 'd2', name: '이지은', type: 'dm', unread: 0, lastMessage: '감사합니다!', avatar: '이' },
  { id: 'd3', name: '박준형', type: 'dm', unread: 1, lastMessage: '미팅 시간 변경 가능할까요?', avatar: '박' },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  c1: [
    { id: 'm1', sender: '김민수', avatar: '김', content: '안녕하세요, 1분기 실적보고서 초안을 공유합니다.', time: '오전 9:30', isOwn: false },
    { id: 'm2', sender: '나', avatar: '나', content: '감사합니다. 확인 후 피드백 드리겠습니다.', time: '오전 9:35', isOwn: true },
    { id: 'm3', sender: '이지은', avatar: '이', content: '저도 검토해 보겠습니다. 마케팅 파트는 제가 수정할게요.', time: '오전 10:00', isOwn: false },
    { id: 'm4', sender: '김민수', avatar: '김', content: '네, 내일 보고서 마감입니다. 오늘 중으로 최종 확인 부탁드립니다.', time: '오전 10:15', isOwn: false },
    { id: 'm5', sender: '나', avatar: '나', content: '알겠습니다. 오후 3시까지 최종본 공유하겠습니다.', time: '오전 10:20', isOwn: true },
  ],
  c2: [
    { id: 'm6', sender: '박준형', avatar: '박', content: 'v2.1.0 배포 완료했습니다. 테스트 부탁드립니다.', time: '오후 2:00', isOwn: false },
    { id: 'm7', sender: '나', avatar: '나', content: '수고하셨습니다! 바로 확인하겠습니다.', time: '오후 2:05', isOwn: true },
  ],
};

/* ────────────────────────── page ─────────────────────────── */
export default function MessagesPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [channelSearch, setChannelSearch] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/messages/channels');
        if (res.ok) {
          const data = await res.json();
          setChannels(data.channels ?? MOCK_CHANNELS);
        } else throw new Error();
      } catch {
        setChannels(MOCK_CHANNELS);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    const msgs = MOCK_MESSAGES[activeChannel] ?? [];
    setMessages(msgs);
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !activeChannel) return;
    const newMsg: Message = {
      id: `m_${Date.now()}`,
      sender: '나',
      avatar: '나',
      content: input.trim(),
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
  };

  const filteredChannels = channels.filter((c) => c.name.includes(channelSearch));
  const deptChannels = filteredChannels.filter((c) => c.type === 'department');
  const dmChannels = filteredChannels.filter((c) => c.type === 'dm');
  const activeChannelData = channels.find((c) => c.id === activeChannel);

  if (loading) {
    return (
      <div className="flex gap-4 h-[calc(100vh-120px)] animate-pulse">
        <div className="w-80 bg-white rounded-2xl border border-[#DDE3EC]" />
        <div className="flex-1 bg-white rounded-2xl border border-[#DDE3EC]" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* ── Left Panel: Channel list ── */}
      <div className={`${showSidebar ? 'fixed inset-0 z-40 bg-black/40' : 'hidden'} lg:hidden`} onClick={() => setShowSidebar(false)} />
      <aside className={`${showSidebar ? 'fixed left-0 top-0 bottom-0 z-50' : 'hidden'} lg:relative lg:block w-80 bg-white rounded-2xl border border-[#DDE3EC] shadow-sm flex flex-col shrink-0 overflow-hidden`}>
        <div className="p-4 border-b border-[#DDE3EC]">
          <h2 className="font-semibold text-[#0A1628] mb-3">메시지</h2>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A8D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder="채널 검색..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DDE3EC] bg-[#F8FAFC] text-sm placeholder:text-[#6B7A8D] focus:outline-none focus:ring-2 focus:ring-[#4B8FD4]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* dept channels */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs font-semibold text-[#6B7A8D] uppercase tracking-wide">부서 채널</p>
          </div>
          {deptChannels.map((c) => (
            <button
              key={c.id}
              onClick={() => { setActiveChannel(c.id); setShowSidebar(false); }}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#F8FAFC] transition-colors ${activeChannel === c.id ? 'bg-[#EBF2FA]' : ''}`}
            >
              <div className="w-9 h-9 rounded-xl bg-[#F2F5F9] flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-[#4B8FD4]">#</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#0A1628] truncate">{c.name}</span>
                  {c.unread > 0 && (
                    <span className="ml-2 w-5 h-5 rounded-full bg-[#4B8FD4] text-white text-xs flex items-center justify-center shrink-0">
                      {c.unread}
                    </span>
                  )}
                </div>
                {c.lastMessage && <p className="text-xs text-[#6B7A8D] truncate mt-0.5">{c.lastMessage}</p>}
              </div>
            </button>
          ))}

          {/* dm channels */}
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs font-semibold text-[#6B7A8D] uppercase tracking-wide">다이렉트 메시지</p>
          </div>
          {dmChannels.map((c) => (
            <button
              key={c.id}
              onClick={() => { setActiveChannel(c.id); setShowSidebar(false); }}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#F8FAFC] transition-colors ${activeChannel === c.id ? 'bg-[#EBF2FA]' : ''}`}
            >
              <div className="w-9 h-9 rounded-full bg-[#0A1628] flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-white">{c.avatar}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#0A1628] truncate">{c.name}</span>
                  {c.unread > 0 && (
                    <span className="ml-2 w-5 h-5 rounded-full bg-[#4B8FD4] text-white text-xs flex items-center justify-center shrink-0">
                      {c.unread}
                    </span>
                  )}
                </div>
                {c.lastMessage && <p className="text-xs text-[#6B7A8D] truncate mt-0.5">{c.lastMessage}</p>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Right Panel: Messages ── */}
      <main className="flex-1 bg-white rounded-2xl border border-[#DDE3EC] shadow-sm flex flex-col overflow-hidden">
        {!activeChannel ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-20 h-20 rounded-full bg-[#EBF2FA] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#4B8FD4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#0A1628] mb-1">대화를 선택하세요</h3>
            <p className="text-sm text-[#6B7A8D]">왼쪽 채널 목록에서 대화를 선택하면<br />메시지가 표시됩니다.</p>
            <button onClick={() => setShowSidebar(true)} className="mt-4 px-4 py-2 rounded-xl bg-[#4B8FD4] text-white text-sm font-medium lg:hidden hover:bg-[#3A7DC2] transition-colors">
              채널 목록 보기
            </button>
          </div>
        ) : (
          <>
            {/* channel header */}
            <div className="px-5 py-3 border-b border-[#DDE3EC] flex items-center gap-3">
              <button onClick={() => setShowSidebar(true)} className="p-1 rounded-lg hover:bg-[#F2F5F9] text-[#6B7A8D] lg:hidden">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
              </button>
              <div className="w-8 h-8 rounded-full bg-[#0A1628] flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {activeChannelData?.type === 'department' ? '#' : activeChannelData?.avatar ?? '?'}
                </span>
              </div>
              <h3 className="font-semibold text-[#0A1628]">{activeChannelData?.name}</h3>
            </div>

            {/* messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 && (
                <p className="text-center text-sm text-[#6B7A8D] py-10">아직 메시지가 없습니다. 첫 메시지를 보내보세요!</p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.isOwn ? 'flex-row-reverse' : ''}`}>
                  {!m.isOwn && (
                    <div className="w-8 h-8 rounded-full bg-[#0A1628] flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-white">{m.avatar}</span>
                    </div>
                  )}
                  <div className={`max-w-[70%] ${m.isOwn ? 'items-end' : ''}`}>
                    {!m.isOwn && <p className="text-xs text-[#6B7A8D] mb-1">{m.sender}</p>}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.isOwn ? 'bg-[#4B8FD4] text-white rounded-tr-md' : 'bg-[#F2F5F9] text-[#0A1628] rounded-tl-md'}`}>
                      {m.content}
                    </div>
                    <p className={`text-xs text-[#6B7A8D] mt-1 ${m.isOwn ? 'text-right' : ''}`}>{m.time}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* input */}
            <div className="px-4 py-3 border-t border-[#DDE3EC]">
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-xl hover:bg-[#F2F5F9] text-[#6B7A8D] transition-colors shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#DDE3EC] bg-[#F8FAFC] text-sm placeholder:text-[#6B7A8D] focus:outline-none focus:ring-2 focus:ring-[#4B8FD4]"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="p-2.5 rounded-xl bg-[#4B8FD4] text-white hover:bg-[#3A7DC2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
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
    </div>
  );
}
