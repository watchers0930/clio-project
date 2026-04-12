'use client';

import { useState, useEffect } from 'react';
import type { QualityCategory } from '@/lib/supabase/types';
import { useQualityCheck } from '@/hooks/useQualityCheck';
import { QualityCheckItemCard } from './QualityCheckItem';

interface QualityCheckPanelProps {
  documentId: string;
  onClose?: () => void;
  autoRequest?: boolean; // 마운트 시 즉시 검수 요청
}

type Tab = 'all' | QualityCategory;

const TABS: { id: Tab; label: string }[] = [
  { id: 'all',      label: '전체' },
  { id: 'spelling', label: '맞춤법' },
  { id: 'format',   label: '공문서 규격' },
  { id: 'logic',    label: '논리 흐름' },
  { id: 'missing',  label: '누락 항목' },
];

function ScoreColor(score: number) {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

function ScoreLabel(score: number) {
  if (score >= 90) return '품질 기준을 충족합니다.';
  if (score >= 70) return '일부 개선이 필요합니다.';
  return '전반적인 검토가 필요합니다.';
}

export function QualityCheckPanel({ documentId, onClose, autoRequest }: QualityCheckPanelProps) {
  const { result, status, errorMessage, requestCheck } = useQualityCheck(documentId);
  const [activeTab, setActiveTab] = useState<Tab>('all');

  // 최초 마운트 시 자동 요청 (캐시 없으면 GPT 호출)
  useEffect(() => {
    if (autoRequest && status === 'idle') {
      requestCheck(false);
    }
  }, [autoRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredItems = result?.items.filter(
    (item) => activeTab === 'all' || item.category === activeTab,
  ) ?? [];

  const countByCategory = (cat: QualityCategory) =>
    result?.items.filter((i) => i.category === cat).length ?? 0;

  return (
    <div className="flex flex-col h-full bg-white border-l border-[#e5e5e7]">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-[#e5e5e7] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#0071e3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-semibold text-[#1d1d1f]">AI 품질 검수</span>
        </div>
        <div className="flex items-center gap-3">
          {result && (
            <span className={`text-lg font-bold ${ScoreColor(result.overall_score)}`}>
              {result.overall_score}점
            </span>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 점수 요약 */}
      {result && (
        <div className="px-5 py-3 bg-[#f9f9fb] border-b border-[#e5e5e7] shrink-0">
          <p className={`text-xs font-medium ${ScoreColor(result.overall_score)}`}>
            {ScoreLabel(result.overall_score)}
          </p>
          {result.summary && (
            <p className="text-xs text-[#6e6e73] mt-1 leading-relaxed">{result.summary}</p>
          )}
        </div>
      )}

      {/* 카테고리 탭 */}
      <div className="px-3 py-2 border-b border-[#e5e5e7] flex gap-1 flex-wrap shrink-0">
        {TABS.map((tab) => {
          const count = tab.id !== 'all' ? countByCategory(tab.id) : (result?.items.length ?? 0);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#1d1d1f] text-white'
                  : 'text-[#6e6e73] hover:bg-[#f5f5f7]'
              }`}
            >
              {tab.label}
              {result && count > 0 && (
                <span className={`ml-1 ${activeTab === tab.id ? 'text-white/70' : 'text-[#0071e3]'}`}>
                  [{count}]
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 로딩 */}
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#6e6e73]">GPT-4o가 문서를 검수하고 있습니다...</p>
          </div>
        )}

        {/* 에러 */}
        {status === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-xs text-red-600">{errorMessage}</p>
          </div>
        )}

        {/* 결과 없음 (idle + 캐시 없음) */}
        {status === 'idle' && !result && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <svg className="w-10 h-10 text-[#d2d2d7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
            <p className="text-xs text-[#6e6e73]">
              아직 검수 결과가 없습니다.<br />
              아래 버튼으로 AI 검수를 요청하세요.
            </p>
          </div>
        )}

        {/* 검수 결과 — 아이템 없음 */}
        {status === 'success' && result && filteredItems.length === 0 && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <p className="text-xs text-green-700">
              {activeTab === 'all'
                ? '문제가 발견되지 않았습니다.'
                : `해당 카테고리에서 문제가 발견되지 않았습니다.`}
            </p>
          </div>
        )}

        {/* 검수 항목 목록 */}
        {filteredItems.map((item, idx) => (
          <QualityCheckItemCard key={idx} item={item} />
        ))}
      </div>

      {/* 하단 액션 */}
      <div className="px-4 py-4 border-t border-[#e5e5e7] shrink-0 space-y-3">
        <p className="text-[10px] text-[#8e8e93] leading-relaxed">
          ※ AI 검수는 참고용입니다. 최종 확인은 담당자가 직접 수행하세요.
        </p>
        <div className="flex gap-2">
          {result && (
            <button
              onClick={() => requestCheck(true)}
              disabled={status === 'loading'}
              className="flex-1 px-3 py-2.5 rounded-xl border border-[#e5e5e7] text-xs text-[#6e6e73] hover:bg-[#f5f5f7] disabled:opacity-40 transition-colors"
            >
              재검수
            </button>
          )}
          <button
            onClick={() => requestCheck(false)}
            disabled={status === 'loading'}
            className="flex-1 px-3 py-2.5 rounded-xl bg-[#0071e3] text-white text-xs font-medium hover:bg-[#0077ed] disabled:opacity-40 transition-colors"
          >
            {status === 'loading' ? '검수 중...' : 'AI 검수 요청'}
          </button>
        </div>
      </div>
    </div>
  );
}
