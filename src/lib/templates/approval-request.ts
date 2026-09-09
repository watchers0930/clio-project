import type { TemplateBundle, TemplateFieldDefinition } from '@/lib/templates/template-schema';

export const APPROVAL_REQUEST_TEMPLATE_NAME = '품의서';

export const APPROVAL_REQUEST_FIELDS: TemplateFieldDefinition[] = [
  { key: 'report_title', label: '문서 제목', type: 'text', required: true, defaultValue: '품의서' },
  { key: 'subject', label: '제목(건명)', type: 'text', required: true, placeholder: '예: 사무용품 구매 건' },
  { key: 'purpose', label: '품의 목적', type: 'textarea', placeholder: '예: 업무 효율 향상을 위한 사무용품 구매' },
  { key: 'details', label: '세부 내용', type: 'textarea', placeholder: '품의 세부 내용을 작성하세요' },
  { key: 'budget_amount', label: '소요 예산', type: 'text', placeholder: '예: 1,500,000원' },
  { key: 'execution_date', label: '시행 예정일', type: 'date' },
  { key: 'remarks', label: '비고', type: 'textarea', placeholder: '참고 사항이 있으면 작성하세요' },
  { key: 'report_date', label: '기안일', type: 'date', autoFill: 'document' },
  { key: 'company_name', label: '회사명', type: 'text', defaultValue: '주식회사 비엠아이씨앤에스' },
];

export const APPROVAL_REQUEST_OUTLINE = ['# 품의서', '## 기안 정보', '## 품의 내용'].join('\n');

export const APPROVAL_REQUEST_TEMPLATE_HTML = `
<style>
@page{size:A4;margin:0;}
.approval{position:relative;box-sizing:border-box;width:210mm;min-height:297mm;margin:0 auto;padding:22mm 24mm;background:#fff;color:#111;font-family:Batang,"AppleMyungjo","Nanum Myeongjo","Noto Serif KR",serif;letter-spacing:-0.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.approval *{box-sizing:border-box;}
.approval .top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12mm;}
.approval .title{margin:6mm 0 0 0;font-size:11mm;font-weight:700;letter-spacing:3mm;}
.approval .approval-box{border-collapse:collapse;table-layout:fixed;width:70mm;}
.approval .approval-box td{border:1px solid #222;text-align:center;font-size:3.6mm;}
.approval .approval-box .ap-label{height:7mm;background:#f5f5f5;font-weight:700;}
.approval .approval-box .ap-sign{height:20mm;vertical-align:middle;}
.approval .approval-box .ap-sign img{height:16mm;object-fit:contain;}
.approval .approval-box .ap-sign img[src=""],.approval .approval-box .ap-sign img:not([src]){display:none;}
.approval table.grid{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #222;margin-bottom:7mm;}
.approval table.grid td{border:1px solid #222;vertical-align:middle;font-size:4mm;line-height:1.4;padding:2mm 3mm;}
.approval .label{text-align:left;background:#f5f5f5;font-weight:700;white-space:nowrap;}
.approval .value{text-align:left;white-space:pre-wrap;word-break:keep-all;}
.approval .value.big{vertical-align:top;height:70mm;}
.approval col.c-label{width:22%;}
.approval col.c-value{width:78%;}
.approval col.c-label2{width:20%;}
.approval col.c-value2{width:30%;}
.approval .company{margin-top:16mm;text-align:center;font-size:4.6mm;font-weight:700;}
</style>
<article class="approval">
  <div class="top">
    <h1 class="title">{{report_title}}</h1>
    <table class="approval-box">
      <tbody>
        <tr><td class="ap-label">기안</td><td class="ap-label">검토</td><td class="ap-label">승인</td></tr>
        <tr>
          <td class="ap-sign"><img src="{{signature_image_src}}" alt="" /></td>
          <td class="ap-sign"></td>
          <td class="ap-sign"></td>
        </tr>
      </tbody>
    </table>
  </div>

  <table class="grid">
    <colgroup><col class="c-label2"><col class="c-value2"><col class="c-label2"><col class="c-value2"></colgroup>
    <tbody>
      <tr>
        <td class="label">문서번호</td>
        <td class="value">{{report_no}}</td>
        <td class="label">기안일</td>
        <td class="value">{{report_date_ko}}</td>
      </tr>
      <tr>
        <td class="label">기안부서</td>
        <td class="value">{{author_department}}</td>
        <td class="label">기안자</td>
        <td class="value">{{author}} {{author_position}}</td>
      </tr>
    </tbody>
  </table>

  <table class="grid">
    <colgroup><col class="c-label"><col class="c-value"></colgroup>
    <tbody>
      <tr><td class="label">건명</td><td class="value">{{subject}}</td></tr>
      <tr><td class="label">품의 목적</td><td class="value">{{purpose}}</td></tr>
      <tr><td class="label">세부 내용</td><td class="value big">{{details}}</td></tr>
      <tr><td class="label">소요 예산</td><td class="value">{{budget_amount}}</td></tr>
      <tr><td class="label">시행 예정일</td><td class="value">{{execution_date_ko}}</td></tr>
      <tr><td class="label">비고</td><td class="value">{{remarks}}</td></tr>
    </tbody>
  </table>

  <p class="company">{{company_name}}</p>
</article>
`.trim();

export function isApprovalRequestTemplateName(templateName: string | null | undefined) {
  return Boolean(templateName && /품의서/.test(templateName));
}

export function createApprovalRequestTemplateBundle(): TemplateBundle {
  return {
    version: 1,
    mode: 'html-template',
    layoutHtml: APPROVAL_REQUEST_TEMPLATE_HTML,
    outline: APPROVAL_REQUEST_OUTLINE,
    fields: APPROVAL_REQUEST_FIELDS,
    sections: [],
  };
}
