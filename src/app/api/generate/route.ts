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

const VALID_FORMATS: OutputFormat[] = ['docx', 'pdf', 'hwpx', 'xlsx', 'pptx'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, sourceFileIds, instructions, outputFormat = 'docx', font } = body;

    // 폰트 테마 생성
    const fontParam = typeof font === 'string' ? font : '맑은 고딕';
    const theme: CorporateTheme = {
      ...DEFAULT_THEME,
      fontFamily: fontParam,
      fontFamilyEn: FONT_MAP[fontParam] ?? 'Malgun Gothic',
    };

    if (!templateId) {
      return NextResponse.json({ error: '템플릿을 선택해주세요.' }, { status: 400 });
    }

    const format = outputFormat as OutputFormat;
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

    // 템플릿 조회
    const { data: tmpl } = await supabase
      .from('templates')
      .select('name, content, description, placeholders, template_file_id')
      .eq('id', templateId)
      .single();

    const templateName = tmpl?.name ?? '문서';

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
            // 바이너리 원본을 먼저 보존 (ArrayBuffer는 소비될 수 있으므로)
            const bufCopy = Buffer.from(buf);
            // XLSX 템플릿은 셀 주소 포함 구조화 추출
            const ext = tplFile.name.split('.').pop()?.toLowerCase() ?? '';
            if (ext === 'xlsx' && format === 'xlsx') {
              templateFileText = await extractXlsxStructured(bufCopy.buffer.slice(bufCopy.byteOffset, bufCopy.byteOffset + bufCopy.byteLength));
            } else {
              templateFileText = await extractText(bufCopy.buffer.slice(bufCopy.byteOffset, bufCopy.byteOffset + bufCopy.byteLength), tplFile.type ?? '', tplFile.name);
            }
            // 템플릿 기반 생성 시 바이너리 원본 보존 (DOCX/XLSX/PPTX/HWPX)
            if (format === 'xlsx' || format === 'pptx' || format === 'docx' || format === 'hwpx') {
              templateBuffer = bufCopy;
            }
          }
        } catch (e) {
          console.error(`[generate] extract template:`, e);
        }
      }
    }

    // AI 콘텐츠 생성 (포맷별 분기)
    const generationResult = await generateForFormat({
      format,
      templateName,
      templateContent: (typeof tmpl?.content === 'string' && tmpl.content.trim()) ? tmpl.content : (typeof tmpl?.description === 'string' && tmpl.description.trim()) ? tmpl.description : null,
      templateFileText,
      templateBuffer,
      sourceChunks,
      instructions: instructions ?? undefined,
    });

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const title = `${templateName} (${dateStr} 생성)`;
    generationResult.title = title;

    // DOCX 폼 데이터 기반: 빈 셀에 내용 주입 → Storage 업로드
    if (generationResult.docxFormData && generationResult.templateBuffer && generationResult.tableStructure) {
      const rendered = await renderDocument(generationResult, theme);
      const storagePath = `generated/${authUserId}/${Date.now()}_${rendered.fileName}`;

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
      const rendered = await renderDocument(generationResult, theme);
      const storagePath = `generated/${authUserId}/${Date.now()}_${rendered.fileName}`;

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
      const storagePath = `generated/${authUserId}/${Date.now()}_${rendered.fileName}`;

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
    const storagePath = `generated/${authUserId}/${Date.now()}_${rendered.fileName}`;

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
