/**
 * POST /api/autofill/generate
 * 세션 ID + 사용자 입력값으로 완성 문서를 생성하고 Signed URL 반환
 *
 * Body: { sessionId: string, values: Record<string, string> }
 *   - values: { [fieldKey]: "채울 값" }
 *
 * 응답: { downloadUrl: string, fileName: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import PizZip from 'pizzip';

export const maxDuration = 60;

/** XML 특수문자 이스케이프 */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * DOCX 빈 셀 채우기
 * location 형식: "table:N:row:R:col:C" 또는 "paragraph:N"
 * 단순 접근: 감지된 빈 셀 위치에 w:t 삽입
 */
function fillDocx(buffer: Buffer, fields: DetectedField[], values: Record<string, string>): Buffer {
  const zip = new PizZip(buffer);
  let docXml = zip.file('word/document.xml')?.asText();
  if (!docXml) return buffer;

  // placeholder/underline/bracket 패턴 치환
  for (const field of fields) {
    const val = values[field.key];
    if (!val) continue;

    if (field.type === 'placeholder') {
      // {{필드명}} → 값
      const pattern = field.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      docXml = docXml.replace(new RegExp(`\\{\\{${pattern}\\}\\}`, 'g'), esc(val));
    } else if (field.type === 'underline') {
      // ___ → 값 (첫 번째 매칭)
      docXml = docXml.replace(/_{3,}/, esc(val));
    } else if (field.type === 'bracket') {
      // [ ] 또는 ( ) → 값
      docXml = docXml.replace(/\[\s*\]/, `[${esc(val)}]`);
      docXml = docXml.replace(/\(\s*\)/, `(${esc(val)})`);
    } else if (field.type === 'blank' && field.location.startsWith('table:')) {
      // 빈 테이블 셀: <w:tc>...<w:t></w:t>... 패턴에 값 삽입
      // 위치 기반 정확한 치환은 복잡하므로, 빈 <w:t/> or <w:t></w:t> 첫 매칭에 삽입
      docXml = docXml.replace(/<w:t\s*\/>/, `<w:t>${esc(val)}</w:t>`);
      docXml = docXml.replace(/<w:t><\/w:t>/, `<w:t>${esc(val)}</w:t>`);
    }
  }

  zip.file('word/document.xml', docXml);

  return Buffer.from(
    zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  );
}

/**
 * HWPX 빈 셀 채우기
 */
function fillHwpx(buffer: Buffer, fields: DetectedField[], values: Record<string, string>): Buffer {
  const zip = new PizZip(buffer);

  const sectionFiles = Object.keys(zip.files).filter(
    n => n.startsWith('Contents/section') && n.endsWith('.xml')
  );

  for (const sectionFile of sectionFiles) {
    let xml = zip.file(sectionFile)?.asText();
    if (!xml) continue;

    for (const field of fields) {
      const val = values[field.key];
      if (!val) continue;

      if (field.type === 'placeholder') {
        const pattern = field.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        xml = xml.replace(new RegExp(`\\{\\{${pattern}\\}\\}`, 'g'), esc(val));
      } else if (field.type === 'underline') {
        xml = xml.replace(/_{3,}/, esc(val));
      } else if (field.type === 'bracket') {
        xml = xml.replace(/\[\s*\]/, `[${esc(val)}]`);
        xml = xml.replace(/\(\s*\)/, `(${esc(val)})`);
      } else if (field.type === 'blank') {
        // 빈 <hp:t></hp:t> 첫 매칭에 값 삽입
        xml = xml.replace(/<hp:t><\/hp:t>/, `<hp:t>${esc(val)}</hp:t>`);
        xml = xml.replace(/<hp:t\s*\/>/, `<hp:t>${esc(val)}</hp:t>`);
      }
    }

    zip.file(sectionFile, xml);
  }

  // HWPX ZIP 규격: mimetype은 STORE, 나머지 DEFLATE
  const mimetypeContent = zip.file('mimetype')?.asText() ?? 'application/hwp+zip';

  return Buffer.from(
    zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
  );
  // mimetype STORE 처리는 PizZip에서 직접 지원하지 않으므로,
  // 생성 후 별도 패치가 필요하지만 실용적으로는 DEFLATE로도 대부분 동작함
  void mimetypeContent;
}

interface DetectedField {
  key: string;
  label: string;
  type: 'blank' | 'placeholder' | 'underline' | 'bracket';
  location: string;
  context?: string;
  inferredName?: string;
  confidence: 'high' | 'medium' | 'low';
  autoMapped?: boolean;
  autoValue?: string;
}

interface AutofillSession {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  detected_fields: DetectedField[];
  output_path: string | null;
  status: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  let body: { sessionId: string; values: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const { sessionId, values } = body;
  if (!sessionId || typeof values !== 'object') {
    return NextResponse.json({ error: 'sessionId와 values가 필요합니다.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // 세션 조회
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = await (admin as any)
    .from('autofill_sessions')
    .select('id, user_id, file_name, file_type, detected_fields, output_path, status')
    .eq('id', sessionId)
    .single() as { data: AutofillSession | null };

  if (!session || session.user_id !== userId) {
    return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (!session.output_path) {
    return NextResponse.json({ error: '원본 파일 경로가 없습니다. 다시 분석해 주세요.' }, { status: 422 });
  }

  // 원본 파일 다운로드
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fileData, error: downloadError } = await (admin as any).storage
    .from('files')
    .download(session.output_path) as { data: Blob | null; error: unknown };

  if (downloadError || !fileData) {
    console.error('[autofill/generate] Storage download error:', downloadError);
    return NextResponse.json({ error: '원본 파일을 불러올 수 없습니다.' }, { status: 502 });
  }

  const fileBuffer = Buffer.from(await fileData.arrayBuffer());
  const fields: DetectedField[] = session.detected_fields ?? [];

  // 자동 매핑값 values에 병합 (사용자가 덮어쓰지 않은 것만)
  const mergedValues: Record<string, string> = {};
  for (const field of fields) {
    if (field.autoMapped && field.autoValue && !values[field.key]) {
      mergedValues[field.key] = field.autoValue;
    }
  }
  const finalValues = { ...mergedValues, ...values };

  // 파일 타입별 채우기
  let filledBuffer: Buffer;
  const ext = session.file_type.toLowerCase();
  if (ext === 'docx') {
    filledBuffer = fillDocx(fileBuffer, fields, finalValues);
  } else if (ext === 'hwpx' || ext === 'hwp') {
    filledBuffer = fillHwpx(fileBuffer, fields, finalValues);
  } else {
    return NextResponse.json({ error: '지원하지 않는 파일 형식입니다.' }, { status: 400 });
  }

  // 완성 파일 Storage에 저장
  const outputFileName = session.file_name.replace(/(\.[^.]+)$/, '_autofilled$1');
  const outputPath = `autofill-output/${userId}/${sessionId}/${outputFileName}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: uploadError } = await (admin as any).storage
    .from('files')
    .upload(outputPath, filledBuffer, {
      contentType: ext === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/hwp+zip',
      upsert: true,
    });

  if (uploadError) {
    console.error('[autofill/generate] Upload error:', uploadError);
    return NextResponse.json({ error: '완성 파일 저장에 실패했습니다.' }, { status: 500 });
  }

  // Signed URL 생성 (1시간)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: signedData } = await (admin as any).storage
    .from('files')
    .createSignedUrl(outputPath, 3600) as { data: { signedUrl: string } | null };

  if (!signedData?.signedUrl) {
    return NextResponse.json({ error: 'Signed URL 생성에 실패했습니다.' }, { status: 500 });
  }

  // 세션 완료 처리 + filled_values 저장
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('autofill_sessions')
    .update({ status: 'completed', filled_values: finalValues })
    .eq('id', sessionId);

  return NextResponse.json({
    downloadUrl: signedData.signedUrl,
    fileName: outputFileName,
  });
}
