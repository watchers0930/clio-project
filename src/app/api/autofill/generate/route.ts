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
 * XML 내에서 tagName 태그의 시작/끝 인덱스 배열 반환 (중첩 고려)
 * 예: [[ 10, 50 ], [ 55, 90 ], ...]
 */
function findAllElementRanges(xml: string, tagName: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  let pos = 0;

  while (pos < xml.length) {
    const start = xml.indexOf(openTag, pos);
    if (start === -1) break;

    // 태그명 뒤가 '>' 또는 ' '인지 확인 (부분 일치 방지)
    const afterName = xml[start + openTag.length];
    if (afterName !== '>' && afterName !== ' ' && afterName !== '\n' && afterName !== '\r' && afterName !== '/') {
      pos = start + 1;
      continue;
    }

    // 중첩 고려해 닫는 태그 찾기
    let depth = 1;
    let searchPos = start + openTag.length;

    while (depth > 0 && searchPos < xml.length) {
      const nextOpen = xml.indexOf(openTag, searchPos);
      const nextClose = xml.indexOf(closeTag, searchPos);

      if (nextClose === -1) break; // 닫는 태그 없음 → 포기

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // 중첩 열기 태그 — 진짜 태그인지 확인
        const ac = xml[nextOpen + openTag.length];
        if (ac === '>' || ac === ' ' || ac === '\n' || ac === '\r' || ac === '/') {
          depth++;
          searchPos = nextOpen + 1;
        } else {
          searchPos = nextOpen + 1;
        }
      } else {
        depth--;
        searchPos = nextClose + closeTag.length;
        if (depth === 0) {
          ranges.push([start, searchPos]);
        }
      }
    }

    pos = start + 1;
  }

  return ranges;
}

/**
 * 특정 table:N:row:R:col:C 위치에 값을 채운 XML 반환
 * 위치를 정확히 찾아 해당 셀의 첫 번째 빈 텍스트 노드에만 값 삽입
 */
function fillCellAtLocation(
  xml: string,
  location: string,
  value: string,
  tableTag: string,
  rowTag: string,
  cellTag: string,
  textTag: string,
): string {
  const m = location.match(/^table:(\d+):row:(\d+):col:(\d+)$/);
  if (!m) return xml;

  const tblIdx = parseInt(m[1]);
  const rowIdx = parseInt(m[2]);
  const colIdx = parseInt(m[3]);

  const tableRanges = findAllElementRanges(xml, tableTag);
  if (tblIdx >= tableRanges.length) return xml;

  const [tblStart, tblEnd] = tableRanges[tblIdx];
  const tableXml = xml.slice(tblStart, tblEnd);

  const rowRanges = findAllElementRanges(tableXml, rowTag);
  if (rowIdx >= rowRanges.length) return xml;

  const [rowStart, rowEnd] = rowRanges[rowIdx];
  const rowXml = tableXml.slice(rowStart, rowEnd);

  const cellRanges = findAllElementRanges(rowXml, cellTag);
  if (colIdx >= cellRanges.length) return xml;

  const [cellStart, cellEnd] = cellRanges[colIdx];
  const cellXml = rowXml.slice(cellStart, cellEnd);

  // 셀 내부의 빈 텍스트 노드 교체 (첫 번째 매칭)
  let filledCell = cellXml;
  const emptyTextSelfClose = new RegExp(`<${textTag}\\s*/>`);
  const emptyTextClose = new RegExp(`<${textTag}></${textTag}>`);

  if (emptyTextSelfClose.test(filledCell)) {
    filledCell = filledCell.replace(emptyTextSelfClose, `<${textTag}>${esc(value)}</${textTag}>`);
  } else if (emptyTextClose.test(filledCell)) {
    filledCell = filledCell.replace(emptyTextClose, `<${textTag}>${esc(value)}</${textTag}>`);
  } else {
    // 기존 텍스트가 있는 경우 (재분석 불일치) — 건드리지 않음
    return xml;
  }

  // 내부에서 바깥쪽으로 재조합
  const filledRow = rowXml.slice(0, cellStart) + filledCell + rowXml.slice(cellEnd);
  const filledTable = tableXml.slice(0, rowStart) + filledRow + tableXml.slice(rowEnd);
  return xml.slice(0, tblStart) + filledTable + xml.slice(tblEnd);
}

/**
 * DOCX 빈 셀 채우기 — 위치 기반 정확한 치환
 */
function fillDocx(buffer: Buffer, fields: DetectedField[], values: Record<string, string>): Buffer {
  const zip = new PizZip(buffer);
  let docXml = zip.file('word/document.xml')?.asText();
  if (!docXml) return buffer;

  // blank 필드를 위치 역순(bottom-right → top-left)으로 정렬해 인덱스 shift 방지
  const sortedFields = [...fields].sort((a, b) => {
    const parsePos = (loc: string) => {
      const m = loc.match(/table:(\d+):row:(\d+):col:(\d+)/);
      return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [999, 999, 999];
    };
    const [ta, ra, ca] = parsePos(a.location);
    const [tb, rb, cb] = parsePos(b.location);
    if (ta !== tb) return tb - ta;
    if (ra !== rb) return rb - ra;
    return cb - ca;
  });

  for (const field of sortedFields) {
    const val = values[field.key];
    if (!val) continue;

    if (field.type === 'placeholder') {
      const pattern = field.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      docXml = docXml.replace(new RegExp(`\\{\\{${pattern}\\}\\}`, 'g'), esc(val));
    } else if (field.type === 'underline') {
      docXml = docXml.replace(/_{3,}/, esc(val));
    } else if (field.type === 'bracket') {
      docXml = docXml.replace(/\[\s*\]/, `[${esc(val)}]`);
      docXml = docXml.replace(/\(\s*\)/, `(${esc(val)})`);
    } else if (field.type === 'blank' && field.location.startsWith('table:')) {
      docXml = fillCellAtLocation(docXml, field.location, val, 'w:tbl', 'w:tr', 'w:tc', 'w:t');
    }
  }

  zip.file('word/document.xml', docXml);

  return Buffer.from(
    zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  );
}

/**
 * HWPX 빈 셀 채우기 — 위치 기반 정확한 치환 + mimetype STORE 처리
 */
function fillHwpx(buffer: Buffer, fields: DetectedField[], values: Record<string, string>): Buffer {
  const zip = new PizZip(buffer);

  const sectionFiles = Object.keys(zip.files).filter(
    n => n.startsWith('Contents/section') && n.endsWith('.xml')
  );

  // blank 필드를 위치 역순으로 정렬
  const sortedFields = [...fields].sort((a, b) => {
    const parsePos = (loc: string) => {
      const m = loc.match(/table:(\d+):row:(\d+):col:(\d+)/);
      return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [999, 999, 999];
    };
    const [ta, ra, ca] = parsePos(a.location);
    const [tb, rb, cb] = parsePos(b.location);
    if (ta !== tb) return tb - ta;
    if (ra !== rb) return rb - ra;
    return cb - ca;
  });

  for (const sectionFile of sectionFiles) {
    let xml = zip.file(sectionFile)?.asText();
    if (!xml) continue;

    for (const field of sortedFields) {
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
      } else if (field.type === 'blank' && field.location.startsWith('table:')) {
        xml = fillCellAtLocation(xml, field.location, val, 'hp:tbl', 'hp:tr', 'hp:tc', 'hp:t');
      }
    }

    zip.file(sectionFile, xml);
  }

  // HWPX ZIP 규격: mimetype은 반드시 STORE(비압축), 나머지 DEFLATE
  // PizZip generate 후 mimetype 엔트리를 재작성
  const mimetypeContent = zip.file('mimetype')?.asText() ?? 'application/hwp+zip';

  // 1차 DEFLATE 생성 (mimetype 포함)
  const deflateBuf = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // 2차: PizZip으로 다시 열어 mimetype만 STORE로 재저장
  const zip2 = new PizZip(deflateBuf);
  zip2.file('mimetype', mimetypeContent, { compression: 'STORE' });

  return Buffer.from(
    zip2.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
  );
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

  // 자동 매핑값 병합 (사용자가 덮어쓰지 않은 것만)
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

  // 세션 완료 처리
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
