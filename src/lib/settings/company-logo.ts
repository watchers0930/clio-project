import type { SupabaseClient } from '@supabase/supabase-js';

export type CompanyLogoPatternDensity = 'sparse' | 'normal' | 'dense';

export interface CompanyLogoSettings {
  patternDensity: CompanyLogoPatternDensity;
}

export interface CompanyLogoContext {
  buffer: Buffer | null;
  patternDensity: CompanyLogoPatternDensity;
  patternSize: string;
}

export const COMPANY_LOGO_BASE_PATH = 'settings/company-logo';
export const COMPANY_LOGO_META_PATH = `${COMPANY_LOGO_BASE_PATH}.json`;
export const COMPANY_LOGO_PATHS = [
  `${COMPANY_LOGO_BASE_PATH}.png`,
  `${COMPANY_LOGO_BASE_PATH}.jpg`,
  `${COMPANY_LOGO_BASE_PATH}.webp`,
];

export const COMPANY_LOGO_PATTERN_SIZES: Record<CompanyLogoPatternDensity, string> = {
  sparse: '64mm',
  normal: '44mm',
  dense: '32mm',
};

export function normalizeCompanyLogoPatternDensity(value: unknown): CompanyLogoPatternDensity {
  return value === 'sparse' || value === 'dense' ? value : 'normal';
}

export function getCompanyLogoPatternSize(density: unknown) {
  return COMPANY_LOGO_PATTERN_SIZES[normalizeCompanyLogoPatternDensity(density)];
}

export async function loadCompanyLogoSettings(adminClient: SupabaseClient): Promise<CompanyLogoSettings> {
  try {
    const { data } = await adminClient.storage.from('files').download(COMPANY_LOGO_META_PATH);
    if (!data) return { patternDensity: 'normal' };

    const parsed = JSON.parse(await data.text()) as Partial<CompanyLogoSettings>;
    return { patternDensity: normalizeCompanyLogoPatternDensity(parsed.patternDensity) };
  } catch {
    return { patternDensity: 'normal' };
  }
}

export async function saveCompanyLogoSettings(adminClient: SupabaseClient, settings: CompanyLogoSettings) {
  const payload = JSON.stringify({
    patternDensity: normalizeCompanyLogoPatternDensity(settings.patternDensity),
  });

  return adminClient.storage
    .from('files')
    .upload(COMPANY_LOGO_META_PATH, new Blob([payload], { type: 'application/json' }), {
      contentType: 'application/json',
      upsert: true,
    });
}

export async function loadCompanyLogoContext(adminClient: SupabaseClient): Promise<CompanyLogoContext> {
  const settings = await loadCompanyLogoSettings(adminClient);
  let buffer: Buffer | null = null;

  for (const path of COMPANY_LOGO_PATHS) {
    try {
      const { data } = await adminClient.storage.from('files').download(path);
      if (data) {
        buffer = Buffer.from(await data.arrayBuffer());
        break;
      }
    } catch {
      // Try the next supported extension.
    }
  }

  return {
    buffer,
    patternDensity: settings.patternDensity,
    patternSize: getCompanyLogoPatternSize(settings.patternDensity),
  };
}
