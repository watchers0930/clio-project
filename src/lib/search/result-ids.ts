// 검색 결과 id 목록 — AI 질의·AI 요약 요청이 함께 쓴다(클라이언트도 import, 서버 전용 코드 없음)
import { UUID_RE } from '@/lib/documents/document-links';

export const MAX_RESULT_IDS = 20; // 검색 결과 10건 + 로컬 결과 — 화면은 이만큼만 보내고 서버는 넘으면 거부

/** 요청 본문의 id 목록 검증 — 배열·UUID·상한·중복 제거. 형식이 틀리면 null */
export function parseResultIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_RESULT_IDS) return null;
  if (!value.every((id) => typeof id === 'string' && UUID_RE.test(id))) return null;
  return [...new Set((value as string[]).map((id) => id.toLowerCase()))];
}
