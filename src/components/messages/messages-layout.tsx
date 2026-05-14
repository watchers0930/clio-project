'use client';

import Link from 'next/link';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { Spinner } from '@/components/ui';
import type { Channel, DeptTree, Msg, MyFile } from './types';

export function SupportToolBanner() {
  return (
    <div
      className="absolute z-10 hidden xl:flex items-center gap-3 rounded-2xl border border-[#E2E5EA] bg-white/95 px-4 py-3 shadow-sm backdrop-blur"
      style={{ top: 16, left: 352, right: 16 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2E6FF2]">Collaboration</p>
        <p className="text-[12px] text-[#666]">메시지는 문서 공유와 코멘트 반영을 보조하는 협업 기능입니다. 협업 중에도 문서 운영 흐름으로 바로 돌아갈 수 있습니다.</p>
      </div>
      <div className="flex items-center gap-2 pl-2">
        <Link href="/files" className="rounded-lg bg-[#F7F8FA] px-3.5 py-2.5 text-[11px] font-medium text-[#1B1F2B] hover:bg-[#EEF3FE] hover:text-[#2E6FF2] transition-colors">문서허브</Link>
        <Link href="/search" className="rounded-lg bg-[#F7F8FA] px-3.5 py-2.5 text-[11px] font-medium text-[#1B1F2B] hover:bg-[#EEF3FE] hover:text-[#2E6FF2] transition-colors">AI 검색</Link>
        <Link href="/documents" className="rounded-lg bg-[#F7F8FA] px-3.5 py-2.5 text-[11px] font-medium text-[#1B1F2B] hover:bg-[#EEF3FE] hover:text-[#2E6FF2] transition-colors">문서 생성</Link>
      </div>
    </div>
  );
}

export function MessagesSidebar({
  showSidebar,
  currentUser,
  deptTree,
  expandedDepts,
  unassigned,
  dmChannels,
  activeChannel,
  onCloseSidebar,
  onToggleDept,
  onOpenDm,
  onOpenChannel,
  onDeleteChannel,
}: {
  showSidebar: boolean;
  currentUser: { id?: string; name: string; email: string } | null;
  deptTree: DeptTree[];
  expandedDepts: Set<string>;
  unassigned: { id: string; name: string; email: string }[];
  dmChannels: Channel[];
  activeChannel: string | null;
  onCloseSidebar: () => void;
  onToggleDept: (id: string) => void;
  onOpenDm: (userId: string) => void;
  onOpenChannel: (channelId: string) => void;
  onDeleteChannel: (channelId: string) => void;
}) {
  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden ${showSidebar ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onCloseSidebar} />
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-[86vw] max-w-[320px] shrink-0 flex-col overflow-hidden rounded-r-2xl border-r border-[#e5e5e7] bg-white shadow-xl transition-transform duration-300 ease-out lg:relative lg:w-80 lg:max-w-none lg:translate-x-0 lg:rounded-2xl lg:border lg:shadow-sm ${showSidebar ? 'translate-x-0' : '-translate-x-full'} lg:!transform-none`}
      >
        {currentUser && (
          <div className="px-4 pt-5 pb-3 flex items-center gap-3 border-b border-[#e5e5e7]">
            <div className="w-9 h-9 rounded-full bg-[#0071e3] flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-white">{currentUser.name.charAt(0)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#1d1d1f] truncate">{currentUser.name}</p>
              <p className="text-xs text-[#6e6e73] truncate">{currentUser.email}</p>
            </div>
            <button onClick={onCloseSidebar} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] transition-colors lg:hidden shrink-0">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">조직</p>
          </div>

          {deptTree.map((dept) => (
            <div key={dept.id}>
              <button onClick={() => onToggleDept(dept.id)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-[#f5f5f7] transition-colors">
                {expandedDepts.has(dept.id) ? <ChevronDown size={14} className="text-[#6e6e73]" /> : <ChevronRight size={14} className="text-[#6e6e73]" />}
                <Building2 size={14} className="text-[#0071e3]" />
                <span className="text-sm font-medium text-[#1d1d1f]">{dept.name}</span>
                <span className="text-xs text-[#a1a1a6] ml-auto">{dept.members.length}</span>
              </button>
              {expandedDepts.has(dept.id) && dept.members.map((member) => {
                const isMe = member.id === currentUser?.id;
                return (
                  <button
                    key={member.id}
                    onClick={() => !isMe && onOpenDm(member.id)}
                    className={`flex w-full items-center gap-3 py-3 pl-10 pr-4 text-left transition-colors ${isMe ? 'cursor-default' : 'hover:bg-[#f5f5f7]'}`}
                  >
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
              <div className="flex items-center gap-2 px-4 py-3">
                <User size={14} className="text-[#a1a1a6]" />
                <span className="text-sm font-medium text-[#6e6e73]">미배정</span>
              </div>
              {unassigned.map((member) => (
                <button key={member.id} onClick={() => onOpenDm(member.id)} className="flex w-full items-center gap-2.5 py-2.5 pl-10 pr-4 text-left hover:bg-[#f5f5f7] transition-colors">
                  <div className="w-7 h-7 rounded-full bg-[#6e6e73] flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium text-white">{member.name.charAt(0)}</span>
                  </div>
                  <p className="text-sm text-[#1d1d1f] truncate">{member.name}</p>
                </button>
              ))}
            </div>
          )}

          {dmChannels.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-1">
                <p className="text-xs font-semibold text-[#6e6e73] uppercase tracking-wide">이전 대화 목록</p>
              </div>
              {dmChannels.map((channel) => (
                <div key={channel.id} className={`group w-full px-4 py-3 flex items-center gap-3 hover:bg-[#f5f5f7] transition-colors ${activeChannel === channel.id ? 'bg-[#f5f5f7] border-l-2 border-[#0071e3]' : ''}`}>
                  <button onClick={() => onOpenChannel(channel.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-8 h-8 rounded-full bg-[#1d1d1f] flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-white">{channel.avatar}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${channel.unread > 0 ? 'font-semibold' : 'font-medium'} text-[#1d1d1f]`}>{channel.name}</span>
                        {channel.unread > 0 && <span className="ml-2 w-5 h-5 rounded-full bg-[#ff3b30] text-white text-xs flex items-center justify-center shrink-0 font-num">{channel.unread}</span>}
                      </div>
                      {channel.lastMessage && <p className="text-xs text-[#6e6e73] truncate">{channel.lastMessage}</p>}
                    </div>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteChannel(channel.id); }} className="p-1 rounded-lg text-transparent group-hover:text-[#a1a1a6] hover:!text-[#ff3b30] hover:bg-red-50 transition-all shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export function MessagesMain({
  activeChannel,
  activeChannelData,
  messages,
  uploading,
  input,
  messagesEndRef,
  onOpenDocumentContext,
  onSearchDocuments,
  onOpenFileHub,
  onOpenSidebar,
  onOpenAttach,
  onOpenShareModal,
  onInputChange,
  onSendMessage,
  onDownloadSharedFile,
}: {
  activeChannel: string | null;
  activeChannelData?: Channel;
  messages: Msg[];
  uploading: boolean;
  input: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onOpenDocumentContext: () => void;
  onSearchDocuments: () => void;
  onOpenFileHub: () => void;
  onOpenSidebar: () => void;
  onOpenAttach: () => void;
  onOpenShareModal: () => void;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onDownloadSharedFile: (fileId: string) => void;
}) {
  return (
    <main className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#e5e5e7] bg-white shadow-sm">
      {!activeChannel ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6" style={{ marginTop: -30 }}>
          <MessageCircle size={32} className="text-[#e5e5e7]" style={{ marginBottom: 20 }} />
          <h3 className="text-lg font-semibold text-[#1d1d1f]" style={{ marginBottom: 20 }}>대화를 선택하세요</h3>
          <p className="text-sm text-[#6e6e73]" style={{ marginBottom: 20 }}>왼쪽 조직도에서 대화할 사람을 클릭하세요.</p>
          <button onClick={onOpenSidebar} className="px-4 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium lg:hidden hover:bg-[#0071e3] transition-colors">
            조직도 보기
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-[#e5e5e7] px-4 py-3 sm:px-5">
            <button onClick={onOpenSidebar} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73] lg:hidden"><Search size={20} /></button>
            <div className="w-8 h-8 rounded-full bg-[#1d1d1f] flex items-center justify-center"><span className="text-xs font-medium text-white">{activeChannelData?.avatar ?? '?'}</span></div>
            <div>
              <h3 className="font-semibold text-[#1d1d1f]">{activeChannelData?.name}</h3>
              <p className="text-xs text-[#6e6e73]">{activeChannelData?.type === 'department' ? '부서 채널' : '다이렉트 메시지'}</p>
            </div>
          </div>

          <div className="border-b border-[#e5e5e7] bg-[#fbfbfc] px-4 py-3 sm:px-5">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7C8494]">Document Collaboration</p>
              <p className="text-[12px] leading-5 text-[#5E6573]">
                이 대화는 독립 채팅이 아니라 문서 공유와 피드백 반영을 위한 협업 공간입니다.
              </p>
              <div className="flex flex-wrap gap-2">
              <button onClick={onSearchDocuments} className="rounded-lg border border-[#D7E7FF] bg-white px-3.5 py-2.5 text-[12px] font-medium text-[#2E6FF2] hover:bg-[#F3F8FF] transition-colors">
                관련 문서 검색
              </button>
              <button onClick={onOpenDocumentContext} className="rounded-lg border border-[#D7EFDE] bg-white px-3.5 py-2.5 text-[12px] font-medium text-[#258A4E] hover:bg-[#F4FBF6] transition-colors">
                대화 요약 문서 작성
              </button>
              <button onClick={onOpenFileHub} className="rounded-lg border border-[#e5e5e7] bg-white px-3.5 py-2.5 text-[12px] font-medium text-[#4B5563] hover:bg-[#f5f5f7] transition-colors">
                문서허브 열기
              </button>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {messages.length === 0 && <p className="text-center text-sm text-[#6e6e73] py-10">아직 메시지가 없습니다. 첫 메시지를 보내보세요!</p>}
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.isOwn ? 'flex-row-reverse' : ''}`}>
                {!message.isOwn && <div className="w-8 h-8 rounded-full bg-[#1d1d1f] flex items-center justify-center shrink-0"><span className="text-xs font-medium text-white">{message.avatar}</span></div>}
                <div className={`max-w-[85%] sm:max-w-[72%] ${message.isOwn ? 'items-end' : ''}`}>
                  {!message.isOwn && <p className="text-xs text-[#6e6e73] mb-1">{message.sender}</p>}
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${message.isOwn ? 'bg-[#1d1d1f] text-white rounded-tr-md' : 'bg-[#f5f5f7] text-[#1d1d1f] rounded-tl-md'}`}>
                    {message.sharedFile ? (
                      <>
                        <p className="mb-2">{message.content.replace(/📎\s*/, '')}</p>
                        <button onClick={() => onDownloadSharedFile(message.sharedFile!.id)} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 transition-colors ${message.isOwn ? 'bg-white/10 hover:bg-white/20' : 'bg-white border border-[#e5e5e7] hover:border-[#0071e3] hover:bg-blue-50/50'}`}>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${message.isOwn ? 'bg-white/20' : 'bg-[#0071e3]/10'}`}>
                            <FileText size={18} className={message.isOwn ? 'text-white' : 'text-[#0071e3]'} />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-xs font-semibold truncate">{message.sharedFile.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Paperclip size={10} className={message.isOwn ? 'text-white/60' : 'text-[#6e6e73]'} />
                              <span className={`text-[10px] ${message.isOwn ? 'text-white/60' : 'text-[#6e6e73]'}`}>다운로드 · {message.attachment?.size ?? ''}</span>
                            </div>
                          </div>
                          <ChevronRight size={14} className={`shrink-0 ${message.isOwn ? 'text-white/40' : 'text-[#a1a1a6]'}`} />
                        </button>
                      </>
                    ) : message.document ? (
                      <>
                        <p className="mb-2">{message.content}</p>
                        <Link
                          href={`/documents/${message.document.id}`}
                          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 transition-colors ${message.isOwn ? 'bg-white/10 hover:bg-white/20' : 'bg-white border border-[#e5e5e7] hover:border-[#7C3AED] hover:bg-[#FAF5FF]'}`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${message.isOwn ? 'bg-white/20' : 'bg-[#7C3AED]/10'}`}>
                            <FileText size={18} className={message.isOwn ? 'text-white' : 'text-[#7C3AED]'} />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-xs font-semibold truncate">{message.document.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] ${message.isOwn ? 'text-white/60' : 'text-[#6e6e73]'}`}>
                                문서 열기 · {message.document.status}
                              </span>
                            </div>
                          </div>
                          <ChevronRight size={14} className={`shrink-0 ${message.isOwn ? 'text-white/40' : 'text-[#a1a1a6]'}`} />
                        </Link>
                      </>
                    ) : (
                      <>
                        {message.content}
                        {message.attachment && !message.sharedFile && (
                          <div className={`mt-2 flex items-center gap-2 px-3.5 py-2.5 rounded-lg ${message.isOwn ? 'bg-[#6e6e73]/30' : 'bg-white border border-[#e5e5e7]'}`}>
                            <Paperclip size={14} className="shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{message.attachment.name}</p>
                              <p className={`text-xs ${message.isOwn ? 'text-white/70' : 'text-[#6e6e73]'}`}>{message.attachment.size}</p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <p className={`text-xs text-[#6e6e73] mt-1 ${message.isOwn ? 'text-right' : ''}`}>{message.time}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-[#e5e5e7] px-4 py-4">
            <div className="flex items-end gap-2.5">
              <button onClick={onOpenAttach} disabled={uploading} className="p-2.5 rounded-xl hover:bg-[#f5f5f7] text-[#6e6e73] transition-colors shrink-0 disabled:opacity-40" title="파일 첨부">
                {uploading ? <Spinner size="sm" /> : <Paperclip size={20} />}
              </button>
              <button onClick={onOpenShareModal} className="p-2.5 rounded-xl hover:bg-[#f5f5f7] text-[#6e6e73] transition-colors shrink-0" title="파일함에서 공유"><FolderOpen size={20} /></button>
              <input value={input} onChange={(e) => onInputChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSendMessage(); } }} placeholder="메시지를 입력하세요..." className="min-w-0 flex-1 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 py-3 text-sm placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#0071e3]" />
              <button onClick={onSendMessage} disabled={!input.trim() || uploading} className="p-3 rounded-xl bg-[#1d1d1f] text-white hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"><Send size={20} /></button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export function MobileSidebarButton({ visible, onOpen }: { visible: boolean; onOpen: () => void }) {
  if (!visible) return null;

  return (
    <button
      onClick={onOpen}
      style={{ position: 'absolute', right: 20, bottom: 20, zIndex: 30, width: 48, height: 48, borderRadius: '50%', backgroundColor: '#0071e3', color: '#fff', border: 'none', boxShadow: '0 4px 16px rgba(0,113,227,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      className="lg:hidden active:scale-95 transition-transform"
      aria-label="조직도 열기"
    >
      <User size={22} />
    </button>
  );
}

export function FileShareModal({
  open,
  filesLoading,
  myFiles,
  selectedFileId,
  expiresInDays,
  sharing,
  onClose,
  onSelectFile,
  onChangeExpires,
  onShare,
}: {
  open: boolean;
  filesLoading: boolean;
  myFiles: MyFile[];
  selectedFileId: string | null;
  expiresInDays: number;
  sharing: boolean;
  onClose: () => void;
  onSelectFile: (id: string) => void;
  onChangeExpires: (days: number) => void;
  onShare: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-8 py-7 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#1d1d1f]">파일 공유</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <p className="text-xs text-[#6e6e73] mb-5">내 파일함에서 공유할 파일을 선택하세요. 파일은 이동되지 않고 읽기 권한만 부여됩니다.</p>
          {filesLoading ? (
            <div className="py-8 text-center text-sm text-[#6e6e73]">파일 목록 불러오는 중...</div>
          ) : myFiles.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#6e6e73]">업로드한 파일이 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {myFiles.map((file) => (
                <button key={file.id} onClick={() => onSelectFile(file.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${selectedFileId === file.id ? 'bg-[#0071e3]/10 border border-[#0071e3] ring-1 ring-[#0071e3]/30' : 'hover:bg-[#f5f5f7] border border-transparent'}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${selectedFileId === file.id ? 'bg-[#0071e3]' : 'bg-[#f5f5f7]'}`}>
                    <FileText size={16} className={selectedFileId === file.id ? 'text-white' : 'text-[#6e6e73]'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1d1d1f] truncate">{file.name}</p>
                    <p className="text-xs text-[#6e6e73]">{file.type} · {file.size}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-8 py-6 border-t border-[#e5e5e7]">
          <div className="flex items-center gap-3 mb-5">
            <label className="text-xs text-[#6e6e73]">공유 기간</label>
            <select value={expiresInDays} onChange={(e) => onChangeExpires(Number(e.target.value))} className="ml-auto px-3.5 py-2 rounded-lg border border-[#e5e5e7] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0071e3]">
              <option value={1}>1일</option>
              <option value={3}>3일</option>
              <option value={7}>7일</option>
              <option value={14}>14일</option>
              <option value={30}>30일</option>
              <option value={90}>90일</option>
            </select>
          </div>
          <button onClick={onShare} disabled={!selectedFileId || sharing} className="w-full py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {sharing ? '공유 중...' : '파일 공유하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FileViewModal({
  viewingFile,
  fileViewLoading,
  onClose,
  onOpenInFiles,
}: {
  viewingFile: { id: string; name: string; content?: string } | null;
  fileViewLoading: boolean;
  onClose: () => void;
  onOpenInFiles: (id: string) => void;
}) {
  if (!viewingFile) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-8 py-7 border-b border-[#e5e5e7] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={18} className="text-[#0071e3] shrink-0" />
            <h3 className="text-base font-semibold text-[#1d1d1f] truncate">{viewingFile.name}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]"><X size={18} /></button>
        </div>
        <div className="px-8 py-7">
          {fileViewLoading ? (
            <p className="text-sm text-[#6e6e73] text-center py-6">파일 정보를 불러오는 중...</p>
          ) : (
            <pre className="text-sm text-[#1d1d1f] whitespace-pre-wrap bg-[#f5f5f7] rounded-xl px-4 py-4 leading-relaxed">{viewingFile.content}</pre>
          )}
        </div>
        <div className="px-8 py-6 border-t border-[#e5e5e7]">
          <button onClick={() => onOpenInFiles(viewingFile.id)} className="w-full py-3 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] text-sm font-medium hover:bg-[#e5e5e7] transition-colors">
            파일함에서 열기
          </button>
        </div>
      </div>
    </div>
  );
}
