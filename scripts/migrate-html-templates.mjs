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

const mouBundle = JSON.parse(fs.readFileSync('/Users/watchers/Desktop/clio-project/data/templates/업무협약서_MOU_CLIO.bundle.json', 'utf8'));

const employmentCertificateBundle = createBundle({
  layoutHtml: `
<style>
@page{size:A4;margin:0;}
.employment-cert{position:relative;box-sizing:border-box;width:210mm;height:297mm;min-height:297mm;margin:0 auto;background:#fff;color:#111;overflow:hidden;font-family:Batang,"AppleMyungjo","Nanum Myeongjo","Noto Serif KR",serif;letter-spacing:-2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.employment-cert *{box-sizing:border-box;}
.employment-cert .watermark-pattern{position:absolute;inset:-28mm;z-index:0;opacity:.045;background-image:var(--company-logo-watermark);background-repeat:repeat;background-position:center;background-size:var(--company-logo-pattern-size,44mm) auto;transform:rotate(-18deg);transform-origin:center;pointer-events:none;}
.employment-cert .title{position:absolute;top:35mm;left:0;z-index:1;width:100%;margin:0;text-align:center;font-size:11.5mm;font-weight:700;letter-spacing:-2px;line-height:1;}
.employment-cert .section{position:absolute;left:32mm;z-index:1;width:154mm;font-size:4.2mm;line-height:1;}
.employment-cert .section-1{top:67mm;}
.employment-cert .section-2{top:112mm;}
.employment-cert .section-title{margin:0 0 5mm 2mm;font-size:4.3mm;font-weight:700;line-height:1;}
.employment-cert table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #222;}
.employment-cert td{height:10.5mm;border:1px solid #222;vertical-align:middle;font-size:4.2mm;font-weight:400;line-height:1;white-space:nowrap;}
.employment-cert .label{text-align:center;}
.employment-cert .personal col:nth-child(1),.employment-cert .employment col:nth-child(1){width:17%;}
.employment-cert .personal col:nth-child(2),.employment-cert .employment col:nth-child(2){width:32.5%;}
.employment-cert .personal col:nth-child(3),.employment-cert .employment col:nth-child(3){width:17.5%;}
.employment-cert .personal col:nth-child(4),.employment-cert .employment col:nth-child(4){width:33%;}
.employment-cert .value{padding:0 3mm;letter-spacing:0;white-space:normal;word-break:keep-all;line-height:1.35;}
.employment-cert .period{padding-left:3mm;word-spacing:.9mm;}
.employment-cert .statement{position:absolute;top:174mm;left:0;z-index:1;width:100%;margin:0;text-align:center;font-size:4.2mm;line-height:1;}
.employment-cert .date{position:absolute;top:202mm;left:0;z-index:1;width:100%;margin:0;text-align:center;font-size:4.2mm;line-height:1;letter-spacing:0;word-spacing:4mm;}
.employment-cert .company-info{position:absolute;top:226mm;left:34mm;z-index:1;width:152mm;font-size:4.2mm;line-height:1;}
.employment-cert .company-row{position:relative;display:grid;grid-template-columns:26mm 1fr;align-items:start;min-height:10.7mm;}
.employment-cert .company-label{display:block;width:26mm;text-align:justify;text-align-last:justify;white-space:nowrap;}
.employment-cert .registration-label{letter-spacing:1.35mm;white-space:nowrap;}
.employment-cert .company-value{display:block;min-width:0;padding-left:8mm;letter-spacing:0;line-height:1.35;word-break:keep-all;}
.employment-cert .address-value{white-space:nowrap;}
.employment-cert .seal{position:absolute;left:75mm;top:-3.7mm;width:18mm;height:18mm;display:inline-flex;align-items:center;justify-content:center;}
.employment-cert .seal-text{position:relative;z-index:1;}
.employment-cert .seal-image{position:absolute;left:50%;top:50%;z-index:2;width:18mm;height:18mm;object-fit:contain;transform:translate(-50%,-50%);}
.employment-cert .seal-image[src=""]{display:none;}
@media print{html,body{width:210mm;height:297mm;min-height:297mm;margin:0!important;padding:0!important;background:#fff;overflow:hidden}.employment-cert{width:210mm;height:297mm;min-height:297mm;margin:0;box-shadow:none;break-after:avoid;page-break-after:avoid;}}
</style>
<article class="employment-cert">
  <div class="watermark-pattern" style="--company-logo-watermark:url('{{company_logo_src}}');--company-logo-pattern-size:{{company_logo_pattern_size}}"></div>
  <h1 class="title">{{report_title}}</h1>

  <section class="section section-1">
    <h2 class="section-title">1. 인적사항</h2>
    <table class="personal">
      <colgroup><col><col><col><col></colgroup>
      <tbody>
        <tr>
          <td class="label">성명 (한글)</td>
          <td class="value">{{employee_name}}</td>
          <td class="label">주민등록번호</td>
          <td class="value">{{resident_registration_no}}</td>
        </tr>
        <tr>
          <td class="label">주소</td>
          <td class="value" colspan="3">{{employee_address}}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section class="section section-2">
    <h2 class="section-title">2. 재직사항 및 제출용도</h2>
    <table class="employment">
      <colgroup><col><col><col><col></colgroup>
      <tbody>
        <tr>
          <td class="label">근무부서</td>
          <td class="value">{{department}}</td>
          <td class="label">직위</td>
          <td class="value">{{position}}</td>
        </tr>
        <tr>
          <td class="label">재직기간</td>
          <td class="value period" colspan="3">{{employment_start_date_ko}} 부터 {{employment_end_date_ko}} 현재까지</td>
        </tr>
        <tr>
          <td class="label">제출용도</td>
          <td class="value" colspan="3">{{purpose}}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <p class="statement">위의 기재사항이 사실과 다름없음을 증명합니다.</p>
  <p class="date">{{report_date_ko}}</p>

  <section class="company-info">
    <div class="company-row"><span class="company-label">회 사 명</span><span class="company-value">{{company_name}}</span></div>
    <div class="company-row"><span class="company-label">대 표 자</span><span class="company-value">{{representative_name}}</span><span class="seal"><span class="seal-text">(인)</span><img class="seal-image" src="{{signature_image_src}}" alt="도장" /></span></div>
    <div class="company-row"><span class="company-label registration-label">사업자등록</span><span class="company-value">{{business_registration_no}}</span></div>
    <div class="company-row"><span class="company-label">주 소</span><span class="company-value address-value">{{company_address}}</span></div>
    <div class="company-row"><span class="company-label">전 화</span><span class="company-value">{{company_phone}}</span></div>
  </section>
</article>
`.trim(),
  outline: [
    '# 재직증명서',
    '## 인적사항',
    '## 재직사항 및 제출용도',
    '## 증명 및 회사 정보',
  ].join('\n'),
  fields: [
    { key: 'report_title', label: '문서 제목', type: 'text', required: true, defaultValue: '재직증명서' },
    { key: 'employee_name', label: '성명(한글)', type: 'text', required: true, placeholder: '예: 홍길동' },
    { key: 'resident_registration_no', label: '주민등록번호', type: 'text', placeholder: '예: 900101-1******' },
    { key: 'employee_address', label: '주소', type: 'textarea', placeholder: '예: 서울특별시 강남구 ...' },
    { key: 'department', label: '근무부서', type: 'text', placeholder: '예: 개발팀' },
    { key: 'position', label: '직위', type: 'text', placeholder: '예: 매니저' },
    { key: 'employment_start_date', label: '재직 시작일', type: 'date', required: true },
    { key: 'employment_end_date', label: '재직 기준일', type: 'date', defaultValue: '{{report_date}}', placeholder: '미입력 시 발급일 기준' },
    { key: 'purpose', label: '제출용도', type: 'textarea', placeholder: '예: 금융기관 제출용' },
    { key: 'report_date', label: '발급일', type: 'date', autoFill: 'document' },
    { key: 'company_name', label: '회사명', type: 'text', defaultValue: '주식회사 비엠아이씨앤에스' },
    { key: 'representative_name', label: '대표자', type: 'text', defaultValue: '김동의' },
    { key: 'business_registration_no', label: '사업자등록번호', type: 'text', defaultValue: '263-87-03481' },
    { key: 'company_address', label: '회사 주소', type: 'textarea', defaultValue: '서울특별시 강남구 강남대로 354(혜천빌딩) 1126-5호' },
    { key: 'company_phone', label: '회사 전화', type: 'text', defaultValue: '010-8490-9271' },
  ],
  sections: [],
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
  {
    names: ['업무협약서(MOU)', '업무협약서', '사업 협력을 위한 양해각서'],
    createName: '업무협약서(MOU)',
    description: '사업 협력을 위한 양해각서 작성용 템플릿',
    bundle: mouBundle,
    createIfMissing: true,
  },
  {
    names: ['재직증명서'],
    description: '직원 재직 사실 증명서 발급용 템플릿',
    bundle: employmentCertificateBundle,
    createIfMissing: true,
  },
];

const env = {
  ...process.env,
  ...readEnv('/Users/watchers/Desktop/clio-project/.env.local'),
  ...(process.env.MIGRATE_ENV_FILE ? readEnv(process.env.MIGRATE_ENV_FILE) : {}),
};
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
      if (spec.createIfMissing) {
        const payload = {
          name: spec.createName ?? spec.names[0],
          description: spec.description,
          scope: 'company',
          content: JSON.stringify(spec.bundle),
          placeholders: [],
          template_file_id: null,
        };
        const { data: inserted, error: insertError } = await supabase
          .from('templates')
          .insert(payload)
          .select('id, name')
          .single();

        if (insertError) throw insertError;
        console.log(`[created] ${inserted.name} (${inserted.id}) -> html-template`);
        continue;
      }
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
