import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helper';
import { withMutation } from '@/lib/http/mutation-guard';
import { getUserRoleInfo } from '@/lib/permissions';
import { summarizeText } from '@/lib/ai/summarize';
import { loadResultTexts } from '@/lib/search/result-content';
import { parseResultIds } from '@/lib/search/result-ids';

/**
 * POST /api/search/summary — body: { id } (검색 결과 하나)
 * 결과 카드의 'AI 요약 보기'를 누를 때만 요약한다(검색할 때 결과마다 요약하면 검색 1번에 OpenAI 10회라 꺼 둔 기능).
 * 본문·권한은 AI 질의와 같은 모듈 — 볼 수 없거나 없는 결과는 404 로 같게 답한다.
 */
export async function POST(request: NextRequest) {
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  const ids = parseResultIds([body?.id]);
  if (!ids || ids.length !== 1) return fail('요약할 결과가 올바르지 않습니다.', 400);
  if (!process.env.OPENAI_API_KEY) return fail('AI 요약이 설정되지 않았습니다.', 503);

  const roleInfo = await getUserRoleInfo(mutation.supabase, mutation.userId);
  let target;
  try {
    [target] = await loadResultTexts(mutation.admin, mutation.supabase, {
      userId: mutation.userId, role: roleInfo?.role ?? 'user', departmentId: roleInfo?.department_id ?? null,
    }, ids);
  } catch (err) {
    // 조회 오류를 '본문 없음'으로 오인시키지 않는다
    console.error('[search/summary] load', err instanceof Error ? err.message : 'unknown');
    return fail('결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
  if (!target) return fail('결과를 찾을 수 없습니다.', 404);
  if (!target.text) return fail('본문이 아직 처리되지 않아 요약할 수 없습니다.', 422);
  try {
    return ok({ summary: (await summarizeText(target.text)).trim() });
  } catch (err) {
    console.error('[search/summary]', err instanceof Error ? err.message : 'unknown');
    return fail('요약을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.', 502);
  }
}
