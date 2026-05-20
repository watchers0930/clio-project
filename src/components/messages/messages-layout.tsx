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
    <div className="absolute top-4 left-[352px] right-4 z-10 hidden xl:flex items-center justify-between gap-3 rounded-2xl border border-border bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
      <p className="text-[12px] text-foreground-secondary">메시지는 문서 공유와 코멘트 반영을 보조하는 협업 기능입니다.</p>
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/files" className="rounded-lg bg-surface-secondary px-3.5 py-2 text-[11px] font-medium text-foreground hover:bg-primary-tint hover:text-primary transition-colors">문서허브</Link>
        <Link href="/search" className="rounded-lg bg-surface-secondary px-3.5 py-2 text-[11px] font-medium text-foreground hover:bg-primary-tint hover:text-primary transition-colors">AI 검색</Link>
        <Link href="/documents" className="rounded-lg bg-surface-secondary px-3.5 py-2 text-[11px] font-medium text-foreground hover:bg-primary-tint hover:text-primary transition-colors">문서 생성</Link>
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
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-[86vw] max-w-[320px] shrink-0 flex-col overflow-hidden rounded-r-2xl border-r border-border bg-white shadow-xl transition-transform duration-300 ease-out lg:relative lg:w-80 lg:max-w-none lg:translate-x-0 lg:rounded-2xl lg:border lg:shadow-sm ${showSidebar ? 'translate-x-0' : '-translate-x-full'} lg:!transform-none`}
      >
        {currentUser && (
          <div className="px-4 pt-5 pb-3 flex items-center gap-3 border-b border-border">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-white">{currentUser.name.charAt(0)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{currentUser.name}</p>
              <p className="text-xs text-foreground-secondary truncate">{currentUser.email}</p>
            </div>
            <button onClick={onCloseSidebar} className="p-1.5 rounded-lg hover:bg-surface-secondary text-foreground-secondary transition-colors lg:hidden shrink-0">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wide">조직</p>
          </div>

          {deptTree.map((dept) => (
            <div key={dept.id}>
              <button onClick={() => onToggleDept(dept.id)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-surface-secondary transition-colors">
                {expandedDepts.has(dept.id) ? <ChevronDown size={14} className="text-foreground-secondary" /> : <ChevronRight size={14} className="text-foreground-secondary" />}
                <Building2 size={14} className="text-primary" />
                <span className="text-sm font-medium text-foreground">{dept.name}</span>
                <span className="text-xs text-foreground-quaternary ml-auto">{dept.members.length}</span>
              </button>
              {expandedDepts.has(dept.id) && dept.members.map((member) => {
                const isMe = member.id === currentUser?.id;
                return (
                  <button
                    key={member.id}
                    onClick={() => !isMe && onOpenDm(member.id)}
                    className={`flex w-full items-center gap-3 py-3 pl-10 pr-4 text-left transition-colors ${isMe ? 'cursor-default' : 'hover:bg-surface-secondary'}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isMe ? 'bg-primary' : 'bg-foreground'}`}>
                      <span className="text-xs font-medium text-white">{member.name.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{member.name}{isMe && <span className="text-primary ml-1 text-xs">(나)</span>}</p>
                      <p className="text-[10px] text-foreground-quaternary truncate">{member.email}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}

          {unassigned.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-3">
                <User size={14} className="text-foreground-quaternary" />
                <span className="text-sm font-medium text-foreground-secondary">미배정</span>
              </div>
              {unassigned.map((member) => (
                <button key={member.id} onClick={() => onOpenDm(member.id)} className="flex w-full items-center gap-2.5 py-2.5 pl-10 pr-4 text-left hover:bg-surface-secondary transition-colors">
                  <div className="w-7 h-7 rounded-full bg-foreground-secondary flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium text-white">{member.name.charAt(0)}</span>
                  </div>
                  <p className="text-sm text-foreground truncate">{member.name}</p>
                </button>
              ))}
            </div>
          )}

          {dmChannels.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-1">
                <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wide">이전 대화 목록</p>
              </div>
              {dmChannels.map((channel) => (
                <div key={channel.id} className={`group w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-secondary transition-colors ${activeChannel === channel.id ? 'bg-surface-secondary border-l-2 border-primary' : ''}`}>
                  <button onClick={() => onOpenChannel(channel.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-white">{channel.avatar}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${channel.unread > 0 ? 'font-semibold' : 'font-medium'} text-foreground`}>{channel.name}</span>
                        {channel.unread > 0 && <span className="ml-2 w-5 h-5 rounded-full bg-danger text-white text-xs flex items-center justify-center shrink-0 font-num">{channel.unread}</span>}
                      </div>
                      {channel.lastMessage && <p className="text-xs text-foreground-secondary truncate">{channel.lastMessage}</p>}
                    </div>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteChannel(channel.id); }} className="p-1 rounded-lg text-transparent group-hover:text-foreground-quaternary hover:!text-danger hover:bg-red-50 transition-all shrink-0">
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
    <main className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      {!activeChannel ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6" style={{ marginTop: -30 }}>
          <MessageCircle size={32} className="text-border" style={{ marginBottom: 20 }} />
          <h3 className="text-lg font-semibold text-foreground" style={{ marginBottom: 20 }}>대화를 선택하세요</h3>
          <p className="text-sm text-foreground-secondary" style={{ marginBottom: 20 }}>왼쪽 조직도에서 대화할 사람을 클릭하세요.</p>
          <button onClick={onOpenSidebar} className="px-4 py-2.5 rounded-xl bg-foreground text-white text-sm font-medium lg:hidden hover:bg-primary transition-colors">
            조직도 보기
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
            <button onClick={onOpenSidebar} className="p-1 rounded-lg hover:bg-surface-secondary text-foreground-secondary lg:hidden"><Search size={20} /></button>
            <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center"><span className="text-xs font-medium text-white">{activeChannelData?.avatar ?? '?'}</span></div>
            <div>
              <h3 className="font-semibold text-foreground">{activeChannelData?.name}</h3>
              <p className="text-xs text-foreground-secondary">{activeChannelData?.type === 'department' ? '부서 채널' : '다이렉트 메시지'}</p>
            </div>
          </div>

          <div className="border-b border-border bg-surface-tertiary px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-secondary">Document Collaboration</p>
              <p className="text-[12px] leading-5 text-foreground-secondary">
                이 대화는 독립 채팅이 아니라 문서 공유와 피드백 반영을 위한 협업 공간입니다.
              </p>
              <div className="flex flex-wrap gap-2">
              <button onClick={onSearchDocuments} className="rounded-lg border border-border-tint bg-white px-3.5 py-2.5 text-[12px] font-medium text-primary hover:bg-primary-tint transition-colors">
                관련 문서 검색
              </button>
              <button onClick={onOpenDocumentContext} className="rounded-lg border border-success/30 bg-white px-3.5 py-2.5 text-[12px] font-medium text-success hover:bg-success/5 transition-colors">
                대화 요약 문서 작성
              </button>
              <button onClick={onOpenFileHub} className="rounded-lg border border-border bg-white px-3.5 py-2.5 text-[12px] font-medium text-foreground-secondary hover:bg-surface-secondary transition-colors">
                문서허브 열기
              </button>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {messages.length === 0 && <p className="text-center text-sm text-foreground-secondary py-10">아직 메시지가 없습니다. 첫 메시지를 보내보세요!</p>}
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.isOwn ? 'flex-row-reverse' : ''}`}>
                {!message.isOwn && <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center shrink-0"><span className="text-xs font-medium text-white">{message.avatar}</span></div>}
                <div className={`max-w-[85%] sm:max-w-[72%] ${message.isOwn ? 'items-end' : ''}`}>
                  {!message.isOwn && <p className="text-xs text-foreground-secondary mb-1">{message.sender}</p>}
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${message.isOwn ? 'bg-foreground text-white rounded-tr-md' : 'bg-surface-secondary text-foreground rounded-tl-md'}`}>
                    {message.sharedFile ? (
                      <>
                        <p className="mb-2">{message.content.replace(/📎\s*/, '')}</p>
                        <button onClick={() => onDownloadSharedFile(message.sharedFile!.id)} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 transition-colors ${message.isOwn ? 'bg-white/10 hover:bg-white/20' : 'bg-white border border-border hover:border-primary hover:bg-blue-50/50'}`}>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${message.isOwn ? 'bg-white/20' : 'bg-primary/10'}`}>
                            <FileText size={18} className={message.isOwn ? 'text-white' : 'text-primary'} />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-xs font-semibold truncate">{message.sharedFile.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Paperclip size={10} className={message.isOwn ? 'text-white/60' : 'text-foreground-secondary'} />
                              <span className={`text-[10px] ${message.isOwn ? 'text-white/60' : 'text-foreground-secondary'}`}>다운로드 · {message.attachment?.size ?? ''}</span>
                            </div>
                          </div>
                          <ChevronRight size={14} className={`shrink-0 ${message.isOwn ? 'text-white/40' : 'text-foreground-quaternary'}`} />
                        </button>
                      </>
                    ) : message.document ? (
                      <>
                        <p className="mb-2">{message.content}</p>
                        <Link
                          href={`/documents/${message.document.id}`}
                          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 transition-colors ${message.isOwn ? 'bg-white/10 hover:bg-white/20' : 'bg-white border border-border hover:border-purple-600 hover:bg-purple-50'}`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${message.isOwn ? 'bg-white/20' : 'bg-purple-600/10'}`}>
                            <FileText size={18} className={message.isOwn ? 'text-white' : 'text-purple-600'} />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-xs font-semibold truncate">{message.document.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] ${message.isOwn ? 'text-white/60' : 'text-foreground-secondary'}`}>
                                문서 열기 · {message.document.status}
                              </span>
                            </div>
                          </div>
                          <ChevronRight size={14} className={`shrink-0 ${message.isOwn ? 'text-white/40' : 'text-foreground-quaternary'}`} />
                        </Link>
                      </>
                    ) : (
                      <>
                        {message.content}
                        {message.attachment && !message.sharedFile && (
                          <div className={`mt-2 flex items-center gap-2 px-3.5 py-2.5 rounded-lg ${message.isOwn ? 'bg-foreground-secondary/30' : 'bg-white border border-border'}`}>
                            <Paperclip size={14} className="shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{message.attachment.name}</p>
                              <p className={`text-xs ${message.isOwn ? 'text-white/70' : 'text-foreground-secondary'}`}>{message.attachment.size}</p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <p className={`text-xs text-foreground-secondary mt-1 ${message.isOwn ? 'text-right' : ''}`}>{message.time}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border px-4 py-4">
            <div className="flex items-end gap-2.5">
              <button onClick={onOpenAttach} disabled={uploading} className="p-2.5 rounded-xl hover:bg-surface-secondary text-foreground-secondary transition-colors shrink-0 disabled:opacity-40" title="파일 첨부">
                {uploading ? <Spinner size="sm" /> : <Paperclip size={20} />}
              </button>
              <button onClick={onOpenShareModal} className="p-2.5 rounded-xl hover:bg-surface-secondary text-foreground-secondary transition-colors shrink-0" title="파일함에서 공유"><FolderOpen size={20} /></button>
              <input value={input} onChange={(e) => onInputChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSendMessage(); } }} placeholder="메시지를 입력하세요..." className="min-w-0 flex-1 rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary" />
              <button onClick={onSendMessage} disabled={!input.trim() || uploading} className="p-3 rounded-xl bg-foreground text-white hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"><Send size={20} /></button>
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
      className="absolute right-5 bottom-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 lg:hidden active:scale-95 transition-transform"
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-8 py-7 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">파일 공유</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-secondary text-foreground-secondary"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <p className="text-xs text-foreground-secondary mb-5">내 파일함에서 공유할 파일을 선택하세요. 파일은 이동되지 않고 읽기 권한만 부여됩니다.</p>
          {filesLoading ? (
            <div className="py-8 text-center text-sm text-foreground-secondary">파일 목록 불러오는 중...</div>
          ) : myFiles.length === 0 ? (
            <div className="py-8 text-center text-sm text-foreground-secondary">업로드한 파일이 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {myFiles.map((file) => (
                <button key={file.id} onClick={() => onSelectFile(file.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${selectedFileId === file.id ? 'bg-primary/10 border border-primary ring-1 ring-primary/30' : 'hover:bg-surface-secondary border border-transparent'}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${selectedFileId === file.id ? 'bg-primary' : 'bg-surface-secondary'}`}>
                    <FileText size={16} className={selectedFileId === file.id ? 'text-white' : 'text-foreground-secondary'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-foreground-secondary">{file.type} · {file.size}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-8 py-6 border-t border-border">
          <div className="flex items-center gap-3 mb-5">
            <label className="text-xs text-foreground-secondary">공유 기간</label>
            <select value={expiresInDays} onChange={(e) => onChangeExpires(Number(e.target.value))} className="ml-auto px-3.5 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary">
              <option value={1}>1일</option>
              <option value={3}>3일</option>
              <option value={7}>7일</option>
              <option value={14}>14일</option>
              <option value={30}>30일</option>
              <option value={90}>90일</option>
            </select>
          </div>
          <button onClick={onShare} disabled={!selectedFileId || sharing} className="w-full py-3 rounded-xl bg-foreground text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-8 py-7 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={18} className="text-primary shrink-0" />
            <h3 className="text-base font-semibold text-foreground truncate">{viewingFile.name}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-secondary text-foreground-secondary"><X size={18} /></button>
        </div>
        <div className="px-8 py-7">
          {fileViewLoading ? (
            <p className="text-sm text-foreground-secondary text-center py-6">파일 정보를 불러오는 중...</p>
          ) : (
            <pre className="text-sm text-foreground whitespace-pre-wrap bg-surface-secondary rounded-xl px-4 py-4 leading-relaxed">{viewingFile.content}</pre>
          )}
        </div>
        <div className="px-8 py-6 border-t border-border">
          <button onClick={() => onOpenInFiles(viewingFile.id)} className="w-full py-3 rounded-xl bg-surface-secondary text-foreground text-sm font-medium hover:bg-border transition-colors">
            파일함에서 열기
          </button>
        </div>
      </div>
    </div>
  );
}
