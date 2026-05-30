'use client';

import { useState, useMemo } from 'react';
import { Spinner } from '@/components/ui';
import { parseSections, extractSectionContent } from '@/lib/utils/parse-sections';
import { useToast } from '@/components/ui/toast';
import { ArrowLeft, Layers, PlusCircle, Replace } from 'lucide-react';

interface CommentReflectModalProps {
  documentId: string;
  selectedComments: { id: string; content: string; userName: string }[];
  documentContent: string;
  onClose: () => void;
  onReflected: () => void;
}

type Step = 'select' | 'insert' | 'append' | 'replace';

export function CommentReflectModal({
  documentId,
  selectedComments,
  documentContent,
  onClose,
  onReflected,
}: CommentReflectModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<Step>('select');
  const [targetSection, setTargetSection] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [replaceScope, setReplaceScope] = useState('__all__');
  const [loading, setLoading] = useState(false);

  const matchCount = useMemo(() => {
    if (!findText) return 0;
    const target = replaceScope === '__all__' ? documentContent : extractSectionContent(documentContent, replaceScope);
    return target.split(findText).length - 1;
  }, [documentContent, findText, replaceScope]);

  const markdownSections = parseSections(documentContent);
  // 파일 기반 문서(HWPX/DOCX): 첫 줄이 라벨이면 보고서 고정 섹션 제공
  const isFileBased = documentContent.split('\n')[0].startsWith('[');
  const HWPX_SECTIONS = ['정보(자료) 출처', '보고 내용과 의견', '문제점'];
  // 이미 추가된 마크다운 섹션도 포함
  const sections = isFileBased
    ? [...HWPX_SECTIONS, ...markdownSections.filter(s => !HWPX_SECTIONS.includes(s))]
    : markdownSections;

  const handleApply = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const commentIds = selectedComments.map((c) => c.id);
      const body =
        step === 'insert'
          ? { mode: 'insert', selectedCommentIds: commentIds, targetSection }
          : step === 'append'
            ? { mode: 'append', selectedCommentIds: commentIds, newSectionTitle }
            : { mode: 'replace', selectedCommentIds: commentIds, findText, replaceText, replaceScope: replaceScope === '__all__' ? undefined : replaceScope };

      const res = await fetch(`/api/documents/${documentId}/apply-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('댓글이 문서에 반영되었습니다.');
        onReflected();
        onClose();
      } else {
        toast.error(data.error ?? '반영 실패');
      }
    } catch {
      toast.error('서버 오류');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center">
      <div className="bg-white rounded-t-[28px] shadow-xl w-full max-w-[440px] overflow-hidden sm:mx-4 sm:rounded-xl">

        {/* 헤더 */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-5 sm:px-6 sm:py-6">
          {step !== 'select' && (
            <button
              onClick={() => setStep('select')}
              className="rounded-lg p-1.5 hover:bg-surface-secondary transition-colors"
            >
              <ArrowLeft size={16} className="text-foreground-secondary" />
            </button>
          )}
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">댓글 반영</h3>
            <p className="text-[11px] text-foreground-secondary mt-0.5">선택된 댓글 {selectedComments.length}개</p>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-5 py-5 sm:px-6 sm:py-6">

          {/* Step 1: 모드 선택 */}
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-[13px] text-foreground mb-4">어떻게 반영할까요?</p>
              <button
                onClick={() => setStep('insert')}
                className="w-full flex items-start gap-4 rounded-2xl border border-border px-5 py-5 hover:border-primary hover:bg-primary-tint transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Layers size={17} className="text-primary" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">기존 섹션에 추가</p>
                  <p className="text-[11px] text-foreground-secondary mt-0.5 leading-relaxed">원문의 특정 섹션에 댓글 내용을 자연스럽게 통합합니다.</p>
                </div>
              </button>
              <button
                onClick={() => setStep('append')}
                className="w-full flex items-start gap-4 rounded-2xl border border-border px-5 py-5 hover:border-primary hover:bg-primary-tint transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <PlusCircle size={17} className="text-success" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">새 단락 만들기</p>
                  <p className="text-[11px] text-foreground-secondary mt-0.5 leading-relaxed">AI가 댓글을 정리해 새로운 단락을 원문 하단에 추가합니다.</p>
                </div>
              </button>
              <button
                onClick={() => setStep('replace')}
                className="w-full flex items-start gap-4 rounded-2xl border border-border px-5 py-5 hover:border-primary hover:bg-primary-tint transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Replace size={17} className="text-warning" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">단어/문장 수정</p>
                  <p className="text-[11px] text-foreground-secondary mt-0.5 leading-relaxed">원문에서 특정 텍스트를 찾아 다른 텍스트로 바꿉니다.</p>
                </div>
              </button>
            </div>
          )}

          {/* Step 2a: 섹션 선택 */}
          {step === 'insert' && (
            <div>
              <p className="text-[13px] text-foreground mb-4">어느 섹션에 추가할까요?</p>
              {sections.length === 0 ? (
                <p className="text-[12px] text-foreground-quaternary">원문에서 섹션을 찾을 수 없습니다.</p>
              ) : (
                <div className="max-h-48 space-y-3 overflow-y-auto">
                  {sections.map((section) => (
                    <button
                      key={section}
                      onClick={() => setTargetSection(section)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-[13px] transition-all ${
                        targetSection === section
                          ? 'border-primary bg-primary/6 text-primary font-medium'
                          : 'border-border text-foreground hover:border-primary/40 hover:bg-surface-secondary'
                      }`}
                    >
                      {section}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2b: 새 단락 이름 입력 */}
          {step === 'append' && (
            <div>
              <p className="text-[13px] text-foreground mb-4">새 단락 이름을 입력하세요.</p>
              <input
                type="text"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newSectionTitle.trim()) handleApply(); }}
                placeholder="예: 해결방안, 조치사항, 의견 종합"
                className="w-full rounded-xl border border-border px-4 py-3 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:border-primary transition-colors"
                autoFocus
              />
            </div>
          )}

          {/* Step 2c: 단어/문장 수정 */}
          {step === 'replace' && (
            <div className="space-y-3">
              <div>
                <label className="text-[12px] text-foreground-secondary mb-1.5 block">적용 범위</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setReplaceScope('__all__')}
                    className={`px-3 py-1.5 rounded-lg text-[12px] border transition-all ${
                      replaceScope === '__all__'
                        ? 'border-primary bg-primary/6 text-primary font-medium'
                        : 'border-border text-foreground-secondary hover:border-primary/40'
                    }`}
                  >
                    전체 문서
                  </button>
                  {sections.map((s) => (
                    <button
                      key={s}
                      onClick={() => setReplaceScope(s)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] border transition-all truncate max-w-[180px] ${
                        replaceScope === s
                          ? 'border-primary bg-primary/6 text-primary font-medium'
                          : 'border-border text-foreground-secondary hover:border-primary/40'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[12px] text-foreground-secondary mb-1.5 block">찾을 텍스트</label>
                <input
                  type="text"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  placeholder="원문에서 찾을 단어나 문장"
                  className="w-full rounded-xl border border-border px-4 py-3 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:border-primary transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[12px] text-foreground-secondary mb-1.5 block">바꿀 텍스트</label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && matchCount > 0) handleApply(); }}
                  placeholder="대체할 단어나 문장"
                  className="w-full rounded-xl border border-border px-4 py-3 text-[13px] text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <p className={`text-[12px] ${matchCount > 0 ? 'text-primary' : 'text-foreground-quaternary'}`}>
                {findText ? (matchCount > 0 ? `${matchCount}건 일치` : '일치 항목 없음') : '찾을 텍스트를 입력하세요'}
              </p>
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="border-t border-border px-5 py-5 flex flex-col-reverse justify-end gap-3 sm:px-6 sm:flex-row sm:gap-3.5">
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full px-5 py-3 rounded-xl border border-border text-[13px] text-foreground-secondary hover:bg-surface-secondary transition-colors disabled:opacity-40 sm:w-auto"
          >
            취소
          </button>
          {step === 'insert' && (
            <button
              onClick={handleApply}
              disabled={!targetSection || loading}
              className="w-full px-5 py-3 rounded-xl bg-primary text-white text-[13px] font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-2 sm:w-auto"
            >
              {loading && <Spinner size="sm" variant="white" />}
              적용하기
            </button>
          )}
          {step === 'append' && (
            <button
              onClick={handleApply}
              disabled={!newSectionTitle.trim() || loading}
              className="w-full px-5 py-3 rounded-xl bg-primary text-white text-[13px] font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-2 sm:w-auto"
            >
              {loading && <Spinner size="sm" variant="white" />}
              AI로 생성하기
            </button>
          )}
          {step === 'replace' && (
            <button
              onClick={handleApply}
              disabled={matchCount === 0 || loading}
              className="w-full px-5 py-3 rounded-xl bg-primary text-white text-[13px] font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-2 sm:w-auto"
            >
              {loading && <Spinner size="sm" variant="white" />}
              적용하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
