import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * 회사 공용 직인(도장) 이미지 — 재직증명서 등 회사 발급 문서에 사용.
 * 고정 경로에 저장(회사 로고와 동일 방식).
 */
export const COMPANY_SEAL_BASE_PATH = 'settings/company-seal';
export const COMPANY_SEAL_PATHS = [
  `${COMPANY_SEAL_BASE_PATH}.png`,
  `${COMPANY_SEAL_BASE_PATH}.jpg`,
  `${COMPANY_SEAL_BASE_PATH}.webp`,
];

/** 회사 직인 이미지 버퍼 로드 (없으면 null) */
export async function loadCompanySealBuffer(adminClient: SupabaseClient): Promise<Buffer | null> {
  for (const path of COMPANY_SEAL_PATHS) {
    try {
      const { data } = await adminClient.storage.from('files').download(path);
      if (data) return Buffer.from(await data.arrayBuffer());
    } catch {
      // 다음 확장자 시도
    }
  }
  return null;
}

/** admin 클라이언트를 자체 생성해 회사 직인 버퍼 로드 (생성 라우트용) */
export async function loadCompanySeal(): Promise<Buffer | null> {
  return loadCompanySealBuffer(createAdminSupabaseClient());
}
