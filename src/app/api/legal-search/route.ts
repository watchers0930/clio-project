/**
 * GET /api/legal-search?query=키워드&display=5
 * 국가법령정보공단 Open API 프록시 (서버 전용, LAW_API_KEY 클라이언트 노출 금지)
 * 5분 인메모리 캐시 적용
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

export const maxDuration = 30;

// 5분 인메모리 캐시
const cache = new Map<string, { data: LawResult[]; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface LawResult {
  lawName: string;
  lawId: string;
  articleNo: string;
  articleContent: string;
  promulgationDate: string;
}

function parseXmlLawItems(xml: string): LawResult[] {
  const results: LawResult[] = [];

  // law.go.kr XML 응답 파싱 (간단한 정규식 기반)
  const itemRegex = /<law>([\s\S]*?)<\/law>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const get = (tag: string) => {
      const m = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(item);
      return m ? m[1].trim() : '';
    };

    results.push({
      lawName: get('법령명한글') || get('법령명'),
      lawId: get('법령ID') || get('법령아이디'),
      articleNo: get('조문번호') || '',
      articleContent: get('조문내용') || get('내용') || '',
      promulgationDate: get('공포일자') || '',
    });
  }

  // JSON 응답도 처리
  if (results.length === 0) {
    try {
      const json = JSON.parse(xml);
      const items = json?.LawSearch?.law ?? json?.법령목록?.법령 ?? [];
      for (const item of (Array.isArray(items) ? items : [items])) {
        results.push({
          lawName: item['법령명한글'] ?? item['법령명'] ?? '',
          lawId: item['법령ID'] ?? '',
          articleNo: item['조문번호'] ?? '',
          articleContent: item['조문내용'] ?? item['내용'] ?? '',
          promulgationDate: item['공포일자'] ?? '',
        });
      }
    } catch {
      // JSON 파싱 실패 무시
    }
  }

  return results;
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }
  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query')?.trim();
  const display = Math.min(Number(searchParams.get('display') ?? '5'), 10);

  if (!query) {
    return NextResponse.json({ error: '검색어를 입력해 주세요.' }, { status: 400 });
  }

  const apiKey = process.env.LAW_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: '법령 API가 설정되지 않았습니다.' }, { status: 503 });
  }

  // 캐시 확인
  const cacheKey = `${query}:${display}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ results: cached.data, cached: true });
  }

  // law.go.kr API 호출
  // OC(인증키), target=법령, type=XML, query=검색어, display=건수
  const url = new URL('https://www.law.go.kr/DRF/lawSearch.do');
  url.searchParams.set('OC', apiKey);
  url.searchParams.set('target', '법령');
  url.searchParams.set('type', 'XML');
  url.searchParams.set('query', query);
  url.searchParams.set('display', String(display));
  url.searchParams.set('page', '1');

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error('[legal-search] law.go.kr 오류:', response.status);
      return NextResponse.json({ error: '법령 API 호출에 실패했습니다.' }, { status: 502 });
    }

    const text = await response.text();
    const results = parseXmlLawItems(text);

    // 캐시 저장
    cache.set(cacheKey, { data: results, expiry: Date.now() + CACHE_TTL_MS });

    return NextResponse.json({ results, cached: false });
  } catch (err) {
    console.error('[legal-search] fetch error:', err);
    return NextResponse.json({ error: '법령 검색 중 오류가 발생했습니다.' }, { status: 502 });
  }
}
