type Environment = Record<string, string | undefined>;

function parseOrigin(value: string, referer = false): string | null {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return null;
    if (!referer && (url.pathname !== '/' || url.search || url.hash)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function allowedMutationOrigins(env: Environment = process.env) {
  const origins = new Set(['https://clioai.vercel.app']);
  for (const entry of (env.CSRF_ALLOWED_ORIGINS ?? '').split(',')) {
    const origin = parseOrigin(entry);
    if (origin) origins.add(origin);
  }
  // Deployment metadata is trusted configuration; never trust request Host headers.
  const domains = [env.VERCEL_PROJECT_PRODUCTION_URL];
  if (env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'development')
    domains.push(env.VERCEL_URL);
  for (const domain of domains) {
    if (!domain) continue;
    const origin = parseOrigin(`https://${domain.trim()}`);
    if (origin) origins.add(origin);
  }
  if (env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }
  return origins;
}

export function mutationOrigin(headers: Headers): string | null {
  // An explicitly invalid Origin must not fall back to a valid Referer.
  const origin = headers.get('origin');
  if (origin !== null) return parseOrigin(origin);
  return parseOrigin(headers.get('referer') ?? '', true);
}
