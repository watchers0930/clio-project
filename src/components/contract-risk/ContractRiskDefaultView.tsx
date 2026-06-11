'use client';

import { useState, useCallback, useRef } from 'react';
import { ArrowLeft, Download, ShieldCheck, ArrowRight, Scale, ChevronDown } from 'lucide-react';
import { RiskSummary } from '@/components/contract-risk/RiskSummary';
import { RiskFilter } from '@/components/contract-risk/RiskFilter';
import { RiskCard } from '@/components/contract-risk/RiskCard';
import { CONTRACT_TYPE_LABELS, PERSPECTIVE_LABELS } from '@/lib/contract-risk-items';
import type { ContractRiskAnalysis, RiskFilterState, RiskItem } from '@/lib/types/contract-risk';

interface Props {
  analysis: ContractRiskAnalysis;
  total: number;
  filter: RiskFilterState;
  onFilterChange: (f: RiskFilterState) => void;
  counts: { all: number; high: number; medium: number; low: number; unfavorable: number; missing: number; ambiguous: number };
  sortedItems: RiskItem[];
  downloading: boolean;
  onDownload: (format?: 'docx' | 'pdf') => void;
  onEnterSuggestMode: () => void;
  canApplySuggestions: boolean;
  onNavigate: (path: string) => void;
}

export function ContractRiskDefaultView({
  analysis,
  total,
  filter,
  onFilterChange,
  counts,
  sortedItems,
  downloading,
  onDownload,
  onEnterSuggestMode,
  canApplySuggestions,
  onNavigate,
}: Props) {
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const [expandVersion, setExpandVersion] = useState(0);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  const handleToggleExpandAll = useCallback(() => {
    setIsAllExpanded(v => !v);
    setExpandVersion(v => v + 1);
  }, []);

  const expandOverride = { expanded: isAllExpanded, version: expandVersion };

  return (
    <div className="min-h-full bg-surface-secondary">

      {/* 상단 헤더 바 */}
      <div className="bg-white border-b border-border sticky top-0 z-20">
        <div className="mx-auto flex h-auto max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:h-[68px] sm:px-6 sm:py-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              onClick={() => onNavigate('/contract-risk')}
              className="flex items-center gap-2 text-[12px] text-foreground-quaternary hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft size={14} /> 목록
            </button>
            <span className="text-border">/</span>
            <p className="text-[13px] font-medium text-foreground truncate">{analysis.file_name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
            {total > 0 && canApplySuggestions && (
              <button
                onClick={onEnterSuggestMode}
                className="flex items-center gap-2 px-4 py-2.5 border border-primary text-primary rounded-xl text-[12px] font-medium hover:bg-primary/5 transition-colors"
              >
                <Scale size={13} /> 조항 수정 제안
              </button>
            )}
            <div className="relative" ref={downloadRef}>
              <button
                onClick={() => setDownloadOpen(v => !v)}
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2.5 bg-foreground text-white rounded-xl text-[12px] font-medium hover:bg-sidebar-hover transition-colors disabled:opacity-50"
              >
                <Download size={13} />
                {downloading ? '다운로드 중...' : '리포트'}
                <ChevronDown size={11} />
              </button>
              {downloadOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 w-40 rounded-xl border border-border bg-white shadow-lg overflow-hidden">
                  <button
                    onClick={() => { onDownload('docx'); setDownloadOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-[12px] text-foreground hover:bg-surface-secondary transition-colors"
                  >
                    DOCX 리포트
                  </button>
                  <button
                    onClick={() => { onDownload('pdf'); setDownloadOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-[12px] text-foreground hover:bg-surface-secondary transition-colors"
                  >
                    PDF 리포트 (인쇄용)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-7">
        <div className="rounded-2xl border border-border bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Next Workflow</p>
              <p className="text-[15px] font-semibold text-foreground mt-2">리스크 검토 후 바로 이어서 작업할 수 있습니다</p>
              <p className="text-[12px] text-foreground-quaternary mt-2">분석 결과를 바탕으로 수정 제안, 문서 정리, 파일 재확인까지 한 흐름으로 연결합니다.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {total > 0 && canApplySuggestions && (
                <button
                  onClick={onEnterSuggestMode}
                  className="px-4 py-2.5 rounded-xl bg-foreground text-white text-[12px] font-medium hover:bg-sidebar-hover transition-colors"
                >
                  수정 제안 시작
                </button>
              )}
              <button
                onClick={() => onNavigate('/documents')}
                className="px-4 py-2.5 rounded-xl border border-border text-[12px] font-medium text-foreground-secondary hover:bg-surface-secondary transition-colors"
              >
                문서 생성으로 이동
              </button>
              <button
                onClick={() => onNavigate('/files')}
                className="px-4 py-2.5 rounded-xl border border-border text-[12px] font-medium text-foreground-secondary hover:bg-surface-secondary transition-colors"
              >
                문서허브 보기
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-5">
            <div className="rounded-xl border border-border bg-surface-tertiary p-5">
              <p className="text-[13px] font-semibold text-foreground">1. 리스크 확인</p>
              <p className="text-[11px] text-foreground-quaternary mt-1">상/중/하 위험도를 먼저 확인하고 우선순위를 정합니다.</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-tertiary p-5">
              <p className="text-[13px] font-semibold text-foreground">2. 수정 제안 반영</p>
              <p className="text-[11px] text-foreground-quaternary mt-1">필요한 조항만 골라 법령 기반 수정안으로 이어갑니다.</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-tertiary p-5">
              <p className="text-[13px] font-semibold text-foreground">3. 문서 워크플로우로 이동</p>
              <p className="text-[11px] text-foreground-quaternary mt-1">검토가 끝나면 문서 생성 또는 문서허브에서 후속 작업을 진행합니다.</p>
            </div>
          </div>
        </div>

        {/* 요약 */}
        <RiskSummary
          riskCount={analysis.risk_count}
          fileName={analysis.file_name}
          contractTypeLabel={CONTRACT_TYPE_LABELS[analysis.contract_type] ?? analysis.contract_type}
          perspectiveLabel={PERSPECTIVE_LABELS[analysis.perspective] ?? analysis.perspective}
          createdAt={analysis.created_at}
        />

        {/* AI 종합 의견 */}
        {analysis.risk_result.summary && (
          <div className="rounded-2xl border border-border bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="w-6 h-6 bg-primary-tint rounded-lg flex items-center justify-center">
                <ShieldCheck size={13} className="text-primary" />
              </div>
              <p className="text-[12px] font-semibold text-primary uppercase tracking-wide">AI 종합 의견</p>
            </div>
            <p className="text-[13px] text-foreground leading-relaxed">{analysis.risk_result.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {total > 0 && canApplySuggestions && (
                <button
                  onClick={onEnterSuggestMode}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary transition-colors"
                >
                  조항 수정 제안으로 이동 <ArrowRight size={13} />
                </button>
              )}
              <button
                onClick={() => onNavigate('/documents')}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground-secondary hover:text-foreground transition-colors"
              >
                문서 생성으로 넘기기 <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* 탐지 항목 없음 */}
        {total === 0 && (
          <div className="rounded-2xl border border-border bg-white p-6 text-center sm:p-10">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={24} className="text-emerald-600" />
            </div>
            <p className="text-[16px] font-bold text-emerald-800 mb-1">리스크가 탐지되지 않았습니다</p>
            <p className="text-[13px] text-emerald-700">분석한 25개 항목에서 리스크가 발견되지 않았습니다.</p>
          </div>
        )}

        {/* 필터 + 항목 목록 */}
        {counts.all > 0 && (
          <>
            <RiskFilter
              filter={filter}
              onChange={onFilterChange}
              counts={counts}
              isAllExpanded={isAllExpanded}
              onToggleExpandAll={handleToggleExpandAll}
            />

            <div className="flex flex-col gap-[10px]">
              {sortedItems.length > 0 ? (
                sortedItems.map(item => <RiskCard key={item.id} item={item} expandOverride={expandOverride} />)
              ) : (
                <div className="rounded-2xl border border-border bg-white py-10 text-center">
                  <p className="text-[13px] text-foreground-quaternary">해당 필터 조건의 항목이 없습니다.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* 면책 */}
        <div className="border-t border-border pt-5 pb-2 text-center">
          <p className="text-[11px] text-foreground-quaternary leading-relaxed">
            ⚠️ 이 분석은 AI가 생성한 참고 자료이며 법적 조언이 아닙니다.<br />
            최종 계약 체결 전 법률 전문가 검토를 권장합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
