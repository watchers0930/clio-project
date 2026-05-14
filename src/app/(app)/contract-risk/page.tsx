'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ContractRiskEntryForm,
  ContractRiskHero,
  ContractRiskHistoryPanel,
  ContractRiskLoadingOverlay,
} from '@/components/contract-risk/contract-risk-entry-sections';
import type { ContractType, Perspective } from '@/lib/types/contract-risk';

export default function ContractRiskPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputMode, setInputMode] = useState<'upload' | 'voice'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [contractType, setContractType] = useState<ContractType>('system');
  const [perspective, setPerspective] = useState<Perspective>('seller_side');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sourceHint, setSourceHint] = useState<string | null>(null);

  const ANALYZE_STEPS = [
    '파일을 읽고 있습니다...',
    '계약 조항을 파악하고 있습니다...',
    'GPT-4o가 25개 항목을 검토 중입니다...',
    '리스크 수준을 평가하고 있습니다...',
    '분석 결과를 정리하고 있습니다...',
  ];

  // 분석 중일 때 단계별 메시지 순환
  useEffect(() => {
    if (!isAnalyzing) { setProgressMsg(''); return; }
    let idx = 0;
    setProgressMsg(ANALYZE_STEPS[0]);
    const timer = setInterval(() => {
      idx = Math.min(idx + 1, ANALYZE_STEPS.length - 1);
      setProgressMsg(ANALYZE_STEPS[idx]);
      if (idx === ANALYZE_STEPS.length - 1) clearInterval(timer);
    }, 8000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalyzing]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const source = params.get('source');
    if (source) setSourceHint(source);
  }, []);

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
    <div className="min-h-full space-y-[25px] bg-[#F7F8FA] pb-10">
      <ContractRiskLoadingOverlay isTranscribing={isTranscribing} isAnalyzing={isAnalyzing} progressMsg={progressMsg} />
      <ContractRiskHero
        sourceHint={sourceHint}
        onOpenFiles={() => router.push('/files')}
        onOpenDocuments={() => router.push('/documents')}
        onSelectUploadMode={() => setInputMode('upload')}
      />

      {/* ── 본문 2열 레이아웃 ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px] lg:gap-6">

        {/* ── 왼쪽: 입력 폼 ──────────────────────────────────────────────── */}
        <ContractRiskEntryForm
          inputMode={inputMode}
          dragOver={dragOver}
          file={file}
          contractType={contractType}
          perspective={perspective}
          error={error}
          isAnalyzing={isAnalyzing}
          inputRef={inputRef}
          onSetInputMode={setInputMode}
          onSetError={setError}
          onSetDragOver={setDragOver}
          onClearFile={() => setFile(null)}
          onFileSelect={onFileSelect}
          onDrop={handleDrop}
          onSetContractType={setContractType}
          onSetPerspective={setPerspective}
          onSubmit={handleSubmit}
          onRecordingComplete={handleRecordingComplete}
        />

        {/* ── 오른쪽: 분석 이력 ───────────────────────────────────────────── */}
        <ContractRiskHistoryPanel />

      </div>
    </div>
  );
}
