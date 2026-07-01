'use client';

import Link from 'next/link';
import { FolderOpen, Search, MessageCircle, FilePlus, ArrowRight } from 'lucide-react';

interface FlowStep {
  step: number;
  label: string;
  description: string;
  href: string;
  cta: string;
  icon: React.ElementType;
  bg: string;
  iconColor: string;
  numBg: string;
}

const FLOW_STEPS: FlowStep[] = [
  {
    step: 1,
    label: '파일 등록',
    description: '업무 문서를 CLIO에 올려 저장합니다',
    href: '/files',
    cta: '등록하기',
    icon: FolderOpen,
    bg: 'bg-blue-50 hover:bg-blue-100',
    iconColor: 'text-blue-500',
    numBg: 'bg-blue-500',
  },
  {
    step: 2,
    label: 'AI 검색',
    description: '저장된 문서에서 필요한 내용을 찾습니다',
    href: '/search',
    cta: '검색하기',
    icon: Search,
    bg: 'bg-violet-50 hover:bg-violet-100',
    iconColor: 'text-violet-500',
    numBg: 'bg-violet-500',
  },
  {
    step: 3,
    label: 'AI 상담',
    description: 'AI에게 직접 문서 내용을 물어봅니다',
    href: '/search',
    cta: '물어보기',
    icon: MessageCircle,
    bg: 'bg-emerald-50 hover:bg-emerald-100',
    iconColor: 'text-emerald-600',
    numBg: 'bg-emerald-500',
  },
  {
    step: 4,
    label: '새 문서 생성',
    description: 'AI가 참조 문서를 바탕으로 초안을 작성합니다',
    href: '/documents?create=true',
    cta: '생성하기',
    icon: FilePlus,
    bg: 'bg-amber-50 hover:bg-amber-100',
    iconColor: 'text-amber-600',
    numBg: 'bg-amber-500',
  },
];

export function ProcessFlowSection() {
  return (
    <section className="rounded-2xl border border-border bg-white px-6 py-5 shadow-sm sm:px-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-foreground">CLIO 활용 흐름</h2>
          <p className="mt-0.5 text-[12px] text-foreground-tertiary">파일 등록부터 문서 생성까지 — 단계별로 시작하세요</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-0 lg:items-stretch">
        {FLOW_STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={step.step} className="flex lg:flex-row items-stretch">
              <Link
                href={step.href}
                className={cn(
                  'group flex flex-col rounded-xl border border-transparent p-4 transition-all flex-1',
                  step.bg
                )}
              >
                {/* 번호 + 아이콘 */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${step.numBg}`}>
                    {step.step}
                  </span>
                  <Icon size={18} strokeWidth={1.5} className={step.iconColor} />
                </div>

                {/* 텍스트 */}
                <p className="text-[13px] font-bold text-foreground leading-tight">{step.label}</p>
                <p className="mt-1 text-[11px] text-foreground-secondary leading-relaxed flex-1">{step.description}</p>

                {/* CTA */}
                <div className={cn(
                  'mt-3 inline-flex items-center gap-1 text-[11px] font-semibold transition-colors',
                  step.iconColor
                )}>
                  {step.cta}
                  <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* 화살표 구분자 (lg 이상에서만) */}
              {idx < FLOW_STEPS.length - 1 && (
                <div className="hidden lg:flex items-center justify-center w-6 flex-shrink-0">
                  <ArrowRight size={14} className="text-foreground-quaternary/60" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}
