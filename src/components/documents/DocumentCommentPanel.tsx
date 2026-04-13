'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui';
import { X, Trash2, Send, MessageSquare } from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils/format';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_name: string;
}

interface DocumentCommentPanelProps {
  documentId: string;
  onClose: () => void;
  onReflected?: () => void;
  /** true면 fixed 포지셔닝 없이 부모 컨테이너를 채움 (뷰어 내부 사이드패널용) */
  inline?: boolean;
}

export function DocumentCommentPanel({ documentId, onClose, onReflected, inline = false }: DocumentCommentPanelProps) {
  const user = useAuthStore((s) => s.user);
  const toast = useToast();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showReflectConfirm, setShowReflectConfirm] = useState(false);
  const [reflecting, setReflecting] = useState(false);

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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const handleReflect = async () => {
    if (selected.size === 0 || reflecting) return;
    setReflecting(true);
    setShowReflectConfirm(false);
    try {
      const res = await fetch(`/api/documents/${documentId}/reflect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedCommentIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('댓글이 문서에 반영되었습니다. 이전 버전이 저장되었습니다.');
        setSelected(new Set());
        onReflected?.();
      } else {
        toast.error(data.error ?? '반영 실패');
      }
    } catch {
      toast.error('서버 오류');
    } finally {
      setReflecting(false);
    }
  };

  const panelContent = (
    <div className={`bg-white flex flex-col h-full ${inline ? 'border-l border-[#e5e5e7]' : 'border-l border-[#e5e5e7]'}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5e7] flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={15} strokeWidth={1.5} className="text-[#2E6FF2]" />
          <span className="text-[14px] font-semibold text-[#1B1F2B]">
            댓글 {comments.length > 0 ? `(${comments.length})` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={() => setShowReflectConfirm(true)}
              disabled={reflecting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2E6FF2] text-white text-[11px] font-medium hover:bg-[#1a5ad9] disabled:opacity-50 transition-colors"
            >
              {reflecting && <Spinner size="sm" />}
              반영 ({selected.size})
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-colors">
            <X size={15} className="text-[#6e6e73]" />
          </button>
        </div>
      </div>

      {/* 댓글 목록 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <div className="flex justify-center py-10"><Spinner size="sm" /></div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={28} strokeWidth={1} className="text-[#c7c7cc] mb-2" />
            <p className="text-[12px] text-[#6e6e73]">아직 댓글이 없습니다.</p>
            <p className="text-[11px] text-[#a1a1a6] mt-1">첫 번째 의견을 남겨보세요.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {comments.map((c) => {
              const isMine = c.user_id === user?.id;
              const isChecked = selected.has(c.id);
              return (
                <div
                  key={c.id}
                  className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors cursor-pointer ${
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
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[11px] font-semibold text-[#1B1F2B]">{c.user_name}</span>
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 댓글 입력 */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-[#e5e5e7]">
        <div className="flex gap-2 items-end">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder="댓글 입력... (Enter 등록)"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-[#e5e5e7] px-3 py-2 text-[12px] text-[#1B1F2B] placeholder:text-[#a1a1a6] focus:outline-none focus:border-[#2E6FF2] transition-colors"
            style={{ fontFamily: 'inherit' }}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#2E6FF2] flex items-center justify-center hover:bg-[#1a5ad9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
          className="fixed top-0 right-0 h-full z-40"
          style={{ width: 360, boxShadow: '-4px 0 24px rgba(0,0,0,0.06)' }}
        >
          {panelContent}
        </div>
      )}

      {/* 반영 확인 모달 (항상 fixed z-[70]) */}
      {showReflectConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-[400px] overflow-hidden">
            <div className="px-8 py-6 border-b border-[#e5e5e7]">
              <h3 className="text-[17px] font-semibold text-[#1B1F2B]">댓글 반영 확인</h3>
            </div>
            <div className="px-8 py-6">
              <p className="text-[14px] text-[#3a3a3c] leading-relaxed">
                선택된 댓글 <strong>{selected.size}개</strong>를 반영하여 문서를 재생성합니다.
              </p>
              <ul className="mt-3 text-[13px] text-[#6e6e73] space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E6FF2] flex-shrink-0" />
                  현재 문서는 이전 버전으로 자동 저장됩니다.
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E6FF2] flex-shrink-0" />
                  재생성에는 약 10~30초가 소요됩니다.
                </li>
              </ul>
            </div>
            <div className="px-8 py-4 border-t border-[#e5e5e7] flex justify-end gap-3">
              <button
                onClick={() => setShowReflectConfirm(false)}
                className="px-5 py-2.5 rounded-xl border border-[#e5e5e7] text-sm text-[#6e6e73] hover:bg-[#f5f5f7] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleReflect}
                className="px-5 py-2.5 rounded-xl bg-[#2E6FF2] text-white text-sm font-medium hover:bg-[#1a5ad9] transition-colors"
              >
                반영하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
