import type { TemplateBundle, TemplateFieldDefinition } from '@/lib/templates/template-schema';

export const EMPLOYMENT_CERTIFICATE_TEMPLATE_NAME = '재직증명서';

export const EMPLOYMENT_CERTIFICATE_FIELDS: TemplateFieldDefinition[] = [
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
];

export const EMPLOYMENT_CERTIFICATE_OUTLINE = [
  '# 재직증명서',
  '## 인적사항',
  '## 재직사항 및 제출용도',
  '## 증명 및 회사 정보',
].join('\n');

export const EMPLOYMENT_CERTIFICATE_TEMPLATE_HTML = `
<style>
@page{size:A4;margin:0;}
.employment-cert{position:relative;box-sizing:border-box;width:210mm;height:297mm;min-height:297mm;margin:0 auto;background:#fff;color:#111;overflow:hidden;font-family:Batang,"AppleMyungjo","Nanum Myeongjo","Noto Serif KR",serif;letter-spacing:-2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.employment-cert *{box-sizing:border-box;}
.employment-cert .title{position:absolute;top:35mm;left:0;width:100%;margin:0;text-align:center;font-size:11.5mm;font-weight:700;letter-spacing:-2px;line-height:1;}
.employment-cert .section{position:absolute;left:32mm;width:154mm;font-size:4.2mm;line-height:1;}
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
.employment-cert .statement{position:absolute;top:174mm;left:0;width:100%;margin:0;text-align:center;font-size:4.2mm;line-height:1;}
.employment-cert .date{position:absolute;top:202mm;left:0;width:100%;margin:0;text-align:center;font-size:4.2mm;line-height:1;letter-spacing:0;word-spacing:4mm;}
.employment-cert .company-info{position:absolute;top:239mm;left:34mm;width:130mm;font-size:4.2mm;line-height:1;}
.employment-cert .company-row{position:relative;min-height:10.7mm;}
.employment-cert .company-label{display:inline-block;width:26mm;text-align:justify;text-align-last:justify;white-space:nowrap;}
.employment-cert .registration-label{letter-spacing:1.35mm;white-space:nowrap;}
.employment-cert .company-value{display:inline-block;max-width:92mm;padding-left:6mm;letter-spacing:0;line-height:1.35;vertical-align:top;word-break:keep-all;}
.employment-cert .seal{position:absolute;left:75mm;top:0;}
@media print{html,body{width:210mm;height:297mm;min-height:297mm;margin:0!important;padding:0!important;background:#fff;overflow:hidden}.employment-cert{width:210mm;height:297mm;min-height:297mm;margin:0;box-shadow:none;break-after:avoid;page-break-after:avoid;}}
</style>
<article class="employment-cert">
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
    <div class="company-row"><span class="company-label">대 표 자</span><span class="company-value">{{representative_name}}</span><span class="seal">(인)</span></div>
    <div class="company-row"><span class="company-label registration-label">사업자등록</span><span class="company-value">{{business_registration_no}}</span></div>
    <div class="company-row"><span class="company-label">주 소</span><span class="company-value">{{company_address}}</span></div>
    <div class="company-row"><span class="company-label">전 화</span><span class="company-value">{{company_phone}}</span></div>
  </section>
</article>
`.trim();

export function isEmploymentCertificateTemplateName(templateName: string | null | undefined) {
  return Boolean(templateName && /재직\s*증명서/.test(templateName));
}

export function createEmploymentCertificateTemplateBundle(): TemplateBundle {
  return {
    version: 1,
    mode: 'html-template',
    layoutHtml: EMPLOYMENT_CERTIFICATE_TEMPLATE_HTML,
    outline: EMPLOYMENT_CERTIFICATE_OUTLINE,
    fields: EMPLOYMENT_CERTIFICATE_FIELDS,
    sections: [],
  };
}
