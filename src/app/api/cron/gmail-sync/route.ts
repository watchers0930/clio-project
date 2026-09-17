import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { syncGmailForUser } from '@/lib/google/gmail-sync';

// Pro 플랜: 최대 300초. 연결 사용자를 순차 동기화하며 전체 예산 내에서 처리.
export const maxDuration = 300;

const OVERALL_BUDGET_MS = 280_000; // 전체 실행 예산 (300초 제한 대비 여유)
const PER_USER_BUDGET_MS = 40_000; // 사용자 1인당 동기화 예산

// GET /api/cron/gmail-sync — Vercel Cron 전용. Gmail 연결된 전체 사용자 정기 증분 동기화.
// Vercel Cron은 CRON_SECRET env가 있으면 Authorization: Bearer <CRON_SECRET> 를 자동 첨부한다.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();

  // 동기화 활성 사용자만 대상. 오래 동기화 안 된 사용자부터 처리(예산 초과 시 최신 사용자가 다음 회차로).
  const { data: conns } = await admin
    .from('user_google_connections')
    .select('user_id, last_synced_at')
    .eq('sync_enabled', true)
    .order('last_synced_at', { ascending: true, nullsFirst: true });

  const users = (conns ?? []).map((c: { user_id: string }) => c.user_id);

  const startedAt = Date.now();
  let processed = 0;
  let totalSynced = 0;
  let skipped = 0;
  const failures: Array<{ userId: string; error: string }> = [];

  for (const userId of users) {
    if (Date.now() - startedAt > OVERALL_BUDGET_MS) break;
    try {
      const result = await syncGmailForUser(admin, userId, { budgetMs: PER_USER_BUDGET_MS });
      totalSynced += result.synced;
      processed++;
    } catch (err) {
      // invalid_grant(재연결 필요)·권한부족 등: 해당 사용자만 건너뛰고 나머지 계속 진행
      skipped++;
      failures.push({
        userId,
        error: err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    totalUsers: users.length,
    processed,
    totalSynced,
    skipped,
    failures: failures.slice(0, 20),
    elapsedMs: Date.now() - startedAt,
  });
}
