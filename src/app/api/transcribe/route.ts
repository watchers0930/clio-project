import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { transcribeAudio } from '@/lib/ai/transcribe';
import { summarizeTranscript } from '@/lib/ai/summarize';
import { extractTodosFromText } from '@/lib/ai/extract-todos';
import { parseTemplateBundle } from '@/lib/templates/template-schema';
import { generateDocumentContent } from '@/lib/ai/generate-document';
import { extractText } from '@/lib/ai/extract-text';

/**
 * POST /api/transcribe
 * 오디오 파일 업로드 → STT 변환 → 요약 → 회의록 자동 생성
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }
    const admin = createAdminSupabaseClient();

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: '오디오 파일이 필요합니다.' }, { status: 400 });
    }

    // 파일 크기 검증 (25MB)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '파일 크기가 25MB를 초과합니다.' }, { status: 400 });
    }

    // 1. STT 변환
    const buffer = await file.arrayBuffer();
    let transcript: string;
    try {
      transcript = await transcribeAudio(buffer, file.name);
    } catch (err) {
      console.error('[transcribe] STT error:', err);
      return NextResponse.json({ success: false, error: '음성 변환에 실패했습니다.' }, { status: 500 });
    }

    if (!transcript.trim()) {
      return NextResponse.json({ success: false, error: '음성에서 텍스트를 추출할 수 없습니다.' }, { status: 422 });
    }

    // 2. AI 요약
    let summary;
    try {
      summary = await summarizeTranscript(transcript);
    } catch (err) {
      console.error('[transcribe] summary error:', err);
      summary = { summary: transcript.slice(0, 500), keyPoints: [], actionItems: [] };
    }

    // 3. 회의록 템플릿 찾기
    const { data: authorInfo } = await supabase
      .from('users')
      .select('name')
      .eq('id', authUserId)
      .single();

    const { data: meetingTemplate } = await admin
      .from('templates')
      .select('id, name, content, placeholders, template_file_id')
      .eq('name', '회의록')
      .single();

    // 4. 회의록 문서 자동 생성
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const title = `회의록 (${dateStr} 음성 변환)`;
    const templateName = meetingTemplate?.name ?? '회의록';
    const templateBundle = parseTemplateBundle(meetingTemplate?.content, {
      name: templateName,
      placeholders: meetingTemplate?.placeholders,
    });

    let templateFileText: string | null = null;
    if (meetingTemplate?.template_file_id) {
      const { data: tplFile } = await admin
        .from('files')
        .select('name, type, storage_path')
        .eq('id', meetingTemplate.template_file_id)
        .single();
      if (tplFile?.storage_path) {
        try {
          const { data: blob } = await admin.storage.from('files').download(tplFile.storage_path);
          if (blob) {
            const buf = await blob.arrayBuffer();
            templateFileText = await extractText(buf, tplFile.type ?? '', tplFile.name);
          }
        } catch (err) {
          console.error('[transcribe] template extract error:', err);
        }
      }
    }

    const sourceChunks = [
      `회의 메타 정보\n- 회의 일시: ${dateStr}\n- 원본 파일: ${file.name}\n- 파일 크기: ${(file.size / 1024).toFixed(0)} KB`,
      `회의 요약\n${summary.summary}`,
      `주요 논의사항\n${summary.keyPoints.map((p) => `- ${p}`).join('\n') || '- (논의사항 없음)'}`,
      `후속 액션\n${summary.actionItems.map((a) => `- ${a}`).join('\n') || '- (후속 조치 없음)'}`,
      `전체 전사록\n${transcript}`,
    ];

    const instructions = [
      '이 문서는 음성 녹음에서 생성된 회의록입니다.',
      '반드시 회의록 템플릿 구조와 섹션 순서를 따릅니다.',
      '회의 개요, 주요 논의사항, 결정사항, 후속 액션이 드러나게 작성합니다.',
      '전사 내용을 그대로 나열하지 말고 회의록 형식으로 정리합니다.',
      '확인되지 않은 참석자나 시간 정보는 [확인필요]로 표기합니다.',
      '필요하면 마지막 섹션에 전체 전사록 요약 또는 원문 정리를 포함합니다.',
    ].join('\n');

    const docContent = await generateDocumentContent({
      templateName,
      templateContent: templateBundle.outline,
      templateBundle,
      templateFileText,
      sourceChunks,
      instructions,
      documentInputs: {
        report_title: title,
        subtitle: `${file.name} 음성 회의록`,
        author: authorInfo?.name ?? '',
        report_date: dateStr,
      },
    });

    const { data: newDoc, error: docErr } = await admin.from('documents').insert({
      title,
      content: docContent,
      template_id: meetingTemplate?.id ?? null,
      source_file_ids: [],
      instructions: '음성 파일에서 자동 변환됨',
      status: 'draft',
      created_by: authUserId,
    }).select().single();

    if (docErr) {
      console.error('[transcribe] doc insert error:', docErr.message);
      return NextResponse.json({ success: false, error: '음성 변환 후 회의록 저장에 실패했습니다.' }, { status: 500 });
    }

    // 5. 할일 자동 추출 (실패해도 회의록 생성 중단 없음)
    let extractedTodos: import('@/lib/ai/extract-todos').ExtractedTodo[] = [];
    if (newDoc && process.env.OPENAI_API_KEY) {
      extractedTodos = await extractTodosFromText(transcript);
    }

    // audit_logs
    await admin.from('audit_logs').insert({
      user_id: authUserId,
      action: 'document.create',
      target_type: 'document',
      target_id: newDoc?.id ?? null,
      details: { title, source: 'stt', audioFile: file.name },
    }).then(() => {}, () => {});

    return NextResponse.json({
      success: true,
      data: {
        transcript,
        summary,
        document: newDoc ? {
          id: newDoc.id,
          title: newDoc.title,
          content: newDoc.content,
        } : null,
        extractedTodos,
      },
    });
  } catch (err) {
    console.error('[transcribe] error:', err);
    return NextResponse.json({ success: false, error: '음성 변환 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
