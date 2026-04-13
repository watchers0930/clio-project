'use client';

import { useState, useRef } from 'react';
import { X, Upload, Mic, FileAudio } from 'lucide-react';
import { AudioRecorder } from '@/components/common/AudioRecorder';
import { TodoExtractModal } from '@/components/meetings/TodoExtractModal';
import type { ExtractedTodo } from '@/lib/ai/extract-todos';

interface SttModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentCreated?: (docId: string, docTitle: string) => void; // 회의록 생성 완료 콜백
}

type InputMode = 'upload' | 'record';

const ACCEPTED_AUDIO = '.mp3,.mp4,.m4a,.wav,.webm,.ogg,.flac';
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25MB (Whisper 제한)

export function SttModal({ isOpen, onClose, onDocumentCreated }: SttModalProps) {
  const [inputMode, setInputMode] = useState<InputMode>('record');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  // 파일 업로드 탭
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 성공 후 TodoExtractModal
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const [createdDocId, setCreatedDocId] = useState('');
  const [createdDocTitle, setCreatedDocTitle] = useState('');
  const [extractedTodos, setExtractedTodos] = useState<ExtractedTodo[]>([]);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    if (file.size > MAX_UPLOAD_SIZE) {
      setTranscribeError('파일 크기가 25MB를 초과합니다.');
      return;
    }
    setSelectedFile(file);
    setTranscribeError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  // 오디오 blob/file → /api/transcribe 전송
  const sendToTranscribe = async (blob: Blob | File, fileName: string) => {
    setIsTranscribing(true);
    setTranscribeError(null);

    try {
      const formData = new FormData();
      formData.append('file', blob, fileName);

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await res.json();

      if (!data.success) {
        setTranscribeError(data.error ?? '음성 변환에 실패했습니다.');
        return;
      }

      const { document: doc, extractedTodos: todos = [] } = data.data;

      if (doc) {
        setCreatedDocId(doc.id);
        setCreatedDocTitle(doc.title);
        setExtractedTodos(todos);
        onDocumentCreated?.(doc.id, doc.title);

        // 할일이 있으면 TodoExtractModal 표시
        if (todos.length > 0) {
          setTodoModalOpen(true);
        } else {
          // 할일 없으면 바로 닫기 (회의록은 이미 생성됨)
          onClose();
        }
      }
    } catch {
      setTranscribeError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // 녹음 완료
  const handleRecordingComplete = (blob: Blob) => {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    sendToTranscribe(blob, `recording.${ext}`);
  };

  // 파일 업로드 탭 전송
  const handleUploadSubmit = () => {
    if (!selectedFile) return;
    sendToTranscribe(selectedFile, selectedFile.name);
  };

  // ── 변환 중 화면 ──
  if (isTranscribing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 px-8 py-10 flex flex-col items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-[#f0f5ff] flex items-center justify-center">
            <svg className="w-6 h-6 text-[#2E6FF2] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-[#1d1d1f]">음성을 변환하고 있어요</p>
            <p className="text-sm text-[#6e6e73] mt-1.5">Whisper AI가 텍스트로 변환 중입니다 (최대 20초)</p>
          </div>
        </div>
      </div>
    );
  }

  // ── TodoExtractModal ──
  if (todoModalOpen) {
    return (
      <TodoExtractModal
        isOpen={todoModalOpen}
        onClose={() => { setTodoModalOpen(false); onClose(); }}
        documentId={createdDocId}
        documentTitle={createdDocTitle}
        initialTodos={extractedTodos}
        onSuccess={(count) => {
          setTodoModalOpen(false);
          onClose();
          alert(`회의록이 생성되었고 ${count}개의 할일이 등록되었습니다.`);
        }}
      />
    );
  }

  // ── 메인 모달 ──
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        {/* 헤더 */}
        <div className="px-6 py-5 border-b border-[#e5e5e7] flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1B1F2B]">음성으로 회의록 생성</h2>
            <p className="text-xs text-[#6e6e73] mt-0.5">음성을 텍스트로 변환하여 회의록을 자동 생성합니다</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f5f5f7] text-[#6e6e73]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 */}
        <div className="px-6 pt-5">
          <div className="flex gap-1 p-1 bg-[#f5f5f7] rounded-xl">
            <button
              onClick={() => setInputMode('record')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === 'record'
                  ? 'bg-white text-[#1d1d1f] shadow-sm'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              <Mic className="w-4 h-4" />
              직접 녹음
            </button>
            <button
              onClick={() => setInputMode('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === 'upload'
                  ? 'bg-white text-[#1d1d1f] shadow-sm'
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
              }`}
            >
              <Upload className="w-4 h-4" />
              파일 업로드
            </button>
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="px-6 pb-5">
          {/* 에러 */}
          {transcribeError && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
              {transcribeError}
            </div>
          )}

          {inputMode === 'record' ? (
            /* 녹음 탭 */
            <AudioRecorder
              onComplete={handleRecordingComplete}
              onSwitchToUpload={() => setInputMode('upload')}
              className="min-h-[200px]"
            />
          ) : (
            /* 파일 업로드 탭 */
            <div className="mt-4 flex flex-col gap-4">
              <div
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-[#2E6FF2] bg-[#f0f5ff]'
                    : 'border-[#e5e5e7] hover:border-[#2E6FF2] hover:bg-[#f9f9fb]'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 rounded-full bg-[#f5f5f7] flex items-center justify-center">
                  <FileAudio className="w-6 h-6 text-[#6e6e73]" />
                </div>
                {selectedFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#1d1d1f]">{selectedFile.name}</p>
                    <p className="text-xs text-[#6e6e73] mt-0.5">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-[#1d1d1f]">파일을 여기에 드래그하거나 클릭하여 업로드</p>
                    <p className="text-xs text-[#6e6e73] mt-1">MP3, MP4, M4A, WAV, WebM (최대 25MB)</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_AUDIO}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                    e.target.value = '';
                  }}
                />
              </div>

              <button
                onClick={handleUploadSubmit}
                disabled={!selectedFile}
                className="w-full py-2 rounded-xl bg-[#2E6FF2] text-white text-[13px] font-medium hover:bg-[#1a5ad9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                변환 시작
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
