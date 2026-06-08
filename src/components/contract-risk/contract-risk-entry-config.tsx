import { Server, Wrench, Code2, Briefcase, UserCheck, Building2, GraduationCap, KeyRound, HardHat, ArrowRightLeft } from 'lucide-react';
import type { ContractType, Perspective } from '@/lib/types/contract-risk';

export const CONTRACT_TYPES: {
  value: ContractType;
  label: string;
  sub: string;
  Icon: React.ElementType;
}[] = [
  { value: 'system', label: '시스템구축', sub: '계약서', Icon: Server },
  { value: 'maintenance', label: '유지보수', sub: '계약서', Icon: Wrench },
  { value: 'software', label: '소프트웨어개발', sub: '계약서', Icon: Code2 },
  { value: 'general', label: '용역계약서', sub: '(범용)', Icon: Briefcase },
  { value: 'consulting', label: '컨설팅', sub: '계약서', Icon: GraduationCap },
  { value: 'licensing', label: '라이선싱', sub: '사용권 계약서', Icon: KeyRound },
  { value: 'construction', label: '건설/시공', sub: '계약서', Icon: HardHat },
  { value: 'outsourcing', label: '아웃소싱', sub: '계약서', Icon: ArrowRightLeft },
];

export const PERSPECTIVES: {
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
