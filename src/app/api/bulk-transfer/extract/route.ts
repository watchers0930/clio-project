import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { validateFile } from '@/lib/utils/sanitize';
import { extractText } from '@/lib/ai/extract-text';
import { extractAccountsFromPdf, extractAccountsFromText } from '@/lib/bulk-transfer/extract-accounts';
import type { AccountExtractResult } from '@/lib/bulk-transfer/extract-accounts';

export const maxDuration = 60;

// POST — PDF 등 문서 업로드 → 텍스트/OCR 추출 → AI 계좌 추출 (등록은 하지 않음, 후보만 반환)
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: '파일을 읽을 수 없습니다.' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: '파일을 첨부해 주세요.' }, { status: 400 });

  const invalid = validateFile(file);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const isPdfOrImage =
    file.type === 'application/pdf' ||
    file.type.startsWith('image/') ||
    ['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(ext);

  let result: AccountExtractResult;
  try {
    const buffer = await file.arrayBuffer();
    if (isPdfOrImage) {
      // PDF/이미지: Vision으로 직접 추출 (범용 OCR 거부 회피 + 표 정확도)
      result = await extractAccountsFromPdf(buffer, file.type || 'application/pdf');
    } else {
      // 텍스트 계열 문서: 텍스트 추출 후 추출
      const text = await extractText(buffer, file.type, file.name);
      if (!text.trim()) {
        return NextResponse.json({ error: '문서에서 내용을 추출하지 못했습니다.' }, { status: 422 });
      }
      result = await extractAccountsFromText(text);
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '문서 분석에 실패했습니다.' },
      { status: 422 },
    );
  }
  if (result.accounts.length === 0) {
    return NextResponse.json(
      { error: '문서에서 입금 계좌를 찾지 못했습니다. 직접 입력해 주세요.', data: result },
      { status: 200 },
    );
  }

  return NextResponse.json({ data: result });
}
