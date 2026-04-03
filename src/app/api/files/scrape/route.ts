/**
 * POST /api/files/scrape
 * 쇼핑몰 카테고리 URL에서 상품 링크를 수집하여 CSV 파일로 저장
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { extractProductLinks, productLinksToCsv } from '@/lib/utils/extract-product-links';
import { randomUUID } from 'crypto';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const url = body?.url;
    const departmentId = body?.department_id ?? null;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'URL을 입력해주세요.' }, { status: 400 });
    }

    // URL 유효성 검사
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json({ success: false, error: '올바른 URL을 입력해주세요. (http:// 또는 https://)' }, { status: 400 });
    }

    // 대상 페이지 fetch
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let html: string;
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      if (!res.ok) {
        return NextResponse.json({ success: false, error: `페이지 접근 실패 (HTTP ${res.status})` }, { status: 502 });
      }
      html = await res.text();
    } catch (err) {
      const message = err instanceof Error && err.name === 'AbortError'
        ? '페이지 응답 시간이 초과되었습니다.'
        : 'URL에 접근할 수 없습니다.';
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    } finally {
      clearTimeout(timeout);
    }

    // 상품 링크 추출
    const links = extractProductLinks(html, url);

    if (links.length === 0) {
      return NextResponse.json({
        success: true,
        data: { linkCount: 0 },
        message: '상품 링크를 찾을 수 없습니다. 카테고리 페이지 URL인지 확인해주세요.',
      });
    }

    // CSV 생성
    const csv = productLinksToCsv(links);
    const buffer = Buffer.from(csv, 'utf-8');

    // 파일명 생성
    const domain = parsedUrl.hostname.replace(/^www\./, '');
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const fileName = `${domain}_상품링크_${timestamp}.csv`;

    // Supabase Storage 업로드
    const storagePath = `uploads/${departmentId ?? 'general'}/${randomUUID()}.csv`;
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(storagePath, buffer, { contentType: 'text/csv', upsert: false });

    if (uploadError) {
      console.error('[scrape] storage upload:', uploadError.message);
      return NextResponse.json({ success: false, error: '파일 저장에 실패했습니다.' }, { status: 500 });
    }

    // files 테이블 INSERT
    const { data, error } = await supabase.from('files').insert({
      name: fileName,
      type: 'text/csv',
      size: buffer.length,
      department_id: departmentId,
      uploaded_by: authUserId,
      status: 'processing',
      storage_path: storagePath,
    }).select().single();

    if (error) {
      console.error('[scrape] file insert:', error.message);
      return NextResponse.json({ success: false, error: '파일 정보 저장에 실패했습니다.' }, { status: 500 });
    }

    // audit log
    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: 'file.scrape',
      target_type: 'file',
      target_id: data.id,
      details: { url, domain, linkCount: links.length, fileName },
    }).then(() => {}, () => {});

    // 백그라운드 처리 파이프라인 트리거
    const baseUrl = request.nextUrl.origin;
    const internalSecret = process.env.INTERNAL_API_SECRET || '';
    fetch(`${baseUrl}/api/files/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': internalSecret },
      body: JSON.stringify({ fileId: data.id }),
    }).then(() => {}, (err) => console.error('[scrape] process pipeline error:', err));

    return NextResponse.json({
      success: true,
      data: { id: data.id, name: fileName, linkCount: links.length },
    }, { status: 201 });
  } catch (err) {
    console.error('[scrape] error:', err);
    return NextResponse.json({ success: false, error: '상품 링크 수집 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
