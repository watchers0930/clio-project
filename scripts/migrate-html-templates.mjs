import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnv(filePath) {
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .filter((line) => line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [
          line.slice(0, index),
          line
            .slice(index + 1)
            .replace(/^"|"$/g, '')
            .replace(/\\n/g, '')
            .trim(),
        ];
      }),
  );
}

function createBundle({ layoutHtml, outline, fields, sections }) {
  return {
    version: 1,
    mode: 'html-template',
    layoutHtml,
    outline,
    fields,
    sections,
  };
}

const reportBundle = createBundle({
  layoutHtml: [
    '<article class="report-shell report-shell--board">',
    '  <header class="report-header report-header--board">',
    '    <div class="report-kicker">업무 보고서</div>',
    '    <h1>{{report_title}}</h1>',
    '  </header>',
    '  <section class="meta-grid meta-grid--board">',
    '    <div><span>작성자</span><strong>{{author}}</strong></div>',
    '    <div><span>소속</span><strong>{{author_department}}</strong></div>',
    '    <div><span>직급</span><strong>{{author_position}}</strong></div>',
    '    <div><span>작성일</span><strong>{{report_date}}</strong></div>',
    '    <div><span>작성시간</span><strong>{{report_time}}</strong></div>',
    '    <div><span>보고처</span><strong>{{department_name}}</strong></div>',
    '    <div><span>장소</span><strong>{{meeting_place}}</strong></div>',
    '    <div><span>참석자</span><strong>{{attendees}}</strong></div>',
    '  </section>',
    '  <section class="report-section report-section--boxed">',
    '    <h2>{{section_1_sources_title}}</h2>',
    '    <div class="section-body">{{section_1_sources_body}}</div>',
    '  </section>',
    '  <section class="report-section report-section--boxed">',
    '    <h2>{{section_2_opinions_title}}</h2>',
    '    <div class="section-body">{{section_2_opinions_body}}</div>',
    '  </section>',
    '  <section class="report-section report-section--boxed">',
    '    <h2>{{section_3_issues_title}}</h2>',
    '    <div class="section-body">{{section_3_issues_body}}</div>',
    '  </section>',
    '</article>',
  ].join('\n'),
  outline: [
    '# 보고서',
    '## 정보(자료) 출처',
    '## 보고 내용과 의견',
    '## 문제점',
  ].join('\n'),
  fields: [
    { key: 'report_title', label: '문서 제목', type: 'text', required: true, placeholder: '예: 문서 운영 플랫폼 개선 보고서' },
    { key: 'author', label: '작성자', type: 'text', placeholder: '자동 입력' },
    { key: 'author_department', label: '소속', type: 'text', placeholder: '자동 입력' },
    { key: 'author_position', label: '직급', type: 'text', placeholder: '자동 입력' },
    { key: 'report_date', label: '작성일', type: 'date', placeholder: '자동 입력' },
    { key: 'report_time', label: '작성시간', type: 'text', placeholder: '자동 입력' },
    { key: 'department_name', label: '보고처', type: 'text', placeholder: '예: 전략기획팀' },
    { key: 'meeting_place', label: '장소', type: 'text', placeholder: '예: 본사 7층 회의실' },
    { key: 'attendees', label: '참석자', type: 'textarea', placeholder: '예: 홍길동, 김영희' },
  ],
  sections: [
    { key: 'section_1_sources', title: '정보(자료) 출처', prompt: '보고서에 사용한 데이터 출처, 참고 문서, 인터뷰 내용을 정리합니다.' },
    { key: 'section_2_opinions', title: '보고 내용과 의견', prompt: '핵심 분석 내용과 판단, 제안 의견을 구조적으로 작성합니다.' },
    { key: 'section_3_issues', title: '문제점', prompt: '리스크, 이슈, 후속 확인 항목을 명확히 정리합니다.' },
  ],
});

const minutesBundle = createBundle({
  layoutHtml: [
    '<article class="report-shell report-shell--minutes">',
    '  <header class="report-header report-header--minutes">',
    '    <div class="report-kicker">회의록</div>',
    '    <h1>{{report_title}}</h1>',
    '  </header>',
    '  <section class="meta-grid meta-grid--minutes">',
    '    <div><span>작성자</span><strong>{{author}}</strong></div>',
    '    <div><span>소속</span><strong>{{author_department}}</strong></div>',
    '    <div><span>직급</span><strong>{{author_position}}</strong></div>',
    '    <div><span>작성일</span><strong>{{report_date}}</strong></div>',
    '    <div><span>작성시간</span><strong>{{report_time}}</strong></div>',
    '    <div><span>장소</span><strong>{{meeting_place}}</strong></div>',
    '    <div class="meta-grid__wide"><span>참석자</span><strong>{{attendees}}</strong></div>',
    '  </section>',
    '  <section class="report-section report-section--lined">',
    '    <h2>{{section_1_summary_title}}</h2>',
    '    <div class="section-body">{{section_1_summary_body}}</div>',
    '  </section>',
    '  <section class="report-section report-section--lined">',
    '    <h2>{{section_2_result_title}}</h2>',
    '    <div class="section-body">{{section_2_result_body}}</div>',
    '  </section>',
    '</article>',
  ].join('\n'),
  outline: [
    '# 회의록',
    '## 회의 내용 (요약)',
    '## 회의 결과',
  ].join('\n'),
  fields: [
    { key: 'report_title', label: '문서 제목', type: 'text', required: true, placeholder: '예: CLIO 템플릿 개선 회의록' },
    { key: 'author', label: '작성자', type: 'text', placeholder: '자동 입력' },
    { key: 'author_department', label: '소속', type: 'text', placeholder: '자동 입력' },
    { key: 'author_position', label: '직급', type: 'text', placeholder: '자동 입력' },
    { key: 'report_date', label: '작성일', type: 'date', placeholder: '자동 입력' },
    { key: 'report_time', label: '작성시간', type: 'text', placeholder: '자동 입력' },
    { key: 'meeting_place', label: '장소', type: 'text', placeholder: '예: 본사 7층 회의실' },
    { key: 'attendees', label: '참석자', type: 'textarea', placeholder: '예: 홍길동, 김영희' },
  ],
  sections: [
    { key: 'section_1_summary', title: '회의 내용 (요약)', prompt: '회의에서 논의한 핵심 쟁점과 배경을 간결하게 정리합니다.' },
    { key: 'section_2_result', title: '회의 결과', prompt: '결정 사항, 액션 아이템, 후속 일정을 명확히 정리합니다.' },
  ],
});

const worklogBundle = createBundle({
  layoutHtml: [
    '<article class="report-shell report-shell--worklog">',
    '  <header class="report-header report-header--worklog">',
    '    <div class="report-kicker">업무일지</div>',
    '    <h1>{{report_title}}</h1>',
    '  </header>',
    '  <section class="meta-grid meta-grid--worklog">',
    '    <div><span>작성자</span><strong>{{author}}</strong></div>',
    '    <div><span>소속</span><strong>{{author_department}}</strong></div>',
    '    <div><span>직급</span><strong>{{author_position}}</strong></div>',
    '    <div><span>작성일</span><strong>{{report_date}}</strong></div>',
    '    <div><span>작성시간</span><strong>{{report_time}}</strong></div>',
    '    <div><span>보고번호</span><strong>{{report_no}}</strong></div>',
    '  </section>',
    '  <section class="report-section report-section--timeline">',
    '    <h2>{{section_1_today_title}}</h2>',
    '    <div class="section-body">{{section_1_today_body}}</div>',
    '  </section>',
    '  <section class="report-section report-section--timeline">',
    '    <h2>{{section_2_tomorrow_title}}</h2>',
    '    <div class="section-body">{{section_2_tomorrow_body}}</div>',
    '  </section>',
    '  <section class="report-section report-section--timeline">',
    '    <h2>{{section_3_note_title}}</h2>',
    '    <div class="section-body">{{section_3_note_body}}</div>',
    '  </section>',
    '</article>',
  ].join('\n'),
  outline: [
    '# 업무일지',
    '## 금일 업무 내용',
    '## 명일 업무 내용',
    '## 비고',
  ].join('\n'),
  fields: [
    { key: 'report_title', label: '문서 제목', type: 'text', required: true, placeholder: '예: 일일 업무 보고' },
    { key: 'author', label: '작성자', type: 'text', placeholder: '자동 입력' },
    { key: 'author_department', label: '소속', type: 'text', placeholder: '자동 입력' },
    { key: 'author_position', label: '직급', type: 'text', placeholder: '자동 입력' },
    { key: 'report_date', label: '작성일', type: 'date', placeholder: '자동 입력' },
    { key: 'report_time', label: '작성시간', type: 'text', placeholder: '자동 입력' },
    { key: 'report_no', label: '보고번호', type: 'text', placeholder: '예: 20260424-01' },
  ],
  sections: [
    { key: 'section_1_today', title: '금일 업무 내용', prompt: '오늘 수행한 업무를 항목별로 정리합니다.' },
    { key: 'section_2_tomorrow', title: '명일 업무 내용', prompt: '내일 예정된 업무와 준비 사항을 정리합니다.' },
    { key: 'section_3_note', title: '비고', prompt: '이슈, 참고사항, 지원 요청 내용을 기록합니다.' },
  ],
});

const proposalBundle = createBundle({
  layoutHtml: [
    '<article class="report-shell report-shell--proposal">',
    '  <header class="report-header report-header--proposal">',
    '    <div class="report-kicker">제안서</div>',
    '    <h1>{{report_title}}</h1>',
    '  </header>',
    '  <section class="meta-grid meta-grid--proposal">',
    '    <div><span>작성자</span><strong>{{author}}</strong></div>',
    '    <div><span>소속</span><strong>{{author_department}}</strong></div>',
    '    <div><span>직급</span><strong>{{author_position}}</strong></div>',
    '    <div><span>작성일</span><strong>{{report_date}}</strong></div>',
    '    <div><span>작성시간</span><strong>{{report_time}}</strong></div>',
    '    <div><span>제안 부서</span><strong>{{proposal_department}}</strong></div>',
    '    <div><span>제안 목적</span><strong>{{proposal_goal}}</strong></div>',
    '  </section>',
    '  <section class="report-section report-section--card">',
    '    <h2>{{section_1_background_title}}</h2>',
    '    <div class="section-body">{{section_1_background_body}}</div>',
    '  </section>',
    '  <section class="report-section report-section--card">',
    '    <h2>{{section_2_solution_title}}</h2>',
    '    <div class="section-body">{{section_2_solution_body}}</div>',
    '  </section>',
    '  <section class="report-section report-section--card">',
    '    <h2>{{section_3_effect_title}}</h2>',
    '    <div class="section-body">{{section_3_effect_body}}</div>',
    '  </section>',
    '  <section class="report-section report-section--card">',
    '    <h2>{{section_4_plan_title}}</h2>',
    '    <div class="section-body">{{section_4_plan_body}}</div>',
    '  </section>',
    '</article>',
  ].join('\n'),
  outline: [
    '# 제안서',
    '## 배경 및 목적',
    '## 제안 내용',
    '## 기대 효과',
    '## 실행 계획',
  ].join('\n'),
  fields: [
    { key: 'report_title', label: '문서 제목', type: 'text', required: true, placeholder: '예: 문서 운영 플랫폼 고도화 제안서' },
    { key: 'author', label: '작성자', type: 'text', placeholder: '자동 입력' },
    { key: 'author_department', label: '소속', type: 'text', placeholder: '자동 입력' },
    { key: 'author_position', label: '직급', type: 'text', placeholder: '자동 입력' },
    { key: 'report_date', label: '작성일', type: 'date', placeholder: '자동 입력' },
    { key: 'report_time', label: '작성시간', type: 'text', placeholder: '자동 입력' },
    { key: 'proposal_department', label: '제안 부서', type: 'text', placeholder: '예: 전략기획팀' },
    { key: 'proposal_goal', label: '제안 목적', type: 'text', placeholder: '예: 문서 생성 효율화 및 표준화' },
  ],
  sections: [
    { key: 'section_1_background', title: '배경 및 목적', prompt: '현재 문제 배경과 제안이 필요한 이유를 정리합니다.' },
    { key: 'section_2_solution', title: '제안 내용', prompt: '구체적인 해결 방안, 구조, 범위를 제시합니다.' },
    { key: 'section_3_effect', title: '기대 효과', prompt: '정성적/정량적 기대 효과를 명확하게 설명합니다.' },
    { key: 'section_4_plan', title: '실행 계획', prompt: '일정, 단계, 필요 자원, 후속 계획을 정리합니다.' },
  ],
});

const templateSpecs = [
  {
    names: ['보고서'],
    description: '업무 보고서 및 분석 리포트 템플릿',
    bundle: reportBundle,
  },
  {
    names: ['회의록'],
    description: '팀 회의 및 프로젝트 회의록 작성용 템플릿',
    bundle: minutesBundle,
  },
  {
    names: ['업무일지'],
    description: '일일 업무 보고 및 실행 계획 기록용 템플릿',
    bundle: worklogBundle,
  },
  {
    names: ['제안서'],
    description: '제안서 작성용 템플릿',
    bundle: proposalBundle,
  },
];

const env = readEnv('/Users/watchers/Desktop/clio-project/.env.local');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: templates, error } = await supabase
    .from('templates')
    .select('id, name, description, template_file_id, template_file:template_file_id(name)')
    .order('name');

  if (error) throw error;

  const proposalTarget = templates.find((template) =>
    template.name === '보고서'
    && template.template_file
    && /보고서\s*양식\.docx/i.test(template.template_file.name ?? ''),
  );

  if (proposalTarget) {
    const { error: renameError } = await supabase
      .from('templates')
      .update({
        name: '제안서',
        description: '제안서 작성용 템플릿',
      })
      .eq('id', proposalTarget.id);

    if (renameError) throw renameError;
    console.log(`[renamed] 보고서(${proposalTarget.template_file?.name ?? 'template'}) -> 제안서`);
  } else {
    console.log('[skip] 보고서양식.docx 기반 보고서 템플릿을 찾지 못해 제안서 변경은 건너뜀');
  }

  for (const spec of templateSpecs) {
    const matched = templates.filter((template) =>
      spec.names.includes(template.name)
      && template.id !== proposalTarget?.id,
    );
    if (matched.length === 0) {
      console.log(`[skip] ${spec.names.join(', ')} 템플릿 없음`);
      continue;
    }

    for (const template of matched) {
      const payload = {
        description: spec.description,
        content: JSON.stringify(spec.bundle),
        placeholders: [],
        template_file_id: null,
      };

      const { error: updateError } = await supabase
        .from('templates')
        .update(payload)
        .eq('id', template.id);

      if (updateError) throw updateError;
      console.log(`[updated] ${template.name} (${template.id}) template_file_id=${template.template_file_id ?? 'null'} -> html-template`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
