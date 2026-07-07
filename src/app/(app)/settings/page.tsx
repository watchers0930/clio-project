import { SettingsPageShell } from '@/components/settings/settings-page-shell';

interface Props {
  searchParams: Promise<Record<string, string>>;
}

export default async function SettingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = params.tab as 'departments' | 'users' | 'signature' | 'templates' | 'menus' | 'gmail' | undefined;
  return <SettingsPageShell initialTab={tab ?? 'menus'} gmailSuccess={params.success} gmailError={params.error} gmailMsg={params.msg} />;
}
