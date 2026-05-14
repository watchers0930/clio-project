'use client';

/**
 * OnboardingModal — 첫 로그인 시 CLIO 기능 투어
 * localStorage 'clio_onboarding_done' 로 완료 여부 관리
 */

import { useState, useEffect } from 'react';
import {
  Upload, FileText, ShieldCheck, MessageSquare, Wand2,
  ChevronRight, ChevronLeft, X
} from 'lucide-react';

const SLIDES = [
  {
    icon: Upload,
    color: '#2E6FF2',
    bg: '#EEF3FE',
    title: '파일 업로드 & AI 검색',
    desc: 'DOCX, HWPX, PDF 등 다양한 형식을 업로드하면 AI가 내용을 분석합니다. 자연어로 "3월 계약서 납기일"처럼 질문하면 바로 찾아드립니다.',
    badge: '파일 관리',
  },
  {
    icon: FileText,
    color: '#10b981',
    bg: '#ecfdf5',
    title: 'AI 문서 자동 생성',
    desc: '템플릿을 선택하고 참고 파일을 지정하면 GPT-4o가 보고서·회의록·제안서를 초안부터 완성까지 작성해 드립니다. DOCX, HWPX, PDF로 다운로드 가능합니다.',
    badge: '문서 생성',
  },
  {
    icon: ShieldCheck,
    color: '#f59e0b',
    bg: '#fffbeb',
    title: '계약서 리스크 분석',
    desc: '계약서를 업로드하면 25개 항목을 자동 분석합니다. 위험 조항은 관련 법령을 검색해 수정 제안까지 드리며, 수정된 파일을 바로 다운로드할 수 있습니다.',
    badge: '계약 리스크',
  },
  {
    icon: MessageSquare,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    title: '사내 메신저',
    desc: '부서별 채널과 DM을 통해 팀과 소통하고, 파일을 첨부해 공유할 수 있습니다. 실시간 알림으로 중요한 메시지를 놓치지 마세요.',
    badge: '메신저',
  },
  {
    icon: Wand2,
    color: '#ec4899',
    bg: '#fdf2f8',
    title: '양식 자동채우기',
    desc: '반복 작성하는 DOCX·HWPX 양식 파일을 업로드하면 AI가 빈 칸을 자동으로 감지하고 채워드립니다. 이름·날짜·부서는 자동 매핑됩니다.',
    badge: '자동채우기',
  },
];

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let timer: number | null = null;
    try {
      if (!localStorage.getItem('clio_onboarding_done')) {
        timer = window.setTimeout(() => setOpen(true), 0);
      }
    } catch {
      // localStorage 접근 불가 환경
    }
    return () => {
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);

  const handleClose = () => {
    try { localStorage.setItem('clio_onboarding_done', '1'); } catch { /* noop */ }
    setOpen(false);
  };

  if (!open) return null;

  const slide = SLIDES[step];
  const Icon = slide.icon;
  const isLast = step === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 닫기 */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg hover:bg-[#F7F8FA] flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-[#6B7280]" />
        </button>

        {/* 상단 컬러 배너 */}
        <div
          className="flex flex-col items-center justify-center pt-10 pb-8"
          style={{ background: slide.bg }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: slide.color }}
          >
            <Icon className="w-8 h-8 text-white" />
          </div>
          <span
            className="mt-3 text-[11px] font-semibold px-3 py-1 rounded-full"
            style={{ background: slide.color + '20', color: slide.color }}
          >
            {slide.badge}
          </span>
        </div>

        {/* 본문 */}
        <div className="px-5 pb-4 pt-6 sm:px-8">
          <h2 className="text-[18px] font-bold text-[#1B1F2B] mb-2">{slide.title}</h2>
          <p className="text-[13px] text-[#6B7280] leading-relaxed">{slide.desc}</p>
        </div>

        {/* 점 인디케이터 */}
        <div className="flex justify-center gap-1.5 py-4">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="rounded-full transition-all"
              style={{
                width: i === step ? 20 : 8,
                height: 8,
                background: i === step ? slide.color : '#E2E5EA',
              }}
            />
          ))}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between border-t border-[#E2E5EA] bg-[#F7F8FA] px-5 py-4 sm:px-8 sm:py-5">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1 text-[13px] text-[#6B7280] hover:text-[#1B1F2B] disabled:opacity-0 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> 이전
          </button>

          {isLast ? (
            <button
              onClick={handleClose}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors"
              style={{ background: slide.color }}
            >
              시작하기 🎉
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-1 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors"
              style={{ background: slide.color }}
            >
              다음 <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
