import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { transcribeAudio } from '@/lib/ai/transcribe';
import { summarizeTranscript } from '@/lib/ai/summarize';

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
    const { data: meetingTemplate } = await supabase
      .from('templates')
      .select('id, name, content')
      .eq('name', '회의록')
      .single();

    // 4. 회의록 문서 자동 생성
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const title = `회의록 (${dateStr} 음성 변환)`;

    const docContent = `## 회의 정보
- 일시: ${dateStr}
- 원본 파일: ${file.name}
- 음성 길이: ${(file.size / 1024).toFixed(0)} KB

## 요약
${summary.summary}

## 주요 논의사항
${summary.keyPoints.map((p) => `- ${p}`).join('\n') || '- (논의사항 없음)'}

## Action Items
${summary.actionItems.map((a) => `- ${a}`).join('\n') || '- (후속 조치 없음)'}

---

## 전체 전사록
${transcript}`;

    const { data: newDoc, error: docErr } = await supabase.from('documents').insert({
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
    }

    // audit_logs
    await supabase.from('audit_logs').insert({
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
      },
    });
  } catch (err) {
    console.error('[transcribe] error:', err);
    return NextResponse.json({ success: false, error: '음성 변환 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
