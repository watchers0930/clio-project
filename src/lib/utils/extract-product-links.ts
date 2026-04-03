/**
 * 쇼핑몰 카테고리 페이지에서 상품 링크를 추출하는 유틸리티
 */

import * as cheerio from 'cheerio';

export interface ProductLink {
  name: string;
  url: string;
}

// 상품 상세 페이지를 식별하는 경로 패턴
const PATH_PATTERNS = [
  /\/products?\//i,
  /\/goods\//i,
  /\/items?\//i,
  /\/detail\//i,
  /\/view\//i,
  /\/shop\/shopdetail/i,
  /\/goods\/goods_view/i,
  /\/m\/product\//i,
  /\/shop\/goods\/goods_view/i,
  /\/disp\/itemInfo/i,
  /\/app\/goods\//i,
  /\/product-detail/i,
  /\/item-detail/i,
  /\/pd\//i,
  /\/prd\//i,
];

// 상품 ID를 포함하는 쿼리 파라미터 패턴
const QUERY_PATTERNS = [
  /goodsNo=/i,
  /productNo=/i,
  /itemId=/i,
  /product_id=/i,
  /goods_seq=/i,
  /item_no=/i,
  /prdtNo=/i,
  /goodscode=/i,
  /product_code=/i,
  /branduid=/i,
  /idx=/i,
];

// 제거할 추적 파라미터
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'NaPm', '_pos', 'n_media', 'n_query',
  'n_rank', 'n_ad_group', 'n_ad', 'n_keyword_id', 'n_keyword',
  'n_campaign_type', 'n_ad_group_type', 'spm', 'scm',
]);

const MAX_LINKS = 1000;

function cleanUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const cleaned = new URLSearchParams();
    u.searchParams.forEach((value, key) => {
      if (!TRACKING_PARAMS.has(key)) {
        cleaned.set(key, value);
      }
    });
    u.search = cleaned.toString() ? `?${cleaned.toString()}` : '';
    u.hash = '';
    return u.toString();
  } catch {
    return urlStr;
  }
}

function isProductUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    // 경로 패턴 검사
    for (const pattern of PATH_PATTERNS) {
      if (pattern.test(u.pathname)) return true;
    }
    // 쿼리 파라미터 패턴 검사
    const search = u.search;
    for (const pattern of QUERY_PATTERNS) {
      if (pattern.test(search)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function extractProductLinks(html: string, baseUrl: string): ProductLink[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const results: ProductLink[] = [];

  $('a[href]').each((_, el) => {
    if (results.length >= MAX_LINKS) return false;

    const href = $(el).attr('href');
    if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, baseUrl).toString();
    } catch {
      return;
    }

    // http/https만 허용
    if (!absoluteUrl.startsWith('http')) return;

    if (!isProductUrl(absoluteUrl)) return;

    const cleaned = cleanUrl(absoluteUrl);
    if (seen.has(cleaned)) return;
    seen.add(cleaned);

    // 상품명 추출: 앵커 텍스트 → img alt → fallback
    let name = $(el).text().trim();
    if (!name) {
      const img = $(el).find('img');
      name = img.attr('alt')?.trim() ?? '';
    }
    if (!name) {
      name = `상품 ${results.length + 1}`;
    }
    // 이름 정리: 줄바꿈/탭 → 공백, 200자 제한
    name = name.replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').slice(0, 200);

    results.push({ name, url: cleaned });
  });

  return results;
}

export function productLinksToCsv(links: ProductLink[]): string {
  const BOM = '\uFEFF';
  const header = '상품명,상품URL';
  const rows = links.map((link) => {
    const escapedName = `"${link.name.replace(/"/g, '""')}"`;
    const escapedUrl = `"${link.url.replace(/"/g, '""')}"`;
    return `${escapedName},${escapedUrl}`;
  });
  return BOM + [header, ...rows].join('\n');
}
