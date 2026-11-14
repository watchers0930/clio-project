// 제안서·사업계획서 섹션별 병렬 분할 생성 — 섹션마다 AI 호출 후 하나의 마크다운으로 결합
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import type { TemplateBundle } from '@/lib/templates/template-schema';
import { MAX_CONTEXT_CHARS } from './generate-shared';

/**
 * 참조 제안서의 섹션 제목에서 번호를 제거한 키워드로 매칭.
 * 예: "1. 제안 개요" → 참조 문서의 "1. 제안 개요" 또는 "제안 개요" 매칭
 */
function findMatchingReference(
  referenceSections: Map<string, string> | undefined,
  sectionTitle: string,
): string | null {
  if (!referenceSections?.size) return null;

  // 정확히 일치하는 경우
  if (referenceSections.has(sectionTitle)) {
    return referenceSections.get(sectionTitle) ?? null;
  }

  // 번호 제거 후 매칭 (양쪽 모두)
  const normalize = (t: string) => t.replace(/^\d+\.\s*/, '').trim();
  const normalizedTarget = normalize(sectionTitle);

  for (const [key, value] of referenceSections) {
    if (normalize(key) === normalizedTarget) return value;
  }

  // 부분 키워드 매칭
  for (const [key, value] of referenceSections) {
    const normalizedKey = normalize(key);
    if (normalizedTarget.includes(normalizedKey) || normalizedKey.includes(normalizedTarget)) {
      return value;
    }
  }

  return null;
}

export async function generateProposalBySections(params: {
  templateName: string;
  templateBundle: TemplateBundle;
  sourceChunks: string[];
  instructions?: string;
  documentInputs?: Record<string, string>;
  referenceSections?: Map<string, string>;
}): Promise<string> {
  const { templateBundle, sourceChunks, instructions, documentInputs, referenceSections } = params;
  const model = openai('gpt-4o');

  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > MAX_CONTEXT_CHARS) break;
    contextText += `${chunk}\n---\n`;
  }

  const fieldValues = templateBundle.fields
    .map((f) => `- ${f.label}: ${documentInputs?.[f.key] || '[미입력]'}`)
    .join('\n');
  const title = documentInputs?.report_title?.trim() || params.templateName;

  const sharedSystem = `당신은 공공기관 제출용 제안서 작성 전문 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
1. 입력된 기본정보를 최우선 사실로 사용합니다.
2. 문체는 공공기관 제출용으로 간결하고 공식적으로 유지합니다.
3. 불필요한 마케팅·과장·추측성 표현을 쓰지 않습니다.
4. 순수 마크다운만 출력합니다. 단, Mermaid 다이어그램은 \`\`\`mermaid 코드블록으로 포함합니다.
5. 확인되지 않은 비용·일정·인력 실명은 [확인필요]로 남깁니다.
6. **이 섹션을 최대한 충실하고 상세하게** 작성합니다. 분량 제한 없이 평가위원이 납득할 깊이를 확보합니다.
7. 각 H3 항목은 서술형(4~8문단)으로 전개합니다. 배경→현황→방안→기대효과 흐름을 따릅니다.
8. 표가 적절한 곳에는 5~8행의 상세 표를 포함합니다.
9. Mermaid 다이어그램을 적극 활용합니다. 기본 방향은 가로(graph LR), 노드 5개 이상이면 두 줄로 분리합니다.
10. AS-IS 분석은 수치화, 기대효과는 정량적 KPI, 차별점은 구체적 비교로 서술합니다.

## Mermaid 작성 필수 규칙 (반드시 준수)
- 한글·특수문자가 포함된 노드는 반드시 큰따옴표로 감쌉니다: A["현황 분석"] --> B["시스템 설계"]
- 소괄호·대괄호 등 특수문자가 노드 텍스트에 포함되면 큰따옴표 필수: C["PM(프로젝트 매니저)"]
- 노드 ID는 영문·숫자만 사용합니다: A, B1, node1 (한글 ID 금지)
- subgraph 제목도 큰따옴표로 감쌉니다: subgraph "수행 조직"
- 화살표는 --> 또는 --- 만 사용합니다. ==> 사용 금지
- graph LR 또는 graph TD만 사용합니다. flowchart 키워드 사용 금지
- 노드 안에서 줄바꿈 시 <br/>을 사용합니다`;

  const sectionPromises = templateBundle.sections.map(async (section) => {
    const refContent = findMatchingReference(referenceSections, section.title);
    const sectionSystem = `${sharedSystem}\n\n## 현재 작성 섹션: ${section.title}\n\n## 작성 지시\n${section.prompt}`;
    const sectionUser = [
      `## 기본정보\n${fieldValues}`,
      `## 참조 자료\n${contextText || '(참조 자료 없음)'}`,
      refContent ? `## 참조 제안서 (형식 가이드)\n아래는 이전에 작성된 우수 제안서의 해당 섹션입니다. **이 형식과 구조(표 형태, 다이어그램 패턴, 문단 구성, 문체)를 참고**하되, 내용은 위 기본정보와 참조 자료를 기반으로 새로 작성하세요.\n\n${refContent}` : '',
      instructions ? `## 추가 지시사항\n${instructions}` : '',
      `"${section.title}" 섹션을 작성하세요.`,
      '- ## (H2) 제목 없이 ### (H3) 하위 항목부터 바로 시작합니다.',
      '- 각 H3 항목마다 4~8문단으로 충분히 서술합니다.',
      '- 다이어그램이 적절한 곳에는 반드시 Mermaid를 포함합니다.',
    ].filter(Boolean).join('\n\n');

    try {
      const { text } = await generateText({
        model,
        system: sectionSystem,
        prompt: sectionUser,
        maxOutputTokens: 16000,
        temperature: 0.2,
      });
      let result = text.trim();
      if (result.startsWith('```markdown')) result = result.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
      else if (result.startsWith('```')) result = result.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
      return { title: section.title, content: result };
    } catch (err) {
      console.error(`[proposal-sections] ${section.title} failed:`, err);
      return { title: section.title, content: section.prompt };
    }
  });

  const results = await Promise.all(sectionPromises);
  return [`# ${title}`, '', ...results.map((r) => `## ${r.title}\n\n${r.content}`)].join('\n\n');
}

async function generateSectionWithRetry(
  sectionSystem: string,
  sectionUser: string,
  sectionTitle: string,
): Promise<string> {
  const models = [
    { provider: 'gemini', create: () => google('gemini-2.5-flash') },
    { provider: 'openai', create: () => openai('gpt-4o-mini') },
  ];

  for (const { provider, create } of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { text } = await generateText({
          model: create(),
          system: sectionSystem,
          prompt: sectionUser,
          maxOutputTokens: 16000,
          temperature: 0.2,
        });
        let result = text.trim();
        if (result.startsWith('```markdown')) result = result.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
        else if (result.startsWith('```')) result = result.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
        if (result.length > 50) return result;
        console.warn(`[business-plan-sections] ${sectionTitle}: ${provider} attempt ${attempt + 1} returned short text (${result.length} chars)`);
      } catch (err) {
        console.error(`[business-plan-sections] ${sectionTitle}: ${provider} attempt ${attempt + 1} failed:`, err);
      }
    }
  }

  return `[이 섹션("${sectionTitle}")은 AI 생성에 실패했습니다. 문서를 다시 생성해주세요.]`;
}

export async function generateBusinessPlanBySections(params: {
  templateName: string;
  templateBundle: TemplateBundle;
  sourceChunks: string[];
  instructions?: string;
  documentInputs?: Record<string, string>;
}): Promise<string> {
  const { templateBundle, sourceChunks, instructions, documentInputs } = params;

  let contextText = '';
  for (const chunk of sourceChunks) {
    if (contextText.length + chunk.length > MAX_CONTEXT_CHARS) break;
    contextText += `${chunk}\n---\n`;
  }

  const fieldValues = templateBundle.fields
    .map((f) => `- ${f.label}: ${documentInputs?.[f.key] || '[미입력]'}`)
    .join('\n');
  const title = documentInputs?.report_title?.trim() || params.templateName;

  const sharedSystem = `당신은 창업 사업계획서 작성 전문 AI입니다. 한국어로 작성합니다.

## 핵심 규칙
1. 입력된 기본정보를 최우선 사실로 사용합니다.
2. 창업지원사업 심사위원이 납득할 깊이와 구체성을 확보합니다.
3. 분량 제한 없이 각 항목을 충실하게 서술합니다.
4. 각 H3 항목은 4~8문단으로 전개합니다. 배경→현황→방안→기대효과 흐름을 따릅니다.
5. 표가 적절한 곳에 5~8행 상세 표를 포함합니다 (마크다운 테이블).
6. 참조 자료의 수치, 실적, 기술 내용을 적극 인용합니다.
7. 확인되지 않은 수치는 [확인필요]로 표시합니다.
8. 순수 마크다운만 출력합니다 (Mermaid 없음).
9. 불필요한 마케팅·과장·추측성 표현을 쓰지 않습니다.
10. AS-IS 분석은 수치화, 기대효과는 정량적 KPI, 차별점은 구체적 비교로 서술합니다.`;

  const sectionPromises = templateBundle.sections.map(async (section) => {
    const sectionSystem = `${sharedSystem}\n\n## 현재 작성 섹션: ${section.title}\n\n## 작성 지시\n${section.prompt}`;
    const sectionUser = [
      `## 기본정보\n${fieldValues}`,
      `## 참조 자료\n${contextText || '(참조 자료 없음)'}`,
      instructions ? `## 추가 지시사항\n${instructions}` : '',
      `"${section.title}" 섹션을 작성하세요.`,
      '- ## (H2) 제목 없이 ### (H3) 하위 항목부터 바로 시작합니다.',
      '- N.N 수준 항목은 ### (H3), N.N.N 수준 항목은 #### (H4)로 작성합니다.',
      '- 각 H3 항목마다 4~8문단으로 충분히 서술합니다.',
    ].filter(Boolean).join('\n\n');

    const content = await generateSectionWithRetry(sectionSystem, sectionUser, section.title);
    return { title: section.title, content };
  });

  const results = await Promise.all(sectionPromises);
  return [`# ${title}`, '', ...results.map((r) => `## ${r.title}\n\n${r.content}`)].join('\n\n');
}
