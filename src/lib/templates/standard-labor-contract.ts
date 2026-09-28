import type { TemplateBundle, TemplateFieldDefinition } from '@/lib/templates/template-schema';

export const STANDARD_LABOR_CONTRACT_TEMPLATE_NAME = '표준근로계약서';

/** 비밀유지의무 조항 본문 (문서 layoutHtml·입력화면 서약 박스 공용) */
export const NDA_CLAUSE_TEXT = '근로자는 재직 중은 물론 퇴직 후에도 업무상 알게 된 회사의 영업비밀·기술정보·고객정보 및 일체의 기밀사항을 제3자에게 누설하거나 부정한 목적으로 사용하지 아니하며, 이를 위반할 경우 관계 법령 및 회사 규정에 따른 책임을 진다.';

export const STANDARD_LABOR_CONTRACT_FIELDS: TemplateFieldDefinition[] = [
  { key: 'report_title', label: '문서 제목', type: 'text', required: true, defaultValue: '표준근로계약서' },
  { key: 'employer_name', label: '사업주(사업체명)', type: 'text', required: true, defaultValue: '주식회사 비엠아이씨앤에스' },
  { key: 'employee_name', label: '근로자 성명', type: 'text', required: true, placeholder: '예: 홍길동' },
  { key: 'employment_type', label: '근로의 종류', type: 'select', required: true, options: ['정규직', '계약직', '취업연동인턴', '체험인턴'], defaultValue: '정규직' },
  { key: 'employment_period_start', label: '계약기간 시작일', type: 'date', showWhen: { field: 'employment_type', notEquals: '정규직' } },
  { key: 'employment_period_end', label: '계약기간 종료일', type: 'date', showWhen: { field: 'employment_type', notEquals: '정규직' } },
  { key: 'work_start_date', label: '근로개시일', type: 'date', required: true },
  { key: 'work_place', label: '근무장소', type: 'text', placeholder: '예: 본사 (서울특별시 강남구 ...)' },
  { key: 'job_description', label: '업무의 내용', type: 'textarea', placeholder: '예: 소프트웨어 개발 및 유지보수' },
  { key: 'work_time_start', label: '시업 시각', type: 'text', defaultValue: '09:00', placeholder: '예: 09:00' },
  { key: 'work_time_end', label: '종업 시각', type: 'text', defaultValue: '18:00', placeholder: '예: 18:00' },
  { key: 'break_time', label: '휴게시간', type: 'text', defaultValue: '12:00 ~ 13:00', placeholder: '예: 12:00 ~ 13:00' },
  { key: 'work_days_per_week', label: '근무일', type: 'text', defaultValue: '5일(월~금)', placeholder: '예: 5일(월~금)' },
  { key: 'weekly_holiday', label: '주휴일(요일 선택)', type: 'checkbox', options: ['월', '화', '수', '목', '금', '토', '일'], defaultValue: '일' },
  { key: 'salary_type', label: '임금 형태', type: 'select', required: true, options: ['월급', '일급', '시간급'], defaultValue: '월급' },
  { key: 'salary_amount', label: '임금액', type: 'text', required: true, format: 'currency', placeholder: '숫자만 입력 (예: 3000000)' },
  { key: 'bonus', label: '상여금', type: 'select', options: ['있음', '없음'], defaultValue: '없음' },
  { key: 'bonus_amount', label: '상여금액', type: 'text', placeholder: '상여금 있음일 때 입력 (예: 연 500만원)' },
  { key: 'other_allowance', label: '기타급여(제수당 등)', type: 'textarea', placeholder: '예: 식대 100,000원, 직책수당 200,000원' },
  { key: 'pay_date', label: '임금지급일', type: 'text', defaultValue: '매월 25일', placeholder: '예: 매월 25일' },
  { key: 'pay_method', label: '지급방법', type: 'select', options: ['근로자에게 직접지급', '근로자 명의 예금통장에 입금'], defaultValue: '근로자 명의 예금통장에 입금' },
  { key: 'social_insurance', label: '사회보험 적용', type: 'checkbox', options: ['고용보험', '산재보험', '국민연금', '건강보험'], defaultValue: '고용보험,산재보험,국민연금,건강보험' },
  { key: 'nda_agree', label: '비밀유지의무 동의', type: 'checkbox', options: ['동의'], defaultValue: '동의' },
  { key: 'contract_date', label: '계약 체결일', type: 'date', required: true, defaultValue: '{{report_date}}' },
  { key: 'company_address', label: '사업체 주소', type: 'textarea', defaultValue: '서울특별시 강남구 강남대로 354(혜천빌딩) 1126-5호' },
  { key: 'representative_name', label: '대표자', type: 'text', defaultValue: '김동의' },
  { key: 'company_phone', label: '사업체 전화', type: 'text', defaultValue: '010-8490-9271' },
  { key: 'employee_address', label: '근로자 주소', type: 'textarea', placeholder: '예: 서울특별시 ...' },
  { key: 'employee_contact', label: '근로자 연락처', type: 'text', format: 'phone', placeholder: '숫자만 입력 (예: 01012345678)' },
];

export const STANDARD_LABOR_CONTRACT_OUTLINE = [
  '# 표준근로계약서',
  '## 근로조건',
  '## 임금',
  '## 기타 사항',
].join('\n');

export const STANDARD_LABOR_CONTRACT_TEMPLATE_HTML = `
<style>
@page{size:A4;margin:0;}
.labor-contract{box-sizing:border-box;width:210mm;min-height:297mm;margin:0 auto;padding:18mm 20mm;background:#fff;color:#111;font-family:Batang,"AppleMyungjo","Nanum Myeongjo","Noto Serif KR",serif;font-size:3.5mm;line-height:1.55;letter-spacing:-0.2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.labor-contract *{box-sizing:border-box;}
.labor-contract .title{margin:0 0 9mm;text-align:center;font-size:8mm;font-weight:700;letter-spacing:2mm;}
.labor-contract .intro{margin:0 0 6mm;line-height:1.8;}
.labor-contract .employ-block{margin:0 0 6mm;line-height:1.7;}
.labor-contract .employ-type .type-opts span{margin-right:5mm;white-space:nowrap;}
.labor-contract .employ-period{margin-top:1.8mm;color:#111;}
.labor-contract .employ-period:empty{display:none;}
.labor-contract .terms{margin:0;padding:0;list-style:none;}
.labor-contract .terms > li{margin:0 0 3.4mm;}
.labor-contract .term-title{font-weight:700;margin-bottom:1mm;}
.labor-contract .sub{padding-left:5mm;line-height:1.7;}
.labor-contract .insurance span{margin-right:5mm;white-space:nowrap;}
.labor-contract .opt-inline span{margin-right:4mm;white-space:nowrap;}
.labor-contract .nda-agree{margin-top:2mm;font-weight:600;}
.labor-contract .sign-date{margin:9mm 0 7mm;text-align:center;letter-spacing:0.5mm;}
.labor-contract .sign-party{margin:0 0 5mm;}
.labor-contract .sign-role{font-weight:700;margin-bottom:1.5mm;}
.labor-contract .sign-line{display:grid;grid-template-columns:22mm 1fr;column-gap:3mm;margin-bottom:1.4mm;padding-left:4mm;}
.labor-contract .sign-label{color:#333;}
.labor-contract .sign-seal{color:#666;}
.labor-contract .seal{position:relative;display:inline-block;width:14mm;height:1em;line-height:1;margin:0 1mm;vertical-align:middle;}
.labor-contract .seal-text{color:#888;font-size:3mm;}
.labor-contract .seal-image{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:14mm;height:14mm;object-fit:contain;}
.labor-contract .seal-image[src=""]{display:none;}
@media print{html,body{width:210mm;margin:0!important;padding:0!important;background:#fff;}.labor-contract{margin:0;box-shadow:none;}}
</style>
<article class="labor-contract">
  <h1 class="title">{{report_title}}</h1>

  <p class="intro">{{employer_name}}(이하 "사업주"라 함)과(와) {{employee_name}}(이하 "근로자"라 함)은 다음과 같이 근로계약을 체결한다.</p>

  <div class="employ-block">
    <div class="employ-type"><span class="term-title">근로의 종류 :</span> <span class="type-opts"><span>{{employment_type_opt0}} 정규직</span> <span>{{employment_type_opt1}} 계약직</span> <span>{{employment_type_opt2}} 취업연동인턴</span> <span>{{employment_type_opt3}} 체험인턴</span></span></div>
    <div class="employ-period">{{employment_period_display}}</div>
  </div>

  <ol class="terms">
    <li><span class="term-title">1. 근로개시일 :</span> {{work_start_date_ko}} 부터</li>
    <li><span class="term-title">2. 근 무 장 소 :</span> {{work_place}}</li>
    <li><span class="term-title">3. 업무의 내용 :</span> {{job_description}}</li>
    <li><span class="term-title">4. 소정근로시간 :</span> {{work_time_start}} 부터 {{work_time_end}} 까지 (휴게시간 : {{break_time}})</li>
    <li><div class="term-title">5. 근무일/휴일</div>
      <div class="sub">- 근무일 : 매주 {{work_days_per_week}} 근무</div>
      <div class="sub opt-inline">- 주휴일 : <span>{{weekly_holiday_opt0}} 월</span> <span>{{weekly_holiday_opt1}} 화</span> <span>{{weekly_holiday_opt2}} 수</span> <span>{{weekly_holiday_opt3}} 목</span> <span>{{weekly_holiday_opt4}} 금</span> <span>{{weekly_holiday_opt5}} 토</span> <span>{{weekly_holiday_opt6}} 일</span></div>
    </li>
    <li><div class="term-title">6. 임 금</div>
      <div class="sub">- {{salary_type}} : {{salary_amount_display}}</div>
      <div class="sub">- 상여금 : {{bonus}} {{bonus_amount}}</div>
      <div class="sub">- 기타급여(제수당 등) : {{other_allowance}}</div>
      <div class="sub">- 임금지급일 : {{pay_date}}</div>
      <div class="sub">- 지급방법 : {{pay_method}}</div>
    </li>
    <li><div class="term-title">7. 연차유급휴가</div>
      <div class="sub">- 연차유급휴가는 근로기준법에서 정하는 바에 따라 부여함</div>
    </li>
    <li><div class="term-title">8. 사회보험 적용여부(해당란에 체크)</div>
      <div class="sub insurance"><span>{{social_insurance_opt0}} 고용보험</span> <span>{{social_insurance_opt1}} 산재보험</span> <span>{{social_insurance_opt2}} 국민연금</span> <span>{{social_insurance_opt3}} 건강보험</span></div>
    </li>
    <li><div class="term-title">9. 근로계약서 교부</div>
      <div class="sub">- 사업주는 근로계약을 체결함과 동시에 본 계약서를 사본하여 근로자의 교부요구와 관계없이 근로자에게 교부함(근로기준법 제17조 이행)</div>
    </li>
    <li><div class="term-title">10. 근로계약, 취업규칙 등의 성실한 이행의무</div>
      <div class="sub">- 사업주와 근로자는 각자가 근로계약, 취업규칙, 단체협약을 지키고 성실하게 이행하여야 함</div>
    </li>
    <li><div class="term-title">11. 비밀유지의무</div>
      <div class="sub">- ${NDA_CLAUSE_TEXT}</div>
      <div class="sub nda-agree">{{nda_agree_opt0}} 위 비밀유지의무에 동의하며 이를 성실히 준수할 것을 서약합니다.</div>
    </li>
    <li><div class="term-title">12. 기 타</div>
      <div class="sub">- 이 계약에 정함이 없는 사항은 근로기준법령에 의함</div>
    </li>
  </ol>

  <p class="sign-date">{{contract_date_ko}}</p>

  <div class="sign">
    <div class="sign-party">
      <div class="sign-role">(사업주)</div>
      <div class="sign-line"><span class="sign-label">사업체명</span> <span>{{employer_name}}<span class="seal"><span class="seal-text">(인)</span><img class="seal-image" src="{{signature_image_src}}" alt="직인" /></span></span></div>
      <div class="sign-line"><span class="sign-label">주 소</span> <span>{{company_address}}</span></div>
      <div class="sign-line"><span class="sign-label">전 화</span> <span>{{company_phone}}</span></div>
      <div class="sign-line"><span class="sign-label">대 표 자</span> <span>{{representative_name}}</span></div>
    </div>
    <div class="sign-party">
      <div class="sign-role">(근로자)</div>
      <div class="sign-line"><span class="sign-label">주 소</span> <span>{{employee_address}}</span></div>
      <div class="sign-line"><span class="sign-label">연 락 처</span> <span>{{employee_contact_display}}</span></div>
      <div class="sign-line"><span class="sign-label">성 명</span> <span>{{employee_name}} <span class="sign-seal">(서명 또는 인)</span></span></div>
    </div>
  </div>
</article>
`.trim();

export function isStandardLaborContractTemplateName(templateName: string | null | undefined) {
  return Boolean(templateName && /근로계약서/.test(templateName));
}

/** 숫자 → 한글 금액 (예: 3000000 → 삼백만) */
function numberToKorean(num: number): string {
  if (num === 0) return '영';
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const smallUnit = ['', '십', '백', '천'];
  const bigUnit = ['', '만', '억', '조', '경'];
  let result = '';
  let bigIdx = 0;
  let n = num;
  while (n > 0 && bigIdx < bigUnit.length) {
    const chunk = n % 10000;
    if (chunk > 0) {
      let chunkStr = '';
      let c = chunk;
      let u = 0;
      while (c > 0) {
        const d = c % 10;
        if (d > 0) chunkStr = digits[d] + smallUnit[u] + chunkStr;
        c = Math.floor(c / 10);
        u += 1;
      }
      result = chunkStr + bigUnit[bigIdx] + result;
    }
    n = Math.floor(n / 10000);
    bigIdx += 1;
  }
  return result;
}

/** 임금액 문자열 → "3,000,000원 (금 삼백만원정)". 숫자 파싱 불가 시 원본 반환 */
export function formatSalaryAmount(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const digitsOnly = trimmed.replace(/[^0-9]/g, '');
  if (!digitsOnly) return trimmed;
  const num = parseInt(digitsOnly, 10);
  if (!Number.isFinite(num) || num <= 0) return trimmed;
  return `${num.toLocaleString('en-US')}원 (금 ${numberToKorean(num)}원정)`;
}

/** 전화번호 문자열 → 하이픈 포맷 (예: 01012345678 → 010-1234-5678). 규격 외는 원본 반환 */
export function formatPhoneNumber(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const d = trimmed.replace(/[^0-9]/g, '');
  if (!d) return trimmed;
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) {
    return d.startsWith('02')
      ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`
      : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (d.length === 9 && d.startsWith('02')) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return trimmed;
}

export function createStandardLaborContractTemplateBundle(): TemplateBundle {
  return {
    version: 1,
    mode: 'html-template',
    layoutHtml: STANDARD_LABOR_CONTRACT_TEMPLATE_HTML,
    outline: STANDARD_LABOR_CONTRACT_OUTLINE,
    fields: STANDARD_LABOR_CONTRACT_FIELDS,
    sections: [],
  };
}
