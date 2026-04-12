'use client';

'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, AlertCircle, X, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisHistory } from '@/components/contract-risk/AnalysisHistory';
import { CONTRACT_TYPE_LABELS, PERSPECTIVE_LABELS } from '@/lib/contract-risk-items';
import type { ContractType, Perspective } from '@/lib/types/contract-risk';
import { AudioRecorder } from '@/components/common/AudioRecorder';

const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: 'system', label: '시스템구축계약서' },
  { value: 'maintenance', label: '유지보수계약서' },
  { value: 'software', label: '소프트웨어개발계약서' },
  { value: 'general', label: '용역계약서 (범용)' },
];

const PERSPECTIVES: { value: Perspective; label: string; desc: string }[] = [
  { value: 'seller_side', label: '을 (공급자/수급인)', desc: '계약을 수주하는 입장 — 기본값' },
  { value: 'buyer_side', label: '갑 (발주자/도급인)', desc: '계약을 발주하는 입장' },
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

  // 음성 녹음 완료 → STT → txt 파일로 변환 → 분석 바로 실행
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

      // transcript → txt Blob → 파일로 변환 후 분석 API 호출
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
      const res = await fetch('/api/contract-risk/analyze', {
        method: 'POST',
        body: formData,
      });
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
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-[22px] font-bold text-[#1B1F2B]">계약서 AI 리스크 분석</h1>
        <p className="text-[13px] text-[#888] mt-1">
          계약서를 업로드하면 GPT-4o가 25개 항목을 분석하여 리스크를 상/중/하로 분류합니다.
        </p>
      </div>

      {/* 변환 중 로딩 */}
      {(isTranscribing || isAnalyzing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl px-8 py-10 flex flex-col items-center gap-4">
            <svg className="w-8 h-8 text-[#2E6FF2] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-[14px] font-medium text-[#1B1F2B]">
              {isTranscribing ? '음성을 텍스트로 변환하는 중...' : '계약 리스크를 분석하는 중...'}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#E2E5EA] rounded-xl p-6 mb-6">
        {/* 입력 방식 탭 */}
        <div className="flex gap-1 p-1 bg-[#f5f5f7] rounded-xl mb-5">
          <button
            onClick={() => { setInputMode('upload'); setError(null); }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-all',
              inputMode === 'upload' ? 'bg-white text-[#1B1F2B] shadow-sm' : 'text-[#6e6e73] hover:text-[#1B1F2B]',
            )}
          >
            <Upload size={14} />
            파일 업로드
          </button>
          <button
            onClick={() => { setInputMode('voice'); setError(null); }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-all',
              inputMode === 'voice' ? 'bg-white text-[#1B1F2B] shadow-sm' : 'text-[#6e6e73] hover:text-[#1B1F2B]',
            )}
          >
            <Mic size={14} />
            음성 녹음
          </button>
        </div>

        {/* 파일 업로드 탭 */}
        {inputMode === 'upload' && (
        <>
        <p className="text-[13px] font-semibold text-[#1B1F2B] mb-3">계약서 파일</p>
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
            dragOver ? 'border-[#2E6FF2] bg-blue-50' : 'border-[#E2E5EA] hover:border-[#2E6FF2]',
            file ? 'bg-[#F7F8FA]' : 'bg-white',
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText size={20} className="text-[#2E6FF2]" />
              <span className="text-[13px] font-medium text-[#1B1F2B]">{file.name}</span>
              <button
                onClick={e => { e.stopPropagation(); setFile(null); }}
                className="text-[#aaa] hover:text-red-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <Upload size={28} className="mx-auto mb-3 text-[#aaa]" />
              <p className="text-[13px] font-medium text-[#555]">파일을 끌어다 놓거나 클릭하여 선택</p>
              <p className="text-[11px] text-[#aaa] mt-1">DOCX, HWPX, HWP, PDF · 최대 20MB</p>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.hwpx,.hwp,.pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }}
        />
        </>
        )}

        {/* 음성 녹음 탭 */}
        {inputMode === 'voice' && (
          <div>
            <p className="text-[13px] text-[#6e6e73] mb-3">
              계약 협의 내용을 녹음하면 음성을 텍스트로 변환한 뒤 바로 리스크 분석을 실행합니다.
            </p>
            <AudioRecorder
              onComplete={handleRecordingComplete}
              onSwitchToUpload={() => { setInputMode('upload'); setError(null); }}
            />
          </div>
        )}

        {/* 계약서 유형 */}
        <div className="mt-5">
          <p className="text-[13px] font-semibold text-[#1B1F2B] mb-2">계약서 유형</p>
          <div className="grid grid-cols-2 gap-2">
            {CONTRACT_TYPES.map(ct => (
              <button
                key={ct.value}
                onClick={() => setContractType(ct.value)}
                className={cn(
                  'text-left px-4 py-2.5 rounded-lg border text-[13px] font-medium transition-all',
                  contractType === ct.value
                    ? 'border-[#2E6FF2] bg-blue-50 text-[#2E6FF2]'
                    : 'border-[#E2E5EA] text-[#555] hover:border-[#2E6FF2]',
                )}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        {/* 분석 입장 */}
        <div className="mt-5">
          <p className="text-[13px] font-semibold text-[#1B1F2B] mb-2">분석 입장</p>
          <div className="grid grid-cols-2 gap-2">
            {PERSPECTIVES.map(p => (
              <button
                key={p.value}
                onClick={() => setPerspective(p.value)}
                className={cn(
                  'text-left px-4 py-2.5 rounded-lg border transition-all',
                  perspective === p.value
                    ? 'border-[#2E6FF2] bg-blue-50'
                    : 'border-[#E2E5EA] hover:border-[#2E6FF2]',
                )}
              >
                <p className={cn('text-[13px] font-medium', perspective === p.value ? 'text-[#2E6FF2]' : 'text-[#1B1F2B]')}>
                  {p.label}
                </p>
                <p className="text-[11px] text-[#888] mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-700">{error}</p>
          </div>
        )}

        {/* 분석 시작 버튼 (파일 업로드 탭에서만) */}
        {inputMode === 'upload' && (
        <button
          onClick={handleSubmit}
          disabled={!file || isAnalyzing}
          className={cn(
            'w-full mt-5 py-3 rounded-xl text-[14px] font-semibold transition-all',
            file && !isAnalyzing
              ? 'bg-[#2E6FF2] text-white hover:bg-[#1E5FE2]'
              : 'bg-[#E2E5EA] text-[#aaa] cursor-not-allowed',
          )}
        >
          {isAnalyzing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              AI 분석 중 (최대 60초)...
            </span>
          ) : '분석 시작'}
        </button>
        )}

        {/* 면책 문구 */}
        <p className="text-[11px] text-[#aaa] mt-3 text-center">
          ⚠️ 이 분석은 AI 참고 자료이며 법적 조언이 아닙니다. 최종 계약 체결 전 법률 전문가 검토를 권장합니다.
        </p>
      </div>

      {/* 분석 이력 */}
      <div>
        <h2 className="text-[15px] font-semibold text-[#1B1F2B] mb-3">분석 이력</h2>
        <AnalysisHistory />
      </div>
    </div>
  );
}
