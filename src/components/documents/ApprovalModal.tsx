'use client';

import { useState } from 'react';

interface ApprovalUser {
  id: string;
  name: string;
  email: string;
  department?: string;
}

interface ApprovalModalProps {
  users: ApprovalUser[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (approverId: string) => void;
}

export function ApprovalModal({ users, submitting, onClose, onSubmit }: ApprovalModalProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" style={{ padding: '28px 32px' }}>
        <h3 className="text-[16px] font-semibold text-[#1B1F2B] mb-5">결재자 선택</h3>

        <input
          type="text"
          placeholder="이름 또는 이메일 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2.5 text-[13px] border border-[#E2E5EA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E6FF2]/30 focus:border-[#2E6FF2]"
        />

        <div className="max-h-[240px] overflow-y-auto border border-[#E2E5EA] rounded-lg" style={{ marginTop: 5, marginBottom: 15 }}>
          {filtered.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedId(u.id)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-[#E2E5EA] last:border-0 transition-colors ${
                selectedId === u.id ? 'bg-[#2E6FF2]/5' : 'hover:bg-[#f9fafb]'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#2E6FF2]/10 flex items-center justify-center text-[12px] font-semibold text-[#2E6FF2] flex-shrink-0">
                {u.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#1B1F2B]">{u.name}</p>
                <p className="text-[11px] text-[#7C8494] truncate">
                  {u.email}{u.department ? ` · ${u.department}` : ''}
                </p>
              </div>
              {selectedId === u.id && (
                <svg className="w-5 h-5 text-[#2E6FF2] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
          {users.length === 0 && (
            <p className="text-center py-6 text-[13px] text-[#7C8494]">사용자가 없습니다.</p>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-[#7C8494] hover:text-[#1B1F2B] transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => selectedId && onSubmit(selectedId)}
            disabled={!selectedId || submitting}
            className="px-5 py-2 text-[13px] font-medium text-white bg-[#2E6FF2] rounded-lg hover:bg-[#1a5ad9] disabled:opacity-40 transition-colors"
          >
            {submitting ? '요청 중...' : '결재 요청'}
          </button>
        </div>
      </div>
    </div>
  );
}
