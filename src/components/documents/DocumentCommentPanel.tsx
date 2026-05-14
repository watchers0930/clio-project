'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui';
import { X, Trash2, Send, MessageSquare } from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils/format';
import { CommentReflectModal } from './CommentReflectModal';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_name: string;
  status: 'pending' | 'held' | 'applied';
  applied_at: string | null;
  applied_version_number: number | null;
}

interface DocumentCommentPanelProps {
  documentId: string;
  onClose: () => void;
  onReflected?: () => void;
  /** true면 fixed 포지셔닝 없이 부모 컨테이너를 채움 (뷰어 내부 사이드패널용) */
  inline?: boolean;
  /** 섹션 삽입 모드에서 섹션 목록 파싱에 사용 */
  documentContent?: string;
}

export function DocumentCommentPanel({ documentId, onClose, onReflected, inline = false, documentContent = '' }: DocumentCommentPanelProps) {
  const user = useAuthStore((s) => s.user);
  const toast = useToast();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showReflectModal, setShowReflectModal] = useState(false);
  const actionableSelectedCount = comments.filter((comment) => selected.has(comment.id) && comment.status !== 'applied').length;

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`);
      const data = await res.json();
      if (data.success) setComments(data.comments ?? []);
    } catch {
      toast.error('댓글 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async () => {
    const content = newComment.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => [...prev, data.comment]);
        setNewComment('');
      } else {
        toast.error(data.error ?? '댓글 작성 실패');
      }
    } catch {
      toast.error('서버 오류');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}/comments/${commentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setSelected((prev) => { const s = new Set(prev); s.delete(commentId); return s; });
      } else {
        toast.error(data.error ?? '삭제 실패');
      }
    } catch {
      toast.error('서버 오류');
    }
  };

  const handleStatusChange = async (commentId: string, status: 'pending' | 'held') => {
    try {
      const res = await fetch(`/api/documents/${documentId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => prev.map((comment) => (
          comment.id === commentId
            ? { ...comment, status, applied_at: null, applied_version_number: null }
            : comment
        )));
      } else {
        toast.error(data.error ?? '상태 변경 실패');
      }
    } catch {
      toast.error('서버 오류');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };


  const panelContent = (
    <div className={`flex h-full flex-col bg-white ${inline ? 'border-l border-[#e5e5e7]' : 'border-l border-[#e5e5e7]'}`}>
      {/* 헤더 */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[#e5e5e7] px-4 py-5 sm:px-5 sm:py-6">
        <div className="flex items-center gap-3">
          <MessageSquare size={15} strokeWidth={1.5} className="text-[#2E6FF2]" />
          <span className="text-[14px] font-semibold text-[#1B1F2B]">
            댓글 및 반영 {comments.length > 0 ? `(${comments.length})` : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {actionableSelectedCount > 0 && (
            <button
              onClick={() => setShowReflectModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[#2E6FF2] px-3.5 py-2 text-[11px] font-medium text-white hover:bg-[#1a5ad9] transition-colors"
            >
              반영 ({actionableSelectedCount})
            </button>
          )}
          {!inline && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f5f5f7] transition-colors">
              <X size={15} className="text-[#6e6e73]" />
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-[#e5e5e7] bg-[#fbfbfc] px-4 py-5 sm:px-5">
        <p className="text-[12px] leading-5 text-[#5E6573]">
          문서 검토 의견을 남기고, 필요한 댓글을 선택해 바로 반영할 수 있습니다.
          {actionableSelectedCount > 0 && <span className="font-medium text-[#2E6FF2]"> 현재 반영 대상 {actionableSelectedCount}개 선택됨</span>}
        </p>
      </div>

      {/* 댓글 목록 */}
      <div className="flex-1 overflow-y-auto px-3.5 py-5 sm:px-4.5">
        {loading ? (
          <div className="flex justify-center py-10"><Spinner size="sm" /></div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={28} strokeWidth={1} className="text-[#c7c7cc] mb-2" />
            <p className="text-[12px] text-[#6e6e73]">아직 댓글이 없습니다.</p>
            <p className="text-[11px] text-[#a1a1a6] mt-1">첫 번째 의견을 남겨보세요.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comments.map((c) => {
              const isMine = c.user_id === user?.id;
              const isChecked = selected.has(c.id);
              const statusBadgeClass = c.status === 'applied'
                ? 'bg-[#F4FBF6] text-[#258A4E]'
                : c.status === 'held'
                  ? 'bg-[#FFF8ED] text-[#B06D00]'
                  : 'bg-[#F3F8FF] text-[#2E6FF2]';
              const statusLabel = c.status === 'applied'
                ? `반영됨${c.applied_version_number ? ` · v${c.applied_version_number}` : ''}`
                : c.status === 'held'
                  ? '보류'
                  : '미반영';
              return (
                <div
                  key={c.id}
                  className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 transition-colors cursor-pointer ${
                    isChecked ? 'bg-[#2E6FF2]/6 border border-[#2E6FF2]/20' : 'hover:bg-[#f5f5f7] border border-transparent'
                  }`}
                  onClick={() => toggleSelect(c.id)}
                >
                  {/* 체크박스 */}
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                      isChecked ? 'bg-[#2E6FF2] border-[#2E6FF2]' : 'border-[#c7c7cc]'
                    }`}>
                      {isChecked && (
                        <svg width="7" height="5" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* 아바타 */}
                  <div className="w-6 h-6 rounded-full bg-[#1B1F2B]/10 flex items-center justify-center text-[10px] font-semibold text-[#1B1F2B] flex-shrink-0">
                    {c.user_name.charAt(0)}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold text-[#1B1F2B]">{c.user_name}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-[#a1a1a6]">{formatTimeAgo(c.created_at)}</span>
                        {isMine && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                            className="p-0.5 rounded hover:bg-[#ff3b30]/10 transition-colors"
                            title="삭제"
                          >
                            <Trash2 size={11} className="text-[#ff3b30]" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[12px] text-[#3a3a3c] leading-relaxed break-words">{c.content}</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {c.status !== 'applied' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(c.id, c.status === 'held' ? 'pending' : 'held'); }}
                          className="rounded-lg border border-[#e5e5e7] px-2.5 py-1.5 text-[10px] font-medium text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
                        >
                          {c.status === 'held' ? '다시 검토' : '보류'}
                        </button>
                      )}
                      {c.status === 'applied' && c.applied_at && (
                        <span className="text-[10px] text-[#7C8494]">
                          {formatTimeAgo(c.applied_at)} 반영
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 댓글 입력 */}
      <div className="flex-shrink-0 border-t border-[#e5e5e7] px-3.5 py-5 sm:px-4.5">
        <div className="flex gap-3 items-end">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder="댓글 입력... (Enter 등록)"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-[#e5e5e7] px-4 py-3 text-[12px] text-[#1B1F2B] placeholder:text-[#a1a1a6] focus:outline-none focus:border-[#2E6FF2] transition-colors"
            style={{ fontFamily: 'inherit' }}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#2E6FF2] hover:bg-[#1a5ad9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Spinner size="sm" /> : <Send size={13} className="text-white" />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {inline ? (
        panelContent
      ) : (
        <div
          className="fixed right-0 top-0 z-40 h-full w-full sm:w-[360px]"
          style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.06)' }}
        >
          {panelContent}
        </div>
      )}

      {/* 반영 모달 */}
      {showReflectModal && (
        <CommentReflectModal
          documentId={documentId}
          selectedComments={comments
            .filter((c) => selected.has(c.id) && c.status !== 'applied')
            .map((c) => ({ id: c.id, content: c.content, userName: c.user_name }))}
          documentContent={documentContent}
          onClose={() => setShowReflectModal(false)}
          onReflected={() => {
            setSelected(new Set());
            onReflected?.();
          }}
        />
      )}
    </>
  );
}
