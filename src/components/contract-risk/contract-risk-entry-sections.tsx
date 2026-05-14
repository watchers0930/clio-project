'use client';

import { AlertCircle, ArrowRight, FileText, Mic, ShieldCheck, Upload, X } from 'lucide-react';
import { AnalysisHistory } from '@/components/contract-risk/AnalysisHistory';
import { AudioRecorder } from '@/components/common/AudioRecorder';
import { cn } from '@/lib/utils';
import { CONTRACT_TYPES, PERSPECTIVES } from '@/components/contract-risk/contract-risk-entry-config';
import type { ContractType, Perspective } from '@/lib/types/contract-risk';

interface LoadingOverlayProps {
  isTranscribing: boolean;
  isAnalyzing: boolean;
  progressMsg: string;
}

export function ContractRiskLoadingOverlay({ isTranscribing, isAnalyzing, progressMsg }: LoadingOverlayProps) {
  if (!isTranscribing && !isAnalyzing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex min-w-[240px] flex-col items-center gap-5 rounded-2xl bg-white px-10 py-10 shadow-2xl">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full bg-[#EEF3FE]" />
          <ShieldCheck size={28} className="absolute inset-0 m-auto text-[#2E6FF2]" />
          <svg className="absolute inset-0 h-14 w-14 animate-spin text-[#2E6FF2]" fill="none" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="3" strokeDasharray="120 40" strokeLinecap="round" opacity="0.3" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-[#1B1F2B]">{isTranscribing ? '음성 변환 중' : '리스크 분석 중'}</p>
          <p className="mt-1 min-h-[18px] text-[12px] text-[#888] transition-all">
            {isTranscribing ? '음성을 텍스트로 변환하고 있습니다' : (progressMsg || 'GPT-4o가 25개 항목을 검토 중입니다')}
          </p>
        </div>
      </div>
    </div>
  );
}

interface HeroProps {
  sourceHint: string | null;
  onOpenFiles: () => void;
  onOpenDocuments: () => void;
  onSelectUploadMode: () => void;
}

export function ContractRiskHero({ sourceHint, onOpenFiles, onOpenDocuments, onSelectUploadMode }: HeroProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-[#e5e5e7] bg-white">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="px-4 py-5 sm:px-6 sm:py-6 xl:px-[30px] xl:py-[30px]">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0071e3]">Specialized Analysis</p>
            <h1 className="text-[24px] font-bold leading-[1.25] text-[#1d1d1f] sm:text-[28px]">계약서 AI 리스크 분석</h1>
            <p className="max-w-2xl text-[15px] text-[#6e6e73]" style={{ lineHeight: '20px' }}>
              문서허브에서 관리하는 계약 문서를 대상으로 리스크를 분석하고, 수정 제안까지 이어가는 전문 기능입니다.
              계약서 유형과 갑/을 관점을 정한 뒤 결과 화면에서 조항별 검토와 후속 수정 흐름으로 이어집니다.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard label="검토 항목" value={25} />
              <MetricCard label="입력 방식" value={2} />
              <MetricCard label="분석 관점" value={PERSPECTIVES.length} />
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={onOpenFiles} className="inline-flex items-center gap-2 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0071e3]">
                <FileText size={16} />
                문서허브 열기
              </button>
              <button onClick={onOpenDocuments} className="inline-flex items-center gap-2 rounded-xl border border-[#D7E7FF] bg-white px-4 py-2.5 text-sm font-medium text-[#2E6FF2] transition-colors hover:bg-[#F3F8FF]">
                <ArrowRight size={16} />
                문서 생성으로 이동
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-[#e5e5e7] bg-[#fbfbfc] px-4 py-5 sm:px-6 sm:py-6 xl:border-l xl:border-t-0 xl:px-[28px] xl:py-[28px]">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C8494]">Recommended Flow</p>
            <div className="flex flex-col gap-3">
              <QuickAction
                title="1. 문서허브에서 계약 문서를 고릅니다"
                description={sourceHint ? `현재 선택된 문서는 "${sourceHint}"입니다. 계약 후보 문서를 정리한 뒤 분석 대상으로 넘깁니다.` : '계약 후보 문서를 정리한 뒤 분석 대상으로 넘깁니다.'}
                onClick={onOpenFiles}
              />
              <QuickAction
                title="2. 갑/을 관점으로 리스크를 분석합니다"
                description="GPT-4o가 25개 항목을 검토해 상/중/하로 분류하고, 관점에 맞는 수정 포인트를 제안합니다."
                onClick={onSelectUploadMode}
              />
              <QuickAction
                title="3. 수정 제안과 다운로드로 마무리합니다"
                description="결과 화면에서 법령 기반 수정 제안, 리포트 다운로드, 후속 문서 작성까지 이어집니다."
                onClick={onOpenDocuments}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface EntryFormProps {
  inputMode: 'upload' | 'voice';
  dragOver: boolean;
  file: File | null;
  contractType: ContractType;
  perspective: Perspective;
  error: string | null;
  isAnalyzing: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSetInputMode: (mode: 'upload' | 'voice') => void;
  onSetError: (message: string | null) => void;
  onSetDragOver: (value: boolean) => void;
  onClearFile: () => void;
  onFileSelect: (file: File) => void;
  onDrop: (e: React.DragEvent) => void;
  onSetContractType: (value: ContractType) => void;
  onSetPerspective: (value: Perspective) => void;
  onSubmit: () => void;
  onRecordingComplete: (blob: Blob) => Promise<void>;
}

export function ContractRiskEntryForm(props: EntryFormProps) {
  const {
    inputMode,
    dragOver,
    file,
    contractType,
    perspective,
    error,
    isAnalyzing,
    inputRef,
    onSetInputMode,
    onSetError,
    onSetDragOver,
    onClearFile,
    onFileSelect,
    onDrop,
    onSetContractType,
    onSetPerspective,
    onSubmit,
    onRecordingComplete,
  } = props;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-[#E2E5EA] bg-white">
        <div className="flex border-b border-[#E2E5EA]">
          <button
            onClick={() => { onSetInputMode('upload'); onSetError(null); }}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 border-b-2 -mb-px py-3.5 text-[13px] font-medium transition-colors',
              inputMode === 'upload' ? 'border-[#2E6FF2] bg-white text-[#2E6FF2]' : 'border-transparent bg-[#FAFBFC] text-[#888] hover:text-[#1B1F2B]',
            )}
          >
            <Upload size={14} />
            파일 업로드
          </button>
          <button
            onClick={() => { onSetInputMode('voice'); onSetError(null); }}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 border-b-2 -mb-px py-3.5 text-[13px] font-medium transition-colors',
              inputMode === 'voice' ? 'border-[#2E6FF2] bg-white text-[#2E6FF2]' : 'border-transparent bg-[#FAFBFC] text-[#888] hover:text-[#1B1F2B]',
            )}
          >
            <Mic size={14} />
            음성 녹음
          </button>
        </div>

        {inputMode === 'upload' ? (
          <div className="p-4 sm:p-5">
            <div
              className={cn(
                'relative cursor-pointer rounded-xl border-2 border-dashed transition-all',
                dragOver ? 'border-[#2E6FF2] bg-[#EEF3FE]' : file ? 'border-[#2E6FF2]/40 bg-[#F7F9FF]' : 'border-[#E2E5EA] hover:border-[#2E6FF2]/60 hover:bg-[#FAFBFF]',
              )}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); onSetDragOver(true); }}
              onDragLeave={() => onSetDragOver(false)}
              onDrop={onDrop}
            >
              {file ? (
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF3FE] shrink-0">
                    <FileText size={16} className="text-[#2E6FF2]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[#1B1F2B]">{file.name}</p>
                    <p className="mt-0.5 text-[11px] text-[#888]">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onClearFile(); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#ccc] transition-colors hover:bg-red-50 hover:text-red-500 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2.5 px-5 py-8">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0F2F5]">
                    <Upload size={20} className="text-[#aaa]" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-[#555]">파일을 끌어다 놓거나 클릭하여 선택</p>
                    <p className="mt-0.5 text-[11px] text-[#bbb]">DOCX · HWPX · HWP · PDF · 최대 20MB</p>
                  </div>
                </div>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".docx,.hwpx,.hwp,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <p className="mb-4 text-[12px] text-[#888]">계약 협의 내용을 녹음하면 음성을 텍스트로 변환한 뒤 바로 리스크 분석을 실행합니다.</p>
            <AudioRecorder onComplete={onRecordingComplete} onSwitchToUpload={() => { onSetInputMode('upload'); onSetError(null); }} />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#E2E5EA] bg-white p-4 sm:p-5">
        <div className="mb-5">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#888]">계약서 유형</p>
          <div className="grid grid-cols-2 gap-2">
            {CONTRACT_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => onSetContractType(ct.value)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all',
                  contractType === ct.value ? 'border-[#2E6FF2] bg-[#EEF3FE]' : 'border-[#E2E5EA] hover:border-[#2E6FF2]/50 hover:bg-[#FAFBFF]',
                )}
              >
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors', contractType === ct.value ? 'bg-[#2E6FF2]' : 'bg-[#F0F2F5]')}>
                  <ct.Icon size={15} className={contractType === ct.value ? 'text-white' : 'text-[#888]'} />
                </div>
                <div className="min-w-0">
                  <p className={cn('text-[13px] font-semibold leading-tight', contractType === ct.value ? 'text-[#2E6FF2]' : 'text-[#1B1F2B]')}>{ct.label}</p>
                  <p className="text-[11px] text-[#aaa]">{ct.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 border-t border-[#F0F2F5]" />

        <div>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#888]">분석 입장</p>
          <div className="grid grid-cols-2 gap-2">
            {PERSPECTIVES.map((p) => (
              <button
                key={p.value}
                onClick={() => onSetPerspective(p.value)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all',
                  perspective === p.value ? 'border-[#2E6FF2] bg-[#EEF3FE]' : 'border-[#E2E5EA] hover:border-[#2E6FF2]/50 hover:bg-[#FAFBFF]',
                )}
              >
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors', perspective === p.value ? 'bg-[#2E6FF2]' : 'bg-[#F0F2F5]')}>
                  <p.Icon size={15} className={perspective === p.value ? 'text-white' : 'text-[#888]'} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn('text-[13px] font-semibold leading-tight', perspective === p.value ? 'text-[#2E6FF2]' : 'text-[#1B1F2B]')}>{p.value === 'seller_side' ? '을' : '갑'}</p>
                    {p.badge ? <span className="rounded-full bg-[#2E6FF2] px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">{p.badge}</span> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#888]">{p.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-[12px] leading-relaxed text-red-700">{error}</p>
        </div>
      ) : null}

      {inputMode === 'upload' ? (
        <button
          onClick={onSubmit}
          disabled={!file || isAnalyzing}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold transition-all',
            file && !isAnalyzing ? 'bg-[#2E6FF2] text-white shadow-sm hover:bg-[#1E5FE2] hover:shadow-md' : 'cursor-not-allowed bg-[#E8EAED] text-[#bbb]',
          )}
        >
          {isAnalyzing ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              AI 분석 중 (최대 60초)...
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              리스크 분석 시작
            </>
          )}
        </button>
      ) : null}

      <p className="text-center text-[11px] leading-relaxed text-[#c0c4cc]">⚠️ 이 분석은 AI 참고 자료이며 법적 조언이 아닙니다. 최종 계약 체결 전 법률 전문가 검토를 권장합니다.</p>
    </div>
  );
}

export function ContractRiskHistoryPanel() {
  return (
    <div className="lg:sticky lg:top-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-[#1B1F2B]">분석 이력</h2>
          <p className="mt-1 text-[11px] text-[#888]">이전 계약 검토 결과를 열어 수정 제안과 리포트 다운로드로 이어갈 수 있습니다.</p>
        </div>
      </div>
      <AnalysisHistory />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E2E5EA] bg-[#f8f8fa] px-4 py-3.5">
      <p className="text-[12px] text-[#6e6e73]">{label}</p>
      <p className="mt-1 font-num text-[20px] font-bold text-[#1d1d1f]">{value}</p>
    </div>
  );
}

function QuickAction({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-[#E2E5EA] bg-white px-4 py-3.5 text-left transition-colors hover:border-[#0071e3]/35">
      <p className="text-[14px] font-semibold text-[#1d1d1f]">{title}</p>
      <p className="mt-1 text-[12px] leading-5 text-[#6e6e73]">{description}</p>
    </button>
  );
}
