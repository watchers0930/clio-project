/**
 * POST /api/contract-fix/regenerate
 * 수정된 조항들을 반영한 계약서 DOCX 재생성
 * Body: {
 *   analysisId: string,
 *   fixes: { fixId: string; finalText: string; status: 'accepted' | 'rejected' | 'modified' }[]
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import OpenAI from 'openai';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';

export const maxDuration = 60;

interface FixItem {
  fixId: string;
  finalText: string;
  status: 'accepted' | 'rejected' | 'modified';
}

interface ClauseFix {
  id: string;
  clause_title: string;
  clause_text: string;
  suggested_fix: string;
  status: string;
}

/**
 * 수정 사항을 반영한 DOCX 생성
 * - 원문 raw_text를 기반으로 AI가 수정 조항을 교체한 최종 계약서 작성
 */
async function buildFixedDocx(
  rawText: string,
  fixes: { title: string; originalText: string; finalText: string }[],
  openai: OpenAI,
): Promise<Buffer> {
  // GPT-4o로 수정사항 반영된 계약서 생성
  const fixSummary = fixes
    .map((f, i) => `${i + 1}. [${f.title}]\n원문: ${f.originalText.slice(0, 500)}\n수정: ${f.finalText.slice(0, 500)}`)
    .join('\n\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    max_tokens: 4000,
    messages: [
      {
        role: 'system',
        content: '당신은 계약서 작성 전문가입니다. 원본 계약서에서 지정된 조항들을 수정된 내용으로 교체하여 완성된 계약서를 반환합니다.',
      },
      {
        role: 'user',
        content: `원본 계약서:
${rawText.slice(0, 8000)}

---
수정할 조항 목록:
${fixSummary}

---
위 수정 사항을 반영하여 완성된 계약서 전문을 마크다운 없이 일반 텍스트로 작성해 주세요.
수정된 조항은 "[수정됨]" 표시를 앞에 붙여 주세요.`,
      },
    ],
  });

  const revisedText = completion.choices[0].message.content ?? rawText;
  const lines = revisedText.split('\n');

  const paragraphs: Paragraph[] = [];

  // 헤더
  paragraphs.push(
    new Paragraph({
      text: '계약서 (수정본)',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: '※ 이 문서는 AI 수정 제안이 반영된 계약서입니다. 법률 전문가의 검토를 권장합니다.',
        size: 18,
        color: 'FF0000',
        italics: true,
      })],
      spacing: { after: 600 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'FF0000' },
      },
    }),
  );

  for (const line of lines) {
    const isModified = line.startsWith('[수정됨]');
    const text = isModified ? line.replace('[수정됨]', '').trim() : line;

    if (!text.trim()) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    paragraphs.push(
      new Paragraph({
        children: [
          ...(isModified ? [new TextRun({ text: '▶ [수정] ', bold: true, color: '0070C0', size: 20 })] : []),
          new TextRun({
            text,
            size: 20,
            color: isModified ? '0070C0' : '000000',
            bold: isModified,
          }),
        ],
        spacing: { after: 120 },
        shading: isModified ? { fill: 'EBF3FB' } : undefined,
      }),
    );
  }

  const doc = new Document({
    sections: [{ children: paragraphs }],
    styles: {
      default: {
        document: {
          run: { font: '맑은 고딕', size: 20 },
        },
      },
    },
  });

  return Packer.toBuffer(doc);
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI 서비스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
  }

  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  let body: { analysisId: string; fixes: FixItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const { analysisId, fixes } = body;
  if (!analysisId || !Array.isArray(fixes) || fixes.length === 0) {
    return NextResponse.json({ error: 'analysisId와 fixes가 필요합니다.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // 분석 레코드 조회
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: analysis } = await (admin as any)
    .from('contract_risk_analyses')
    .select('user_id, raw_text, file_name')
    .eq('id', analysisId)
    .single() as { data: { user_id: string; raw_text: string; file_name: string } | null };

  if (!analysis || analysis.user_id !== userId) {
    return NextResponse.json({ error: '분석 결과를 찾을 수 없습니다.' }, { status: 404 });
  }

  // fix 레코드 조회
  const fixIds = fixes.map(f => f.fixId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fixRows } = await (admin as any)
    .from('contract_clause_fixes')
    .select('id, clause_title, clause_text, suggested_fix, status')
    .in('id', fixIds) as { data: ClauseFix[] | null };

  if (!fixRows || fixRows.length === 0) {
    return NextResponse.json({ error: '수정 제안을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 수락된 fix만 처리
  const acceptedFixes = fixes
    .filter(f => f.status !== 'rejected')
    .map(f => {
      const row = fixRows.find(r => r.id === f.fixId);
      return row ? {
        title: row.clause_title,
        originalText: row.clause_text,
        finalText: f.finalText || row.suggested_fix,
      } : null;
    })
    .filter(Boolean) as { title: string; originalText: string; finalText: string }[];

  if (acceptedFixes.length === 0) {
    return NextResponse.json({ error: '수락된 수정 제안이 없습니다.' }, { status: 400 });
  }

  // DB status 업데이트
  for (const fix of fixes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('contract_clause_fixes')
      .update({ status: fix.status, final_text: fix.finalText })
      .eq('id', fix.fixId);
  }

  // DOCX 생성
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let docBuffer: Buffer;
  try {
    docBuffer = await buildFixedDocx(analysis.raw_text ?? '', acceptedFixes, openai);
  } catch (err) {
    console.error('[contract-fix/regenerate] DOCX build error:', err);
    return NextResponse.json({ error: '문서 생성에 실패했습니다.' }, { status: 500 });
  }

  // Storage 업로드
  const baseName = analysis.file_name.replace(/\.[^.]+$/, '');
  const outputPath = `contract-fix/${userId}/${analysisId}/${baseName}_수정본.docx`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: uploadError } = await (admin as any).storage
    .from('files')
    .upload(outputPath, docBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });

  if (uploadError) {
    console.error('[contract-fix/regenerate] upload error:', uploadError);
    return NextResponse.json({ error: '파일 저장에 실패했습니다.' }, { status: 500 });
  }

  // Signed URL (1시간)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: signedData } = await (admin as any).storage
    .from('files')
    .createSignedUrl(outputPath, 3600) as { data: { signedUrl: string } | null };

  return NextResponse.json({
    downloadUrl: signedData?.signedUrl ?? null,
    fileName: `${baseName}_수정본.docx`,
    appliedFixCount: acceptedFixes.length,
  });
}
