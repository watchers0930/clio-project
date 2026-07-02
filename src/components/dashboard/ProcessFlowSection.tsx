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
}

const FLOW_STEPS: FlowStep[] = [
  {
    step: 1,
    label: '파일 등록',
    description: '업무 문서를 CLIO에 올려 저장합니다',
    href: '/files',
    cta: '등록하기',
    icon: FolderOpen,
  },
  {
    step: 2,
    label: 'AI 검색',
    description: '저장된 문서에서 필요한 내용을 찾습니다',
    href: '/search',
    cta: '검색하기',
    icon: Search,
  },
  {
    step: 3,
    label: 'AI 상담',
    description: 'AI에게 직접 문서 내용을 물어봅니다',
    href: '/search',
    cta: '물어보기',
    icon: MessageCircle,
  },
  {
    step: 4,
    label: '새 문서 생성',
    description: 'AI가 참조 문서를 바탕으로 초안을 작성합니다',
    href: '/documents?create=true',
    cta: '생성하기',
    icon: FilePlus,
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
                className="group flex flex-row items-start gap-3 rounded-xl border border-primary-tint-strong bg-primary-tint p-4 transition-all flex-1 hover:bg-primary-tint-strong hover:border-primary/20"
              >
                {/* 아이콘 */}
                <Icon size={18} strokeWidth={1.5} className="text-primary mt-0.5 flex-shrink-0" />

                {/* 텍스트 */}
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-foreground leading-tight">{step.label}</p>
                  <p className="mt-1 text-[11px] text-foreground-secondary leading-relaxed">{step.description}</p>

                  {/* CTA */}
                  <div className="mt-[10px] inline-flex items-center gap-1 text-[11px] font-semibold text-primary transition-colors">
                    {step.cta}
                    <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>

              {/* 화살표 구분자 (lg 이상에서만) */}
              {idx < FLOW_STEPS.length - 1 && (
                <div className="hidden lg:flex items-center justify-center w-6 flex-shrink-0">
                  <ArrowRight size={14} className="text-primary/30" />
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
