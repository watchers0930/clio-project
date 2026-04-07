'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Clock, CheckCircle, XCircle, Send, Loader2, MessageSquare } from 'lucide-react';

/* ────────────────────────── types ────────────────────────── */
interface PendingApproval {
  id: string;
  documentId: string;
  documentTitle: string;
  documentCreatedAt: string;
  requester: { id: string; name: string; email: string; department: string } | null;
  status: string;
  requestedAt: string;
}

interface MyRequest {
  id: string;
  documentId: string;
  documentTitle: string;
  documentStatus: string;
  approver: { id: string; name: string; email: string } | null;
  status: string;
  comment: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'text-[#ff9f0a] bg-[#ff9f0a]/10' },
  approved: { label: '승인', color: 'text-[#30d158] bg-[#30d158]/10' },
  rejected: { label: '반려', color: 'text-[#ff3b30] bg-[#ff3b30]/10' },
};

/* ────────────────────────── page ─────────────────────────── */
export default function ApprovalsPage() {
  const [tab, setTab] = useState<'pending' | 'my-requests'>('pending');
  const [pendingList, setPendingList] = useState<PendingApproval[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // 문서 내용 보기 모달
  const [viewDoc, setViewDoc] = useState<{ id: string; title: string; content: string; status: string; createdAt: string; templateName: string; downloadUrl?: string; isFileBased?: boolean } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // 승인/반려 모달 상태
  const [actionTarget, setActionTarget] = useState<PendingApproval | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/approvals?tab=${tab}`);
      const d = await res.json();
      if (d.success) {
        if (tab === 'pending') setPendingList(d.data);
        else setMyRequests(d.data);
      }
    } catch {}
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDocView = async (docId: string) => {
    setViewLoading(true);
    setViewDoc(null);
    try {
      const res = await fetch(`/api/documents/${docId}`);
      const d = await res.json();
      if (d.success && d.data) {
        // 파일 기반 문서면 다운로드 URL도 가져오기
        let downloadUrl = '';
        const rawContent = d.data.content ?? '';
        const isFileBased = rawContent.startsWith('[') && rawContent.length < 200;
        if (isFileBased) {
          try {
            const dlRes = await fetch(`/api/documents/${docId}/download?format=docx`);
            if (dlRes.ok) {
              const dlData = await dlRes.json();
              downloadUrl = dlData.url ?? dlData.downloadUrl ?? '';
            }
          } catch {}
        }

        setViewDoc({
          id: d.data.id,
          title: d.data.title,
          content: rawContent,
          status: d.data.status,
          createdAt: d.data.created_at?.split('T')[0] ?? '',
          templateName: d.data.template_name ?? '',
          downloadUrl,
          isFileBased,
        });
      } else {
        setViewDoc({ id: docId, title: '(조회 실패)', content: d.error ?? '문서를 불러올 수 없습니다.', status: '', createdAt: '', templateName: '', downloadUrl: '', isFileBased: false });
      }
    } catch {
      setViewDoc({ id: docId, title: '(오류)', content: '서버 오류가 발생했습니다.', status: '', createdAt: '', templateName: '', downloadUrl: '', isFileBased: false });
    }
    setViewLoading(false);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleAction = async () => {
    if (!actionTarget || !actionType) return;
    if (actionType === 'reject' && !actionComment.trim()) return;

    setProcessing(true);
    try {
      const url = `/api/documents/${actionTarget.documentId}/${actionType === 'approve' ? 'approve' : 'reject'}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: actionComment.trim() || undefined }),
      });
      const d = await res.json();
      if (d.success) {
        showToast(actionType === 'approve' ? '승인되었습니다.' : '반려되었습니다.');
        setActionTarget(null);
        setActionType(null);
        setActionComment('');
        fetchData();
      } else {
        showToast(d.error ?? '처리 실패');
      }
    } catch {
      showToast('서버 오류');
    }
    setProcessing(false);
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '방금 전';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return d.toISOString().split('T')[0];
  };

  return (
    <div className="w-full" style={{ maxWidth: '94%', margin: '0 auto', paddingTop: 36, paddingBottom: 40 }}>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-8">
        <ClipboardCheck size={24} className="text-[#2E6FF2]" />
        <h1 className="text-[22px] font-semibold text-[#1B1F2B]">결재함</h1>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-[#f5f5f7] rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 text-[13px] font-medium rounded-md transition-all ${
            tab === 'pending' ? 'bg-white text-[#1B1F2B] shadow-sm' : 'text-[#7C8494] hover:text-[#1B1F2B]'
          }`}
        >
          결재 대기
        </button>
        <button
          onClick={() => setTab('my-requests')}
          className={`px-4 py-2 text-[13px] font-medium rounded-md transition-all ${
            tab === 'my-requests' ? 'bg-white text-[#1B1F2B] shadow-sm' : 'text-[#7C8494] hover:text-[#1B1F2B]'
          }`}
        >
          내 요청
        </button>
      </div>

      {/* 로딩 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-[#7C8494]" size={24} />
        </div>
      ) : tab === 'pending' ? (
        /* ────── 결재 대기 탭 ────── */
        pendingList.length === 0 ? (
          <div className="text-center py-20 text-[#7C8494] text-[14px]">
            <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
            결재 대기 건이 없습니다.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E5EA] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E5EA] bg-[#f9fafb]">
                  <th className="text-left text-[12px] font-medium text-[#7C8494] py-3 px-5">문서명</th>
                  <th className="text-left text-[12px] font-medium text-[#7C8494] py-3 px-5">요청자</th>
                  <th className="text-left text-[12px] font-medium text-[#7C8494] py-3 px-5">부서</th>
                  <th className="text-left text-[12px] font-medium text-[#7C8494] py-3 px-5">요청일</th>
                  <th className="text-right text-[12px] font-medium text-[#7C8494] py-3 px-5">처리</th>
                </tr>
              </thead>
              <tbody>
                {pendingList.map((item) => (
                  <tr key={item.id} className="border-b border-[#E2E5EA] last:border-0 hover:bg-[#f9fafb] transition-colors">
                    <td className="py-3.5 px-5 text-[13px] text-[#1B1F2B] font-medium">
                      <button onClick={() => openDocView(item.documentId)} className="text-[#2E6FF2] hover:underline text-left">
                        {item.documentTitle}
                      </button>
                    </td>
                    <td className="py-3.5 px-5 text-[13px] text-[#7C8494]">{item.requester?.name ?? '-'}</td>
                    <td className="py-3.5 px-5 text-[13px] text-[#7C8494]">{item.requester?.department ?? '-'}</td>
                    <td className="py-3.5 px-5 text-[13px] text-[#7C8494]">{formatDate(item.requestedAt)}</td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setActionTarget(item); setActionType('approve'); setActionComment(''); }}
                          className="px-3 py-1.5 text-[12px] font-medium text-white bg-[#30d158] rounded-lg hover:bg-[#28b84d] transition-colors"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => { setActionTarget(item); setActionType('reject'); setActionComment(''); }}
                          className="px-3 py-1.5 text-[12px] font-medium text-white bg-[#ff3b30] rounded-lg hover:bg-[#e0342b] transition-colors"
                        >
                          반려
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ────── 내 요청 탭 ────── */
        myRequests.length === 0 ? (
          <div className="text-center py-20 text-[#7C8494] text-[14px]">
            <Send size={40} className="mx-auto mb-3 opacity-30" />
            결재 요청 내역이 없습니다.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E5EA] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E5EA] bg-[#f9fafb]">
                  <th className="text-left text-[12px] font-medium text-[#7C8494] py-3 px-5">문서명</th>
                  <th className="text-left text-[12px] font-medium text-[#7C8494] py-3 px-5">결재자</th>
                  <th className="text-left text-[12px] font-medium text-[#7C8494] py-3 px-5">상태</th>
                  <th className="text-left text-[12px] font-medium text-[#7C8494] py-3 px-5">요청일</th>
                  <th className="text-left text-[12px] font-medium text-[#7C8494] py-3 px-5">처리일</th>
                  <th className="text-left text-[12px] font-medium text-[#7C8494] py-3 px-5">비고</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((item) => {
                  const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.pending;
                  return (
                    <tr key={item.id} className="border-b border-[#E2E5EA] last:border-0 hover:bg-[#f9fafb] transition-colors">
                      <td className="py-3.5 px-5 text-[13px] text-[#1B1F2B] font-medium">
                        <button onClick={() => openDocView(item.documentId)} className="text-[#2E6FF2] hover:underline text-left">
                          {item.documentTitle}
                        </button>
                      </td>
                      <td className="py-3.5 px-5 text-[13px] text-[#7C8494]">{item.approver?.name ?? '-'}</td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-[13px] text-[#7C8494]">{formatDate(item.requestedAt)}</td>
                      <td className="py-3.5 px-5 text-[13px] text-[#7C8494]">{item.decidedAt ? formatDate(item.decidedAt) : '-'}</td>
                      <td className="py-3.5 px-5 text-[13px] text-[#7C8494]">
                        {item.comment ? (
                          <span className="flex items-center gap-1">
                            <MessageSquare size={12} />
                            <span className="truncate max-w-[200px]">{item.comment}</span>
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ────── 승인/반려 모달 ────── */}
      {actionTarget && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" style={{ padding: '28px 32px' }}>
            <div className="flex items-center gap-2 mb-4">
              {actionType === 'approve' ? (
                <CheckCircle size={20} className="text-[#30d158]" />
              ) : (
                <XCircle size={20} className="text-[#ff3b30]" />
              )}
              <h3 className="text-[16px] font-semibold text-[#1B1F2B]">
                {actionType === 'approve' ? '문서 승인' : '문서 반려'}
              </h3>
            </div>

            <p className="text-[13px] text-[#7C8494] mb-1">문서명</p>
            <p className="text-[14px] text-[#1B1F2B] font-medium mb-4">{actionTarget.documentTitle}</p>

            <p className="text-[13px] text-[#7C8494] mb-1">요청자</p>
            <p className="text-[14px] text-[#1B1F2B] mb-5">
              {actionTarget.requester?.name ?? '-'}
              {actionTarget.requester?.department ? ` (${actionTarget.requester.department})` : ''}
            </p>

            <div className="mb-5">
              <label className="block text-[13px] text-[#7C8494] mb-1.5">
                {actionType === 'approve' ? '코멘트 (선택)' : '반려 사유 (필수)'}
              </label>
              <textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder={actionType === 'approve' ? '승인 의견을 남겨주세요...' : '반려 사유를 입력해주세요...'}
                className="w-full h-24 px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/30 focus:border-[#2E6FF2] resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setActionTarget(null); setActionType(null); setActionComment(''); }}
                className="px-4 py-2 text-[13px] text-[#7C8494] hover:text-[#1B1F2B] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAction}
                disabled={processing || (actionType === 'reject' && !actionComment.trim())}
                className={`px-5 py-2 text-[13px] font-medium text-white rounded-lg transition-colors disabled:opacity-40 ${
                  actionType === 'approve'
                    ? 'bg-[#30d158] hover:bg-[#28b84d]'
                    : 'bg-[#ff3b30] hover:bg-[#e0342b]'
                }`}
              >
                {processing ? <Loader2 className="animate-spin" size={14} /> : actionType === 'approve' ? '승인' : '반려'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────── 문서 내용 보기 모달 ────── */}
      {(viewDoc || viewLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { if (!viewLoading) setViewDoc(null); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {viewLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-[#7C8494]" size={24} />
              </div>
            ) : viewDoc && (
              <>
                {/* 헤더 */}
                <div className="px-8 py-5 border-b border-[#E2E5EA] flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#1B1F2B]">{viewDoc.title}</h3>
                    <div className="flex gap-3 mt-1 text-[12px] text-[#7C8494]">
                      {viewDoc.templateName && <span>템플릿: {viewDoc.templateName}</span>}
                      <span>{viewDoc.createdAt}</span>
                    </div>
                  </div>
                  <button onClick={() => setViewDoc(null)} className="text-[#7C8494] hover:text-[#1B1F2B] transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                {/* 본문 */}
                <div className="flex-1 overflow-y-auto px-8 py-6">
                  {viewDoc.isFileBased ? (
                    <div className="text-center py-10">
                      <svg className="w-12 h-12 mx-auto mb-3 text-[#7C8494] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      <p className="text-[14px] text-[#1B1F2B] font-medium mb-1">파일로 생성된 문서입니다</p>
                      <p className="text-[12px] text-[#7C8494] mb-4">{viewDoc.content}</p>
                      {viewDoc.downloadUrl ? (
                        <a
                          href={viewDoc.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2E6FF2] text-white text-[13px] font-medium rounded-lg hover:bg-[#1a5ad9] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                          파일 다운로드
                        </a>
                      ) : (
                        <p className="text-[12px] text-[#7C8494]">다운로드 링크를 가져올 수 없습니다.</p>
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-[13px] text-[#1B1F2B] leading-relaxed">
                      {viewDoc.content || '(내용 없음)'}
                    </div>
                  )}
                </div>
                {/* 하단 */}
                <div className="px-8 py-4 border-t border-[#E2E5EA] flex justify-end shrink-0">
                  <button onClick={() => setViewDoc(null)} className="px-5 py-2 text-[13px] text-[#7C8494] hover:text-[#1B1F2B] transition-colors">
                    닫기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-[#1B1F2B] text-white text-[13px] font-medium rounded-xl shadow-lg flex items-center gap-2">
          <CheckCircle size={16} className="text-[#30d158]" />
          {toast}
        </div>
      )}
    </div>
  );
}
