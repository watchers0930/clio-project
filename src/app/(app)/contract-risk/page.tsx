'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileText, AlertCircle, X, Mic,
  ShieldCheck, Server, Wrench, Code2, Briefcase,
  Building2, UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisHistory } from '@/components/contract-risk/AnalysisHistory';
import type { ContractType, Perspective } from '@/lib/types/contract-risk';
import { AudioRecorder } from '@/components/common/AudioRecorder';

const CONTRACT_TYPES: {
  value: ContractType;
  label: string;
  sub: string;
  Icon: React.ElementType;
}[] = [
  { value: 'system',      label: '시스템구축',     sub: '계약서',      Icon: Server },
  { value: 'maintenance', label: '유지보수',       sub: '계약서',      Icon: Wrench },
  { value: 'software',    label: '소프트웨어개발', sub: '계약서',      Icon: Code2 },
  { value: 'general',     label: '용역계약서',     sub: '(범용)',       Icon: Briefcase },
];

const PERSPECTIVES: {
  value: Perspective;
  label: string;
  badge?: string;
  desc: string;
  Icon: React.ElementType;
}[] = [
  {
    value: 'seller_side',
    label: '을 — 공급자/수급인',
    badge: '기본값',
    desc: '계약을 수주하는 입장',
    Icon: UserCheck,
  },
  {
    value: 'buyer_side',
    label: '갑 — 발주자/도급인',
    desc: '계약을 발주하는 입장',
    Icon: Building2,
  },
];

export default function ContractRiskPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputMode, setInputMode] = useState<'upload' | 'voice'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [contractType, setContractType] = useState<ContractType>('system');
  const [perspective, setPerspective] = useState<Perspective>('seller_side');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const onFileSelect = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['docx', 'hwpx', 'hwp', 'pdf'].includes(ext)) {
      setError('DOCX, HWPX, HWP, PDF 파일만 분석할 수 있습니다.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('파일 크기는 20MB 이하여야 합니다.');
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFileSelect(f);
  };

  const handleRecordingComplete = async (blob: Blob) => {
    setIsTranscribing(true);
    setError(null);
    try {
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const formData = new FormData();
      formData.append('file', blob, `voice.${ext}`);
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success || !data.data?.transcript) {
        setError('음성 변환에 실패했습니다. 다시 시도해 주세요.');
        setIsTranscribing(false);
        return;
      }
      const txtBlob = new Blob([data.data.transcript], { type: 'text/plain' });
      const txtFile = new File([txtBlob], 'voice_contract.txt', { type: 'text/plain' });
      setIsTranscribing(false);
      setIsAnalyzing(true);
      const analyzeForm = new FormData();
      analyzeForm.append('file', txtFile);
      analyzeForm.append('contract_type', contractType);
      analyzeForm.append('perspective', perspective);
      const analyzeRes = await fetch('/api/contract-risk/analyze', {
        method: 'POST',
        body: analyzeForm,
      });
      const analyzeJson = await analyzeRes.json();
      if (!analyzeRes.ok) {
        setError(analyzeJson.message ?? analyzeJson.error ?? '분석 중 오류가 발생했습니다.');
        setIsAnalyzing(false);
        return;
      }
      router.push(`/contract-risk/${analyzeJson.id}`);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
      setIsTranscribing(false);
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('contract_type', contractType);
    formData.append('perspective', perspective);
    try {
      const res = await fetch('/api/contract-risk/analyze', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? json.error ?? '분석 중 오류가 발생했습니다.');
        setIsAnalyzing(false);
        return;
      }
      router.push(`/contract-risk/${json.id}`);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-full bg-[#F7F8FA]">

      {/* ── 로딩 오버레이 ─────────────────────────────────────────────────── */}
      {(isTranscribing || isAnalyzing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-10 flex flex-col items-center gap-5 min-w-[240px]">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full bg-[#EEF3FE]" />
              <ShieldCheck size={28} className="absolute inset-0 m-auto text-[#2E6FF2]" />
              <svg
                className="absolute inset-0 w-14 h-14 animate-spin text-[#2E6FF2]"
                fill="none" viewBox="0 0 56 56"
              >
                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="3" strokeDasharray="120 40" strokeLinecap="round" opacity="0.3" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-[#1B1F2B]">
                {isTranscribing ? '음성 변환 중' : '리스크 분석 중'}
              </p>
              <p className="text-[12px] text-[#888] mt-1">
                {isTranscribing ? '음성을 텍스트로 변환하고 있습니다' : 'GPT-4o가 25개 항목을 검토 중입니다 (최대 60초)'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 페이지 헤더 ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E2E5EA]">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-3.5">
          <div className="w-10 h-10 bg-[#EEF3FE] rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={20} className="text-[#2E6FF2]" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1B1F2B] leading-none">계약서 AI 리스크 분석</h1>
            <p className="text-[12px] text-[#888] mt-0.5">GPT-4o · 25개 항목 자동 검토 · 상/중/하 리스크 분류</p>
          </div>
        </div>
      </div>

      {/* ── 본문 2열 레이아웃 ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

        {/* ── 왼쪽: 입력 폼 ──────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* 입력 방식 카드 */}
          <div className="bg-white border border-[#E2E5EA] rounded-2xl overflow-hidden">
            {/* 탭 헤더 */}
            <div className="flex border-b border-[#E2E5EA]">
              <button
                onClick={() => { setInputMode('upload'); setError(null); }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3.5 text-[13px] font-medium transition-colors border-b-2 -mb-px',
                  inputMode === 'upload'
                    ? 'border-[#2E6FF2] text-[#2E6FF2] bg-white'
                    : 'border-transparent text-[#888] hover:text-[#1B1F2B] bg-[#FAFBFC]',
                )}
              >
                <Upload size={14} />
                파일 업로드
              </button>
              <button
                onClick={() => { setInputMode('voice'); setError(null); }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3.5 text-[13px] font-medium transition-colors border-b-2 -mb-px',
                  inputMode === 'voice'
                    ? 'border-[#2E6FF2] text-[#2E6FF2] bg-white'
                    : 'border-transparent text-[#888] hover:text-[#1B1F2B] bg-[#FAFBFC]',
                )}
              >
                <Mic size={14} />
                음성 녹음
              </button>
            </div>

            {/* 업로드 탭 */}
            {inputMode === 'upload' && (
              <div className="p-5">
                <div
                  className={cn(
                    'relative border-2 border-dashed rounded-xl transition-all cursor-pointer',
                    dragOver
                      ? 'border-[#2E6FF2] bg-[#EEF3FE]'
                      : file
                        ? 'border-[#2E6FF2]/40 bg-[#F7F9FF]'
                        : 'border-[#E2E5EA] hover:border-[#2E6FF2]/60 hover:bg-[#FAFBFF]',
                  )}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  {file ? (
                    <div className="flex items-center gap-3 px-5 py-4">
                      <div className="w-9 h-9 bg-[#EEF3FE] rounded-lg flex items-center justify-center shrink-0">
                        <FileText size={16} className="text-[#2E6FF2]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1B1F2B] truncate">{file.name}</p>
                        <p className="text-[11px] text-[#888] mt-0.5">
                          {(file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setFile(null); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#ccc] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-8 px-5 gap-2.5">
                      <div className="w-11 h-11 bg-[#F0F2F5] rounded-xl flex items-center justify-center">
                        <Upload size={20} className="text-[#aaa]" />
                      </div>
                      <div className="text-center">
                        <p className="text-[13px] font-medium text-[#555]">파일을 끌어다 놓거나 클릭하여 선택</p>
                        <p className="text-[11px] text-[#bbb] mt-0.5">DOCX · HWPX · HWP · PDF · 최대 20MB</p>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".docx,.hwpx,.hwp,.pdf"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }}
                />
              </div>
            )}

            {/* 음성 녹음 탭 */}
            {inputMode === 'voice' && (
              <div className="p-5">
                <p className="text-[12px] text-[#888] mb-4">
                  계약 협의 내용을 녹음하면 음성을 텍스트로 변환한 뒤 바로 리스크 분석을 실행합니다.
                </p>
                <AudioRecorder
                  onComplete={handleRecordingComplete}
                  onSwitchToUpload={() => { setInputMode('upload'); setError(null); }}
                />
              </div>
            )}
          </div>

          {/* 옵션 카드 */}
          <div className="bg-white border border-[#E2E5EA] rounded-2xl p-5">

            {/* 계약서 유형 */}
            <div className="mb-5">
              <p className="text-[12px] font-semibold text-[#888] uppercase tracking-wider mb-3">
                계약서 유형
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CONTRACT_TYPES.map(ct => (
                  <button
                    key={ct.value}
                    onClick={() => setContractType(ct.value)}
                    className={cn(
                      'flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all',
                      contractType === ct.value
                        ? 'border-[#2E6FF2] bg-[#EEF3FE]'
                        : 'border-[#E2E5EA] hover:border-[#2E6FF2]/50 hover:bg-[#FAFBFF]',
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      contractType === ct.value ? 'bg-[#2E6FF2]' : 'bg-[#F0F2F5]',
                    )}>
                      <ct.Icon size={15} className={contractType === ct.value ? 'text-white' : 'text-[#888]'} />
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        'text-[13px] font-semibold leading-tight',
                        contractType === ct.value ? 'text-[#2E6FF2]' : 'text-[#1B1F2B]',
                      )}>
                        {ct.label}
                      </p>
                      <p className="text-[11px] text-[#aaa]">{ct.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 구분선 */}
            <div className="border-t border-[#F0F2F5] mb-5" />

            {/* 분석 입장 */}
            <div>
              <p className="text-[12px] font-semibold text-[#888] uppercase tracking-wider mb-3">
                분석 입장
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PERSPECTIVES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPerspective(p.value)}
                    className={cn(
                      'flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all',
                      perspective === p.value
                        ? 'border-[#2E6FF2] bg-[#EEF3FE]'
                        : 'border-[#E2E5EA] hover:border-[#2E6FF2]/50 hover:bg-[#FAFBFF]',
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      perspective === p.value ? 'bg-[#2E6FF2]' : 'bg-[#F0F2F5]',
                    )}>
                      <p.Icon size={15} className={perspective === p.value ? 'text-white' : 'text-[#888]'} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={cn(
                          'text-[13px] font-semibold leading-tight',
                          perspective === p.value ? 'text-[#2E6FF2]' : 'text-[#1B1F2B]',
                        )}>
                          {p.value === 'seller_side' ? '을' : '갑'}
                        </p>
                        {p.badge && (
                          <span className="text-[10px] bg-[#2E6FF2] text-white px-1.5 py-0.5 rounded-full font-medium leading-none">
                            {p.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#888] mt-0.5 leading-snug">{p.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5">
              <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          {/* 분석 시작 버튼 (파일 탭에서만) */}
          {inputMode === 'upload' && (
            <button
              onClick={handleSubmit}
              disabled={!file || isAnalyzing}
              className={cn(
                'w-full py-3.5 rounded-2xl text-[14px] font-semibold transition-all flex items-center justify-center gap-2',
                file && !isAnalyzing
                  ? 'bg-[#2E6FF2] text-white hover:bg-[#1E5FE2] shadow-sm hover:shadow-md'
                  : 'bg-[#E8EAED] text-[#bbb] cursor-not-allowed',
              )}
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
          )}

          <p className="text-[11px] text-[#c0c4cc] text-center leading-relaxed">
            ⚠️ 이 분석은 AI 참고 자료이며 법적 조언이 아닙니다. 최종 계약 체결 전 법률 전문가 검토를 권장합니다.
          </p>
        </div>

        {/* ── 오른쪽: 분석 이력 ───────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-[#1B1F2B]">분석 이력</h2>
          </div>
          <AnalysisHistory />
        </div>

      </div>
    </div>
  );
}
