'use client';

import { AlertCircle, FileText, Mic, ShieldCheck, Upload, X } from 'lucide-react';
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
          <div className="absolute inset-0 rounded-full bg-primary-tint" />
          <ShieldCheck size={28} className="absolute inset-0 m-auto text-primary" />
          <svg className="absolute inset-0 h-14 w-14 animate-spin text-primary" fill="none" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="3" strokeDasharray="120 40" strokeLinecap="round" opacity="0.3" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-foreground">{isTranscribing ? '음성 변환 중' : '리스크 분석 중'}</p>
          <p className="mt-1 min-h-[18px] text-[12px] text-foreground-quaternary transition-all">
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
}

export function ContractRiskHero({ sourceHint, onOpenFiles, onOpenDocuments }: HeroProps) {
  return (
    <section className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-5 px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[20px] font-bold text-foreground">계약서 AI 리스크 분석</h1>
            <p className="mt-1.5 text-[13px] text-foreground-secondary">
              계약서 유형과 갑/을 관점을 정한 뒤 GPT-4o가 25개 항목을 검토합니다.
              {sourceHint && (
                <span className="ml-2 inline-flex rounded-full border border-primary/30 bg-primary-tint px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  {sourceHint}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onOpenFiles} className="h-9 rounded-xl bg-foreground px-4 text-[13px] font-medium text-white transition-colors hover:bg-primary">문서허브</button>
            <button onClick={onOpenDocuments} className="h-9 rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary">문서 생성</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm"><ShieldCheck size={14} className="text-primary" strokeWidth={1.5} /></div>
            <div><p className="text-[10px] font-semibold text-foreground-tertiary">검토 항목</p><p className="text-[16px] font-bold text-foreground font-num leading-tight">25</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm"><Upload size={14} className="text-primary" strokeWidth={1.5} /></div>
            <div><p className="text-[10px] font-semibold text-foreground-tertiary">입력 방식</p><p className="text-[16px] font-bold text-foreground font-num leading-tight">2</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm"><FileText size={14} className="text-primary" strokeWidth={1.5} /></div>
            <div><p className="text-[10px] font-semibold text-foreground-tertiary">분석 관점</p><p className="text-[16px] font-bold text-foreground font-num leading-tight">{PERSPECTIVES.length}</p></div>
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
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="flex border-b border-border">
          <button
            onClick={() => { onSetInputMode('upload'); onSetError(null); }}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 border-b-2 -mb-px py-3.5 text-[13px] font-medium transition-colors',
              inputMode === 'upload' ? 'border-primary bg-white text-primary' : 'border-transparent bg-surface-tertiary text-foreground-quaternary hover:text-foreground',
            )}
          >
            <Upload size={14} />
            파일 업로드
          </button>
          <button
            onClick={() => { onSetInputMode('voice'); onSetError(null); }}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 border-b-2 -mb-px py-3.5 text-[13px] font-medium transition-colors',
              inputMode === 'voice' ? 'border-primary bg-white text-primary' : 'border-transparent bg-surface-tertiary text-foreground-quaternary hover:text-foreground',
            )}
          >
            <Mic size={14} />
            음성 녹음
          </button>
        </div>

        {inputMode === 'upload' ? (
          <div className="p-5 sm:p-6">
            <div className="mb-[10px] flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-secondary px-3.5 py-2.5">
              <span className="text-[11px] font-semibold text-foreground-secondary">지원 파일 형식</span>
              {['DOCX', 'HWPX', 'PDF'].map((label) => (
                <span key={label} className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-primary shadow-sm">
                  {label}
                </span>
              ))}
              <span className="text-[11px] text-foreground-quaternary">최대 20MB</span>
            </div>
            <div
              className={cn(
                'relative cursor-pointer rounded-xl border-2 border-dashed transition-all',
                dragOver ? 'border-primary bg-primary-tint' : file ? 'border-primary/40 bg-primary-tint' : 'border-border hover:border-primary/60 hover:bg-primary-tint',
              )}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); onSetDragOver(true); }}
              onDragLeave={() => onSetDragOver(false)}
              onDrop={onDrop}
            >
              {file ? (
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-tint shrink-0">
                    <FileText size={16} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{file.name}</p>
                    <p className="mt-0.5 text-[11px] text-foreground-quaternary">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onClearFile(); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground-quaternary transition-colors hover:bg-red-50 hover:text-red-500 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2.5 px-5 py-8">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-secondary">
                    <Upload size={20} className="text-foreground-quaternary" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-foreground-secondary">파일을 끌어다 놓거나 클릭하여 선택</p>
                    <p className="mt-0.5 text-[11px] text-foreground-quaternary">DOCX · HWPX · PDF · 최대 20MB</p>
                  </div>
                </div>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".docx,.hwpx,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <p className="mb-4 text-[12px] text-foreground-quaternary">계약 협의 내용을 녹음하면 음성을 텍스트로 변환한 뒤 바로 리스크 분석을 실행합니다.</p>
            <AudioRecorder onComplete={onRecordingComplete} onSwitchToUpload={() => { onSetInputMode('upload'); onSetError(null); }} />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-white p-5 sm:p-6">
        <div className="mb-5">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-foreground-quaternary">계약서 유형</p>
          <div className="grid grid-cols-2 gap-2">
            {CONTRACT_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => onSetContractType(ct.value)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all',
                  contractType === ct.value ? 'border-primary bg-primary-tint' : 'border-border hover:border-primary/50 hover:bg-primary-tint',
                )}
              >
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors', contractType === ct.value ? 'bg-primary' : 'bg-surface-secondary')}>
                  <ct.Icon size={15} className={contractType === ct.value ? 'text-white' : 'text-foreground-quaternary'} />
                </div>
                <div className="min-w-0">
                  <p className={cn('text-[13px] font-semibold leading-tight', contractType === ct.value ? 'text-primary' : 'text-foreground')}>{ct.label}</p>
                  <p className="text-[11px] text-foreground-quaternary">{ct.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 border-t border-border" />

        <div>
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-foreground-quaternary">분석 입장</p>
          <div className="grid grid-cols-2 gap-2">
            {PERSPECTIVES.map((p) => (
              <button
                key={p.value}
                onClick={() => onSetPerspective(p.value)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all',
                  perspective === p.value ? 'border-primary bg-primary-tint' : 'border-border hover:border-primary/50 hover:bg-primary-tint',
                )}
              >
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors', perspective === p.value ? 'bg-primary' : 'bg-surface-secondary')}>
                  <p.Icon size={15} className={perspective === p.value ? 'text-white' : 'text-foreground-quaternary'} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn('text-[13px] font-semibold leading-tight', perspective === p.value ? 'text-primary' : 'text-foreground')}>{p.value === 'seller_side' ? '을' : '갑'}</p>
                    {p.badge ? <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">{p.badge}</span> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-foreground-quaternary">{p.desc}</p>
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
            file && !isAnalyzing ? 'bg-primary text-white shadow-sm hover:bg-primary-dark hover:shadow-md' : 'cursor-not-allowed bg-border text-foreground-quaternary',
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

      <p className="text-center text-[11px] leading-relaxed text-foreground-quaternary">⚠️ 이 분석은 AI 참고 자료이며 법적 조언이 아닙니다. 최종 계약 체결 전 법률 전문가 검토를 권장합니다.</p>
    </div>
  );
}

export function ContractRiskHistoryPanel() {
  return (
    <div className="lg:sticky lg:top-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">분석 이력</h2>
          <p className="mt-1 text-[11px] text-foreground-quaternary">이전 계약 검토 결과를 열어 수정 제안과 리포트 다운로드로 이어갈 수 있습니다.</p>
        </div>
      </div>
      <AnalysisHistory />
    </div>
  );
}
