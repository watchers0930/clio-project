import { NextResponse } from 'next/server';
import { loadCompanySeal, COMPANY_SEAL_PATHS } from '@/lib/settings/company-seal';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

// 임시 디버그: 배포 런타임에서 회사 직인 로드 여부 확인
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const out: Record<string, unknown> = {
    urlTail: JSON.stringify(url.slice(-8)),
    urlHasNewline: /\n|\\n/.test(url),
    sealPaths: COMPANY_SEAL_PATHS,
  };
  try {
    const buf = await loadCompanySeal();
    out.sealLoaded = !!buf;
    out.sealSize = buf?.length ?? 0;
  } catch (e) {
    out.sealError = e instanceof Error ? e.message : String(e);
  }
  // 직접 다운로드 시도
  try {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin.storage.from('files').download('settings/company-seal.png');
    out.directDownload = data ? `ok ${(await data.arrayBuffer()).byteLength}` : `null err=${error?.message}`;
  } catch (e) {
    out.directError = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json(out);
}
