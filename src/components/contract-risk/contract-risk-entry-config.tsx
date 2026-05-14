import { Server, Wrench, Code2, Briefcase, UserCheck, Building2 } from 'lucide-react';
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
