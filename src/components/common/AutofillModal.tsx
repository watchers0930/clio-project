'use client';

/**
 * AutofillModal — HWP/Word 자동채우기 3단계 모달
 * Step 1: 파일 업로드 + 분석 중
 * Step 2: 감지된 필드 목록 확인 + 값 입력
 * Step 3: 완성 문서 다운로드
 */

import { useState, useRef, useCallback } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Wand2, Download, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useToast } from '@/components/ui/toast';

interface DetectedField {
  key: string;
  label: string;
  type: 'blank' | 'placeholder' | 'underline' | 'bracket';
  location: string;
  context?: string;
  inferredName?: string;
  confidence: 'high' | 'medium' | 'low';
  autoMapped?: boolean;
  autoValue?: string;
}

interface AutofillModalProps {
  open: boolean;
  onClose: () => void;
  initialFile?: File | null;
}

const CONFIDENCE_BADGE: Record<string, { label: string; cls: string }> = {
  high:   { label: '확실',  cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  medium: { label: '추정',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  low:    { label: '불분명', cls: 'bg-red-50 text-red-600 border border-red-200' },
};

const ALLOWED_EXTS = ['docx', 'hwpx', 'hwp'];

export function AutofillModal({ open, onClose, initialFile }: AutofillModalProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fields, setFields] = useState<DetectedField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState<string>('');

  const handleClose = useCallback(() => {
    setStep(1);
    setFile(initialFile ?? null);
    setAnalyzing(false);
    setSessionId(null);
    setFields([]);
    setValues({});
    setGenerating(false);
    setDownloadUrl(null);
    onClose();
  }, [onClose, initialFile]);

  const handleFileSelect = (selected: File) => {
    const ext = selected.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTS.includes(ext)) {
      toast.error('DOCX, HWPX, HWP 파일만 지원합니다.');
      return;
    }
    setFile(selected);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/autofill/analyze', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? '분석에 실패했습니다.');
        return;
      }

      setSessionId(data.sessionId);
      setFields(data.fields);

      // 자동 매핑 값 초기 세팅
      const initValues: Record<string, string> = {};
      for (const f of data.fields as DetectedField[]) {
        if (f.autoMapped && f.autoValue) {
          initValues[f.key] = f.autoValue;
        }
      }
      setValues(initValues);
      setStep(2);
    } catch {
      toast.error('네트워크 오류가 발생했습니다.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!sessionId) return;
    setGenerating(true);

    try {
      const res = await fetch('/api/autofill/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, values }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? '문서 생성에 실패했습니다.');
        return;
      }

      setDownloadUrl(data.downloadUrl);
      setDownloadFileName(data.fileName);
      setStep(3);
    } catch {
      toast.error('네트워크 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = downloadFileName;
    a.click();
  };

  const unfilledCount = fields.filter(f => !values[f.key]).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* 모달 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-[#E2E5EA]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2E6FF2]/10 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-[#2E6FF2]" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#1B1F2B]">자동채우기</h2>
              <p className="text-[12px] text-[#6B7280]">AI가 빈 필드를 자동으로 채워드립니다</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-[#F7F8FA] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        {/* 단계 표시 */}
        <div className="flex items-center gap-0 px-8 py-3 bg-[#F7F8FA] border-b border-[#E2E5EA]">
          {(['파일 업로드', '내용 입력', '다운로드'] as const).map((label, idx) => {
            const s = idx + 1;
            const active = step === s;
            const done = step > s;
            return (
              <div key={s} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                    done ? 'bg-emerald-500 text-white' :
                    active ? 'bg-[#2E6FF2] text-white' :
                    'bg-[#E2E5EA] text-[#6B7280]'
                  }`}>
                    {done ? '✓' : s}
                  </div>
                  <span className={`text-[12px] font-medium ${active ? 'text-[#1B1F2B]' : 'text-[#9CA3AF]'}`}>
                    {label}
                  </span>
                </div>
                {idx < 2 && <ChevronRight className="w-4 h-4 text-[#D1D5DB] mx-3" />}
              </div>
            );
          })}
        </div>

        {/* 본문 */}
        <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">

          {/* Step 1: 파일 업로드 */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  file ? 'border-[#2E6FF2] bg-[#2E6FF2]/5' : 'border-[#E2E5EA] hover:border-[#2E6FF2] hover:bg-[#F7F8FA]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.hwpx,.hwp"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                {file ? (
                  <div className="space-y-2">
                    <CheckCircle className="w-10 h-10 text-[#2E6FF2] mx-auto" />
                    <p className="text-[14px] font-medium text-[#1B1F2B]">{file.name}</p>
                    <p className="text-[12px] text-[#6B7280]">
                      {(file.size / 1024).toFixed(1)} KB — 클릭해서 다른 파일 선택
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-10 h-10 text-[#9CA3AF] mx-auto" />
                    <p className="text-[14px] font-medium text-[#1B1F2B]">파일을 드래그하거나 클릭해서 선택</p>
                    <p className="text-[12px] text-[#6B7280]">DOCX, HWPX, HWP · 최대 20MB</p>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[12px] text-amber-700">
                  HWP 바이너리 파일은 패턴 감지만 가능하며 신뢰도가 낮을 수 있습니다.
                  DOCX 또는 HWPX를 권장합니다.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: 필드 입력 */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] text-[#6B7280]">
                  총 <span className="font-semibold text-[#1B1F2B]">{fields.length}</span>개 필드 감지
                  {fields.filter(f => f.autoMapped).length > 0 && (
                    <span className="ml-2 text-emerald-600">
                      ({fields.filter(f => f.autoMapped).length}개 자동 매핑)
                    </span>
                  )}
                </p>
                {unfilledCount > 0 && (
                  <span className="text-[12px] text-amber-600">{unfilledCount}개 미입력</span>
                )}
              </div>

              {fields.map(field => {
                const badge = CONFIDENCE_BADGE[field.confidence];
                const displayName = field.inferredName ?? field.label;
                return (
                  <div key={field.key} className="border border-[#E2E5EA] rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[#1B1F2B]">{displayName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {field.autoMapped && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-200">
                          자동
                        </span>
                      )}
                    </div>
                    {field.context && (
                      <p className="text-[11px] text-[#9CA3AF]">위치: {field.context}</p>
                    )}
                    <input
                      type="text"
                      value={values[field.key] ?? ''}
                      onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.confidence === 'low' ? '내용을 직접 입력해 주세요' : `${displayName} 입력`}
                      className="w-full text-[13px] px-3 py-2 border border-[#E2E5EA] rounded-lg focus:outline-none focus:border-[#2E6FF2] bg-[#F7F8FA] placeholder:text-[#C0C4CC]"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 3: 완료 */}
          {step === 3 && (
            <div className="text-center space-y-6 py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[#1B1F2B]">자동채우기 완료!</h3>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  {fields.filter(f => values[f.key]).length}개 필드가 채워진 문서가 준비됐습니다.
                </p>
              </div>
              <div className="bg-[#F7F8FA] rounded-xl p-4 text-left">
                <p className="text-[12px] text-[#6B7280]">완성 파일</p>
                <p className="text-[14px] font-medium text-[#1B1F2B] mt-1">{downloadFileName}</p>
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 mx-auto px-6 py-3 bg-[#2E6FF2] text-white rounded-xl text-[14px] font-medium hover:bg-[#2560d8] transition-colors"
              >
                <Download className="w-4 h-4" />
                파일 다운로드
              </button>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-[#E2E5EA] bg-[#F7F8FA]">
          <button
            onClick={step === 1 ? handleClose : () => setStep(s => (s - 1) as 1 | 2 | 3)}
            disabled={analyzing || generating}
            className="px-4 py-2 text-[13px] text-[#6B7280] hover:text-[#1B1F2B] disabled:opacity-40 transition-colors"
          >
            {step === 1 ? '취소' : '← 이전'}
          </button>

          {step === 1 && (
            <button
              onClick={handleAnalyze}
              disabled={!file || analyzing}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#2E6FF2] text-white rounded-xl text-[13px] font-medium hover:bg-[#2560d8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? <><Spinner size="sm" /> 분석 중...</> : <><Wand2 className="w-4 h-4" /> 분석 시작</>}
            </button>
          )}

          {step === 2 && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#2E6FF2] text-white rounded-xl text-[13px] font-medium hover:bg-[#2560d8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? <><Spinner size="sm" /> 생성 중...</> : <><Download className="w-4 h-4" /> 문서 생성</>}
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleClose}
              className="px-5 py-2.5 bg-[#1B1F2B] text-white rounded-xl text-[13px] font-medium hover:bg-[#2d3344] transition-colors"
            >
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
