import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getGmailClientForUser } from '@/lib/google/gmail-client';
import { runAutoDeleteRules, type AutoDeleteRule } from '@/lib/google/gmail-auto-delete';

// Pro 플랜: 최대 300초. 규칙 보유 사용자를 순차 처리한다.
export const maxDuration = 300;

const OVERALL_BUDGET_MS = 280_000; // 전체 실행 예산 (300초 제한 대비 여유)

interface RuleRow {
  id: string;
  user_id: string;
  pattern: string;
}

// GET /api/cron/gmail-auto-delete — Vercel Cron 전용. 하루 1회.
// 이용자가 등록한 자동삭제 규칙에 매칭되는 메일을 휴지통으로 이동한다(영구삭제 아님).
// Vercel Cron은 CRON_SECRET env가 있으면 Authorization: Bearer <CRON_SECRET>를 자동 첨부한다.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();

  // 활성 규칙 전체를 사용자별로 묶어 처리한다. (service_role → RLS 우회)
  const { data: rows } = await admin
    .from('gmail_auto_delete_rules')
    .select('id, user_id, pattern')
    .eq('enabled', true);

  const rulesByUser = new Map<string, AutoDeleteRule[]>();
  for (const r of (rows ?? []) as RuleRow[]) {
    const list = rulesByUser.get(r.user_id) ?? [];
    list.push({ id: r.id, pattern: r.pattern });
    rulesByUser.set(r.user_id, list);
  }

  const startedAt = Date.now();
  let processedUsers = 0;
  let totalTrashed = 0;
  let skipped = 0;
  const failures: Array<{ userId: string; error: string }> = [];
  const nowIso = new Date().toISOString();

  for (const [userId, rules] of rulesByUser) {
    if (Date.now() - startedAt > OVERALL_BUDGET_MS) break;
    try {
      const client = await getGmailClientForUser(admin, userId);
      // Gmail 미연결 또는 삭제 권한(gmail.modify) 없으면 건너뛴다.
      if (!client || !client.scope.includes('gmail.modify')) {
        skipped++;
        continue;
      }

      const results = await runAutoDeleteRules(client.gmail, rules);

      // 규칙별 last_run_at·누적 삭제 건수 갱신 (실패한 규칙은 건수만 0으로 시각 갱신)
      for (const res of results) {
        totalTrashed += res.trashed;
        // total_trashed 누적: 기존값 + 이번 건수. 동시성 낮은 일 1회 cron이라 select 후 update로 충분하다.
        const { data: prev } = await admin
          .from('gmail_auto_delete_rules')
          .select('total_trashed')
          .eq('id', res.id)
          .single();
        await admin
          .from('gmail_auto_delete_rules')
          .update({
            last_run_at: nowIso,
            total_trashed: (prev?.total_trashed ?? 0) + res.trashed,
            updated_at: nowIso,
          })
          .eq('id', res.id);
      }
      processedUsers++;
    } catch (err) {
      // invalid_grant(재연결 필요)·권한부족 등: 해당 사용자만 건너뛰고 계속 진행
      skipped++;
      failures.push({
        userId,
        error: err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    totalUsersWithRules: rulesByUser.size,
    processedUsers,
    totalTrashed,
    skipped,
    failures: failures.slice(0, 20),
    elapsedMs: Date.now() - startedAt,
  });
}
