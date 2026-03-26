import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { documents as mockDocuments, templates, users } from '@/lib/mock-data';

// Supabase 미설정 시 세션 내 임시 저장용
let sessionDocuments = [...mockDocuments];

const GENERATED_CONTENT: Record<string, string> = {
  '주간업무보고서': `## 개요\n이번 주 업무 보고서입니다.\n\n## 금주 성과\n- 핵심 프로젝트 마일스톤 달성\n- 팀 미팅을 통한 이슈 해결\n- 고객 피드백 반영 완료\n\n## 차주 계획\n- 다음 스프린트 기획\n- 성과 리뷰 미팅 준비\n- 신규 기능 테스트\n\n## 이슈 및 건의\n- 추가 인력 배치 필요 검토`,
  '회의록': `## 회의 정보\n- 일시: ${new Date().toISOString().split('T')[0]} 14:00\n- 참석자: 관련 부서 담당자\n\n## 안건\n1. 프로젝트 진행 현황 공유\n2. 이슈 사항 논의\n3. 차기 일정 조율\n\n## 결정사항\n- 일정 조정 합의\n- 리소스 재배분 결정\n\n## Action Items\n- 담당자별 후속 조치 진행`,
  '기술설계문서': `## 개요\n본 문서는 시스템 기술 설계에 대한 내용을 담고 있습니다.\n\n## 기술 스택\n- Next.js 15 App Router\n- Supabase (pgvector)\n- TypeScript\n\n## 아키텍처\n클라이언트 → API Gateway → 서비스 레이어 → 데이터 레이어\n\n## API 설계\n- RESTful 엔드포인트 설계\n- 인증/인가 미들웨어 적용\n\n## 보안 고려사항\n- JWT 토큰 기반 인증\n- 입력값 검증 필수`,
  '마케팅_캠페인_기획서': `## 캠페인 개요\n신규 프로모션 캠페인 기획서입니다.\n\n## 목표 및 KPI\n- 신규 가입자 1,500명 확보\n- 매출 전월 대비 20% 증가\n- 브랜드 인지도 15% 향상\n\n## 타겟 분석\n- 25-40세 직장인\n- 디지털 서비스 관심층\n\n## 전략\n- SNS 콘텐츠 마케팅 집중\n- 인플루언서 협업\n\n## 예산 계획\n- 총 예산: 3,000만원`,
  '채용공고_양식': `## 포지션 소개\n함께 성장할 팀원을 모집합니다.\n\n## 담당 업무\n- 핵심 서비스 개발 및 운영\n- 기술적 의사결정 참여\n- 코드 리뷰 및 멘토링\n\n## 자격 요건\n- 관련 분야 3년 이상 경력\n- 문제 해결 능력\n\n## 우대 사항\n- 관련 도메인 경험\n- 오픈소스 기여 경험\n\n## 근무 조건\n- 유연 근무제\n- 점심 식대 지원`,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      let query = supabase
        .from('documents')
        .select('*, templates:template_id(name)')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      const docs = (rows ?? []).map((d) => {
        const tmplJoin = (d as Record<string, unknown>).templates as { name: string } | null;
        return {
          id: d.id,
          title: d.title,
          template: tmplJoin?.name ?? '기본',
          createdAt: d.created_at.split('T')[0],
          status: d.status === 'completed' ? '완료' : '초안',
          sourceCount: d.source_file_ids?.length ?? 0,
          content: d.content,
        };
      });

      return NextResponse.json({ documents: docs });
    }

    /* ── 폴백: mock 데이터 ── */
    let filtered = [...sessionDocuments];

    if (status) {
      filtered = filtered.filter((d) => d.status === status);
    }

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const docs = filtered.map((d) => {
      const tmpl = templates.find((t) => t.id === d.template_id);
      return {
        id: d.id,
        title: d.title,
        template: tmpl?.name ?? '기본',
        createdAt: d.created_at.split('T')[0],
        status: d.status === 'completed' ? '완료' : '초안',
        sourceCount: d.source_file_ids.length,
        content: d.content,
      };
    });

    return NextResponse.json({ documents: docs });
  } catch {
    return NextResponse.json({ documents: [], error: '문서 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, sourceFileIds, instructions, content: providedContent } = body;

    if (!templateId) {
      return NextResponse.json({ error: '템플릿을 선택해주세요.' }, { status: 400 });
    }

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      // 템플릿 이름 조회
      const { data: tmpl } = await supabase
        .from('templates')
        .select('name')
        .eq('id', templateId)
        .single();

      const templateName = tmpl?.name ?? '문서';
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const title = `${templateName} (${dateStr} 생성)`;

      let docContent = providedContent
        ?? GENERATED_CONTENT[templateName]
        ?? `## ${templateName}\n\nAI가 생성한 문서 내용입니다.\n\n소스 파일 ${(sourceFileIds ?? []).length}개를 분석하여 작성되었습니다.`;

      if (instructions) {
        docContent += `\n\n---\n*추가 지시사항 반영: ${instructions}*`;
      }

      const { data: newDoc, error } = await supabase.from('documents').insert({
        title,
        content: docContent,
        template_id: templateId,
        source_file_ids: sourceFileIds ?? [],
        instructions: instructions ?? null,
        status: 'draft',
        created_by: 'user-1', // TODO: getUser()
      } as Record<string, unknown>).select().single();

      if (error) throw error;

      // audit_logs 기록
      try {
        await supabase.from('audit_logs').insert({
          user_id: 'user-1',
          action: 'document.create',
          target_type: 'document',
          target_id: newDoc.id,
          details: { title },
        } as Record<string, unknown>);
      } catch { /* audit 실패는 무시 */ }

      return NextResponse.json({
        document: {
          id: newDoc.id,
          title: newDoc.title,
          template: templateName,
          createdAt: dateStr,
          status: '초안',
          sourceCount: (sourceFileIds ?? []).length,
          content: newDoc.content,
        },
      }, { status: 201 });
    }

    /* ── 폴백: mock ── */
    const template = templates.find((t) => t.id === templateId);
    const templateName = template?.name ?? '문서';

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const title = `${templateName} (${dateStr} 생성)`;

    let content = GENERATED_CONTENT[templateName] ?? `## ${templateName}\n\nAI가 생성한 문서 내용입니다.\n\n소스 파일 ${(sourceFileIds ?? []).length}개를 분석하여 작성되었습니다.`;

    if (instructions) {
      content += `\n\n---\n*추가 지시사항 반영: ${instructions}*`;
    }

    const newDoc = {
      id: `doc-${Date.now()}`,
      user_id: 'user-1',
      template_id: templateId,
      title,
      content,
      source_file_ids: sourceFileIds ?? [],
      status: 'draft' as const,
      watermark: null,
      created_at: now.toISOString(),
    };

    sessionDocuments.unshift(newDoc);

    const tmpl = templates.find((t) => t.id === newDoc.template_id);
    return NextResponse.json({
      document: {
        id: newDoc.id,
        title: newDoc.title,
        template: tmpl?.name ?? '기본',
        createdAt: dateStr,
        status: '초안',
        sourceCount: (sourceFileIds ?? []).length,
        content: newDoc.content,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '문서 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
    }

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // audit_logs 기록
      try {
        await supabase.from('audit_logs').insert({
          user_id: 'user-1',
          action: 'document.delete',
          target_type: 'document',
          target_id: id,
          details: {},
        } as Record<string, unknown>);
      } catch { /* audit 실패는 무시 */ }

      return NextResponse.json({ success: true });
    }

    /* ── 폴백: mock ── */
    const idx = sessionDocuments.findIndex((d) => d.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }

    sessionDocuments.splice(idx, 1);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '문서 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
