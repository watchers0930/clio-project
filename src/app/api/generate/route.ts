/**
 * POST /api/generate
 * 멀티포맷 문서 생성 통합 엔드포인트
 *
 * 요청: { templateId, sourceFileIds[], instructions, outputFormat }
 * 응답:
 *   - DOCX/HWPX: 마크다운 콘텐츠 + 문서 DB 저장
 *   - XLSX/PPTX: 구조화 JSON + 파일 생성 → Supabase Storage 업로드 → URL 반환
 *   - PDF: HTML 콘텐츠 반환 (클라이언트 print-to-pdf)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { extractText, extractXlsxStructured } from '@/lib/ai/extract-text';
import { generateForFormat } from '@/lib/ai/generate-document';
import { renderDocument } from '@/lib/renderers';
import type { OutputFormat, CorporateTheme } from '@/lib/renderers/types';
import { DEFAULT_THEME } from '@/lib/renderers/types';

const FONT_MAP: Record<string, string> = {
  '맑은 고딕': 'Malgun Gothic',
  '나눔고딕': 'NanumGothic',
  '바탕': 'Batang',
  '돋움': 'Dotum',
  '굴림': 'Gulim',
  '나눔명조': 'NanumMyeongjo',
  'Arial': 'Arial',
  'Times New Roman': 'Times New Roman',
};

export const maxDuration = 60;

/**
 * 같은 섹션(연속 행)의 내용을 첫 셀에 합치고 나머지 비우기.
 * AI가 행별로 분산 채우는 문제를 프로그래밍으로 보정.
 * 연속 행 판정: emptyCells를 (tableIndex, colIndex)별로 그룹핑 후 rowIndex 연속 여부 확인.
 * 섹션 헤더(비어있지 않은 행)가 있으면 자연스럽게 그룹이 끊어짐.
 */
/**
 * 같은 테이블+같은 열의 빈 셀 내용을 첫 셀로 합치고 나머지 비우기.
 * 연속행 여부 무관 — 같은 (tableIndex, colIndex)면 무조건 합침.
 */
function consolidateSectionCells(
  fd: Record<string, string>,
  emptyCells: Array<{ fieldId: string; tableIndex: number; rowIndex: number; colIndex: number }>,
) {
  const groups = new Map<string, Array<{ fieldId: string; rowIndex: number }>>();

  for (const cell of emptyCells) {
    const key = `${cell.tableIndex}_${cell.colIndex}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ fieldId: cell.fieldId, rowIndex: cell.rowIndex });
  }

  for (const [, cells] of groups) {
    if (cells.length <= 1) continue;
    cells.sort((a, b) => a.rowIndex - b.rowIndex);

    const merged = cells
      .map(c => fd[c.fieldId] || '')
      .filter(v => v.trim() !== '')
      .join('\n');

    fd[cells[0].fieldId] = merged;
    for (let i = 1; i < cells.length; i++) {
      fd[cells[i].fieldId] = '';
    }
  }
}

const VALID_FORMATS: OutputFormat[] = ['docx', 'pdf', 'hwpx', 'xlsx', 'pptx'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, sourceFileIds, instructions, outputFormat = 'docx', font, customStructure, contractFormData } = body;

    // 폰트 테마 생성
    const fontParam = typeof font === 'string' ? font : '맑은 고딕';
    const theme: CorporateTheme = {
      ...DEFAULT_THEME,
      fontFamily: fontParam,
      fontFamilyEn: FONT_MAP[fontParam] ?? 'Malgun Gothic',
    };

    if (!templateId && !customStructure) {
      return NextResponse.json({ error: '템플릿을 선택하거나 문서 구조를 입력해주세요.' }, { status: 400 });
    }

    let format = outputFormat as OutputFormat;
    if (!VALID_FORMATS.includes(format)) {
      return NextResponse.json({ error: `지원하지 않는 포맷: ${outputFormat}` }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 사용자 정보 조회 (이름, 부서, 직급)
    const { data: userData } = await supabase
      .from('users')
      .select('name, position, departments:department_id(name)')
      .eq('id', authUserId)
      .single();
    const userName = (userData as Record<string, unknown>)?.name as string ?? '';
    const userPosition = (userData as Record<string, unknown>)?.position as string ?? '';
    const userDept = ((userData as Record<string, unknown>)?.departments as { name: string } | null)?.name ?? '';

    // 템플릿 조회 (직접 작성 모드에서는 건너뜀)
    let tmpl: { name: string; content: string | null; description: string | null; placeholders: string[] | null; template_file_id: string | null } | null = null;
    if (templateId) {
      const { data } = await supabase
        .from('templates')
        .select('name, content, description, placeholders, template_file_id')
        .eq('id', templateId)
        .single();
      tmpl = data as typeof tmpl;
    }

    const templateName = tmpl?.name ?? (customStructure ? '직접 작성 문서' : '문서');

    // 소스 파일 텍스트 추출
    const sourceChunks: string[] = [];
    if (sourceFileIds?.length) {
      const { data: srcFiles } = await supabase
        .from('files')
        .select('id, name, type, storage_path')
        .in('id', sourceFileIds);

      for (const sf of (srcFiles ?? [])) {
        if (!sf.storage_path) continue;
        try {
          const { data: blob } = await supabase.storage.from('files').download(sf.storage_path);
          if (blob) {
            const buf = await blob.arrayBuffer();
            const text = await extractText(buf, sf.type ?? '', sf.name);
            if (text.trim()) sourceChunks.push(text.slice(0, 8000));
          }
        } catch (e) {
          console.error(`[generate] extract source ${sf.name}:`, e);
        }
      }
    }

    // 템플릿 양식 파일 텍스트 추출 + 바이너리 보존
    let templateFileText: string | null = null;
    let templateBuffer: Buffer | null = null;
    if (tmpl?.template_file_id) {
      const { data: tplFile } = await supabase
        .from('files')
        .select('name, type, storage_path')
        .eq('id', tmpl.template_file_id)
        .single();

      if (tplFile?.storage_path) {
        try {
          const { data: blob } = await supabase.storage.from('files').download(tplFile.storage_path);
          if (blob) {
            const buf = await blob.arrayBuffer();
            // 바이너리 원본을 깊은 복사로 보존 (Uint8Array로 독립 메모리 확보)
            templateBuffer = Buffer.from(new Uint8Array(buf));
            // 텍스트 추출용 별도 복사본
            const extractBuf = new Uint8Array(buf).buffer;
            const ext = tplFile.name.split('.').pop()?.toLowerCase() ?? '';
            if (ext === 'xlsx' && format === 'xlsx') {
              templateFileText = await extractXlsxStructured(extractBuf);
            } else {
              templateFileText = await extractText(extractBuf, tplFile.type ?? '', tplFile.name);
            }
          }
        } catch (e) {
          console.error(`[generate] extract template:`, e);
        }
      }
    }

    // 템플릿 파일 확장자와 출력 포맷 불일치 시 자동 보정
    if (tmpl?.template_file_id && templateBuffer) {
      const { data: tplFileCheck } = await supabase.from('files').select('name').eq('id', tmpl.template_file_id).single();
      const tplExt = tplFileCheck?.name?.split('.').pop()?.toLowerCase() ?? '';
      if (tplExt === 'hwpx' && format === 'docx') {
        format = 'hwpx';
        console.log('[generate] 포맷 자동 보정: docx → hwpx (템플릿 파일이 HWPX)');
      } else if (tplExt === 'docx' && format === 'hwpx') {
        format = 'docx';
        console.log('[generate] 포맷 자동 보정: hwpx → docx (템플릿 파일이 DOCX)');
      }
    }

    // 자동 채울 메타데이터 생성
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const reportNo = `${todayStr.replace(/-/g, '')}-${String(Math.floor(Math.random() * 90) + 10)}-001`;
    const userMeta = `작성일자: ${todayStr}\n보고번호: ${reportNo}\n작성자: ${userName}\n부서명: ${userDept}`;
    const enrichedInstructions = instructions
      ? `${userMeta}\n\n${instructions}`
      : userMeta;

    // ── 계약서 직접 치환 경로 (AI 미사용) ──
    if (contractFormData && typeof contractFormData === 'object' && Object.keys(contractFormData).length > 0 && templateBuffer) {
      const { isContractTemplate } = await import('@/lib/contract-fields');
      if (isContractTemplate(templateName)) {
        const { renderSystemContract } = await import('@/lib/renderers/contract-renderer');
        const dateStr = todayStr;
        const title = `${templateName} (${dateStr} 생성)`;

        console.log('[generate] 계약서 직접 치환 시작:', templateName, 'buffer:', templateBuffer.length, 'bytes, ZIP magic:', templateBuffer[0] === 0x50 && templateBuffer[1] === 0x4B ? 'OK' : 'FAIL');
        let rendered;
        try {
          rendered = renderSystemContract(templateBuffer, contractFormData as Record<string, string>, title);
          console.log('[generate] 계약서 렌더링 완료:', rendered.buffer.length, 'bytes, ZIP magic:', rendered.buffer[0] === 0x50 && rendered.buffer[1] === 0x4B ? 'OK' : 'FAIL');
        } catch (renderErr) {
          console.error('[generate] 계약서 렌더링 에러:', renderErr instanceof Error ? renderErr.message : renderErr, renderErr instanceof Error ? renderErr.stack : '');
          return NextResponse.json({ error: '계약서 생성 실패: ' + (renderErr instanceof Error ? renderErr.message : '알 수 없는 오류') }, { status: 500 });
        }
        const storagePath = `generated/${authUserId}/${crypto.randomUUID()}.${rendered.extension}`;

        const { error: uploadErr } = await supabase.storage
          .from('files')
          .upload(storagePath, rendered.buffer, { contentType: rendered.mimeType, upsert: false });

        if (uploadErr) {
          console.error('[generate] Contract upload error:', uploadErr.message);
          return NextResponse.json({ error: '파일 업로드 실패' }, { status: 500 });
        }

        const { data: urlData } = await supabase.storage.from('files').createSignedUrl(storagePath, 3600);

        const { data: newDoc } = await supabase.from('documents').insert({
          title,
          content: `[계약서 자동 작성] ${templateName}`,
          template_id: templateId,
          source_file_ids: sourceFileIds ?? [],
          instructions: JSON.stringify(contractFormData),
          status: 'completed',
          created_by: authUserId,
        }).select().single();

        await supabase.from('audit_logs').insert({
          user_id: authUserId,
          action: 'document.create',
          target_type: 'document',
          target_id: newDoc?.id ?? '',
          details: { title, format: 'hwpx', mode: 'contract-direct' },
        }).then(() => {}, () => {});

        return NextResponse.json({
          document: {
            id: newDoc?.id,
            title,
            template: templateName,
            createdAt: dateStr,
            status: '완료',
            sourceCount: 0,
            content: `[계약서 자동 작성] ${templateName}`,
          },
          format: 'hwpx',
          downloadUrl: urlData?.signedUrl ?? null,
        }, { status: 201 });
      }
    }

    // AI 콘텐츠 생성 (포맷별 분기)
    const generationResult = await generateForFormat({
      format,
      templateName,
      templateContent: customStructure ? customStructure : (typeof tmpl?.content === 'string' && tmpl.content.trim()) ? tmpl.content : (typeof tmpl?.description === 'string' && tmpl.description.trim()) ? tmpl.description : null,
      templateFileText,
      templateBuffer,
      sourceChunks,
      instructions: enrichedInstructions,
    });

    const dateStr = todayStr;
    const title = `${templateName} (${dateStr} 생성)`;
    generationResult.title = title;

    // DOCX 폼 데이터 기반: 빈 셀에 내용 주입 → Storage 업로드
    if (generationResult.docxFormData && generationResult.templateBuffer && generationResult.tableStructure) {
      const fd = generationResult.docxFormData;
      const cells = generationResult.tableStructure.emptyCells;

      // ── 1단계: 섹션 통합 (AI가 행별 분산한 내용을 첫 셀로 합침) ──
      consolidateSectionCells(fd, cells);

      // ── 2단계: 메타데이터 강제 보정 (통합 결과를 덮어씀) ──
      let dangdangFilled = false;
      for (const cell of cells) {
        const label = cell.contextLabel;
        if (/작성자\s*명/.test(label)) fd[cell.fieldId] = userName;
        if (/작성자\s*직급/.test(label)) fd[cell.fieldId] = userPosition;
        if (/작성자\s*소속/.test(label)) fd[cell.fieldId] = userDept;
        if (/회의\s*(일시|일자)/.test(label)) fd[cell.fieldId] = todayStr;
        if (/^(소속|성명|연락처|서명|참석자)$/.test(label)) fd[cell.fieldId] = '';
        if (/보고처/.test(label)) fd[cell.fieldId] = userDept;
        if (/보고서명/.test(label)) fd[cell.fieldId] = templateName;
        if (/^담당$/.test(label)) fd[cell.fieldId] = '';
        if (/보고서\s*\(/.test(label)) {
          if (cell.rowIndex === 1 && cell.colIndex === 0 && !dangdangFilled) {
            fd[cell.fieldId] = userName; dangdangFilled = true;
          } else {
            fd[cell.fieldId] = '';
          }
        }
      }

      const rendered = await renderDocument(generationResult, theme);
      const storagePath = `generated/${authUserId}/${crypto.randomUUID()}.${rendered.extension}`;

      const { error: uploadErr } = await supabase.storage
        .from('files')
        .upload(storagePath, rendered.buffer, {
          contentType: rendered.mimeType,
          upsert: false,
        });

      if (uploadErr) {
        console.error('[generate] DOCX FormData Storage upload error:', uploadErr.message);
        return NextResponse.json({ error: '파일 업로드 실패' }, { status: 500 });
      }

      const { data: urlData } = await supabase.storage
        .from('files')
        .createSignedUrl(storagePath, 3600);

      const { data: newDoc } = await supabase.from('documents').insert({
        title,
        content: `[DOCX 양식 채우기] ${templateName}`,
        template_id: templateId,
        source_file_ids: sourceFileIds ?? [],
        instructions: instructions ?? null,
        status: 'completed',
        created_by: authUserId,
      }).select().single();

      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'document.create',
        target_type: 'document',
        target_id: newDoc?.id ?? '',
        details: { title, format, storagePath },
      }).then(() => {}, () => {});

      return NextResponse.json({
        document: {
          id: newDoc?.id,
          title,
          template: templateName,
          createdAt: dateStr,
          status: '완료',
          sourceCount: (sourceFileIds ?? []).length,
          content: `[DOCX 양식 채우기] ${templateName}`,
        },
        format,
        downloadUrl: urlData?.signedUrl ?? null,
      }, { status: 201 });
    }

    // HWPX 폼 데이터 기반: 빈 셀에 내용 주입 → Storage 업로드
    if (generationResult.hwpxFormData && generationResult.templateBuffer && generationResult.hwpxTableStructure) {
      const hfd = generationResult.hwpxFormData;
      const hcells = generationResult.hwpxTableStructure.emptyCells;

      // ── 1단계: 섹션 통합 (AI가 행별 분산한 내용을 첫 셀로 합침) ──
      consolidateSectionCells(hfd, hcells);

      // ── 2단계: 메타데이터 강제 보정 (통합 결과를 덮어씀) ──
      let hdangFilled = false;
      for (const cell of hcells) {
        const label = cell.contextLabel;
        if (/작성자\s*명/.test(label)) hfd[cell.fieldId] = userName;
        if (/작성자\s*직급/.test(label)) hfd[cell.fieldId] = userPosition;
        if (/작성자\s*소속/.test(label)) hfd[cell.fieldId] = userDept;
        if (/회의\s*(일시|일자)/.test(label)) hfd[cell.fieldId] = todayStr;
        if (/^(소속|성명|연락처|서명|참석자)$/.test(label)) hfd[cell.fieldId] = '';
        if (/보고처/.test(label)) hfd[cell.fieldId] = userDept;
        if (/보고서명/.test(label)) hfd[cell.fieldId] = templateName;
        if (/^담당$/.test(label)) hfd[cell.fieldId] = '';
        if (/보고서\s*\(/.test(label)) {
          if (cell.rowIndex === 1 && cell.colIndex === 0 && !hdangFilled) {
            hfd[cell.fieldId] = userName; hdangFilled = true;
          } else {
            hfd[cell.fieldId] = '';
          }
        }
      }

      const rendered = await renderDocument(generationResult, theme);
      const storagePath = `generated/${authUserId}/${crypto.randomUUID()}.${rendered.extension}`;

      const { error: uploadErr } = await supabase.storage
        .from('files')
        .upload(storagePath, rendered.buffer, {
          contentType: rendered.mimeType,
          upsert: false,
        });

      if (uploadErr) {
        console.error('[generate] HWPX FormData Storage upload error:', uploadErr.message);
        return NextResponse.json({ error: '파일 업로드 실패' }, { status: 500 });
      }

      const { data: urlData } = await supabase.storage
        .from('files')
        .createSignedUrl(storagePath, 3600);

      const { data: newDoc } = await supabase.from('documents').insert({
        title,
        content: `[HWPX 양식 채우기] ${templateName}`,
        template_id: templateId,
        source_file_ids: sourceFileIds ?? [],
        instructions: instructions ?? null,
        status: 'completed',
        created_by: authUserId,
      }).select().single();

      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'document.create',
        target_type: 'document',
        target_id: newDoc?.id ?? '',
        details: { title, format, storagePath },
      }).then(() => {}, () => {});

      return NextResponse.json({
        document: {
          id: newDoc?.id,
          title,
          template: templateName,
          createdAt: dateStr,
          status: '완료',
          sourceCount: (sourceFileIds ?? []).length,
          content: `[HWPX 양식 채우기] ${templateName}`,
        },
        format,
        downloadUrl: urlData?.signedUrl ?? null,
      }, { status: 201 });
    }

    // DOCX 템플릿 기반: 파일 렌더링 → Storage 업로드 (XLSX/PPTX와 동일 흐름)
    if (generationResult.docxReplacements && generationResult.templateBuffer) {
      const rendered = await renderDocument(generationResult, theme);
      const storagePath = `generated/${authUserId}/${crypto.randomUUID()}.${rendered.extension}`;

      const { error: uploadErr } = await supabase.storage
        .from('files')
        .upload(storagePath, rendered.buffer, {
          contentType: rendered.mimeType,
          upsert: false,
        });

      if (uploadErr) {
        console.error('[generate] DOCX Storage upload error:', uploadErr.message);
        return NextResponse.json({ error: '파일 업로드 실패' }, { status: 500 });
      }

      const { data: urlData } = await supabase.storage
        .from('files')
        .createSignedUrl(storagePath, 3600);

      const { data: newDoc } = await supabase.from('documents').insert({
        title,
        content: `[DOCX 템플릿 기반] ${templateName}`,
        template_id: templateId,
        source_file_ids: sourceFileIds ?? [],
        instructions: instructions ?? null,
        status: 'completed',
        created_by: authUserId,
      }).select().single();

      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'document.create',
        target_type: 'document',
        target_id: newDoc?.id ?? '',
        details: { title, format, storagePath },
      }).then(() => {}, () => {});

      return NextResponse.json({
        document: {
          id: newDoc?.id,
          title,
          template: templateName,
          createdAt: dateStr,
          status: '완료',
          sourceCount: (sourceFileIds ?? []).length,
          content: `[DOCX 템플릿 기반] ${templateName}`,
        },
        format,
        downloadUrl: urlData?.signedUrl ?? null,
      }, { status: 201 });
    }

    // 마크다운 기반 포맷(DOCX새로생성/HWPX/PDF)은 기존처럼 documents 테이블에도 저장
    if (generationResult.markdown) {
      const { data: newDoc, error } = await supabase.from('documents').insert({
        title,
        content: generationResult.markdown,
        template_id: templateId,
        source_file_ids: sourceFileIds ?? [],
        instructions: instructions ?? null,
        status: 'draft',
        created_by: authUserId,
      }).select().single();

      if (error) {
        console.error('[generate] DB insert error:', error.message);
        return NextResponse.json({ error: '문서 생성에 실패했습니다.' }, { status: 500 });
      }

      // audit
      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'document.create',
        target_type: 'document',
        target_id: newDoc.id,
        details: { title, format },
      }).then(() => {}, () => {});

      // PDF는 렌더링된 HTML도 함께 반환
      if (format === 'pdf') {
        const rendered = await renderDocument(generationResult, theme);
        return NextResponse.json({
          document: {
            id: newDoc.id,
            title,
            template: templateName,
            createdAt: dateStr,
            status: '초안',
            sourceCount: (sourceFileIds ?? []).length,
            content: generationResult.markdown,
          },
          format,
          htmlContent: rendered.buffer.toString('utf-8'),
        }, { status: 201 });
      }

      // DOCX/HWPX 마크다운 → 파일 렌더링 → Storage 업로드
      if (format === 'hwpx' || format === 'docx') {
        const rendered = await renderDocument(generationResult, theme);
        const filePath = `generated/${authUserId}/${crypto.randomUUID()}.${rendered.extension}`;
        const { error: upErr } = await supabase.storage
          .from('files')
          .upload(filePath, rendered.buffer, { contentType: rendered.mimeType, upsert: false });
        if (upErr) {
          console.error(`[generate] ${format.toUpperCase()} Storage upload error:`, upErr.message);
        }
        const { data: fileUrl } = await supabase.storage
          .from('files')
          .createSignedUrl(filePath, 3600);

        return NextResponse.json({
          document: {
            id: newDoc.id,
            title,
            template: templateName,
            createdAt: dateStr,
            status: '초안',
            sourceCount: (sourceFileIds ?? []).length,
            content: generationResult.markdown,
          },
          format,
          downloadUrl: fileUrl?.signedUrl ?? null,
        }, { status: 201 });
      }

      return NextResponse.json({
        document: {
          id: newDoc.id,
          title,
          template: templateName,
          createdAt: dateStr,
          status: '초안',
          sourceCount: (sourceFileIds ?? []).length,
          content: generationResult.markdown,
        },
        format,
      }, { status: 201 });
    }

    // XLSX/PPTX → 파일 렌더링 → Storage 업로드
    const rendered = await renderDocument(generationResult, theme);
    const storagePath = `generated/${authUserId}/${crypto.randomUUID()}.${rendered.extension}`;

    const { error: uploadErr } = await supabase.storage
      .from('files')
      .upload(storagePath, rendered.buffer, {
        contentType: rendered.mimeType,
        upsert: false,
      });

    if (uploadErr) {
      console.error('[generate] Storage upload error:', uploadErr.message);
      return NextResponse.json({ error: '파일 업로드 실패' }, { status: 500 });
    }

    // 공개 URL 생성 (1시간 유효)
    const { data: urlData } = await supabase.storage
      .from('files')
      .createSignedUrl(storagePath, 3600);

    // documents 테이블에 메타 저장
    const contentSummary = format === 'xlsx'
      ? `[Excel] ${generationResult.excelSheets?.map(s => s.sheetName).join(', ')} (${generationResult.excelSheets?.reduce((sum, s) => sum + s.rows.length, 0)}행)`
      : `[PPT] ${generationResult.pptxSlides?.length}개 슬라이드`;

    const { data: newDoc } = await supabase.from('documents').insert({
      title,
      content: contentSummary,
      template_id: templateId,
      source_file_ids: sourceFileIds ?? [],
      instructions: instructions ?? null,
      status: 'completed',
      created_by: authUserId,
    }).select().single();

    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: 'document.create',
      target_type: 'document',
      target_id: newDoc?.id ?? '',
      details: { title, format, storagePath },
    }).then(() => {}, () => {});

    return NextResponse.json({
      document: {
        id: newDoc?.id,
        title,
        template: templateName,
        createdAt: dateStr,
        status: '완료',
        sourceCount: (sourceFileIds ?? []).length,
        content: contentSummary,
      },
      format,
      downloadUrl: urlData?.signedUrl ?? null,
      outline: format === 'xlsx'
        ? { sheets: generationResult.excelSheets }
        : { slides: generationResult.pptxSlides },
    }, { status: 201 });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '문서 생성 실패';
    const errStack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : '';
    console.error('[generate] error:', errMsg, errStack);
    return NextResponse.json({ error: `문서 생성 중 오류: ${errMsg}` }, { status: 500 });
  }
}
