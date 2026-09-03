import type { TemplateBundle, TemplateFieldDefinition } from '@/lib/templates/template-schema';

export const LEAVE_APPLICATION_TEMPLATE_NAME = '휴가원';

export const LEAVE_APPLICATION_FIELDS: TemplateFieldDefinition[] = [
  { key: 'report_title', label: '문서 제목', type: 'text', required: true, defaultValue: '휴가원' },
  { key: 'department', label: '부서', type: 'text', placeholder: '예: 개발팀' },
  { key: 'employee_name', label: '성명', type: 'text', required: true, placeholder: '예: 홍길동' },
  { key: 'emergency_contact', label: '비상연락처', type: 'text', placeholder: '예: 010-0000-0000' },
  { key: 'hire_date', label: '입사일', type: 'date', required: true },
  { key: 'leave_start_date', label: '휴가 시작일', type: 'date', required: true },
  { key: 'leave_end_date', label: '휴가 종료일', type: 'date', required: true },
  { key: 'used_leave_days', label: '기 사용 휴가일수', type: 'text', defaultValue: '0', placeholder: '예: 3' },
  { key: 'leave_reason', label: '사유', type: 'textarea', placeholder: '예: 개인 사유' },
  { key: 'report_date', label: '신청일', type: 'date', autoFill: 'document' },
  { key: 'company_name', label: '회사명', type: 'text', defaultValue: '주식회사 비엠아이씨앤에스' },
  { key: 'representative_name', label: '대표자', type: 'text', defaultValue: '김동의' },
];

export const LEAVE_APPLICATION_OUTLINE = ['# 휴가원', '## 신청자 정보', '## 휴가 내역'].join('\n');

/** 남은 휴가일수 계산 (입사일·기사용일수·기준일 기반)
 * - 1년 미만: 입사일부터 만근 개월수(최대 11일)
 * - 1년 이상: 15일
 * - 남은일수 = 발생 - 기사용
 */
export function computeRemainingLeaveDays(hireDate: string, usedDays: number, baseDate: string): number {
  const hire = new Date(hireDate);
  const base = baseDate ? new Date(baseDate) : hire;
  if (Number.isNaN(hire.getTime()) || Number.isNaN(base.getTime())) return 0;

  const firstAnniversary = new Date(hire.getFullYear() + 1, hire.getMonth(), hire.getDate());
  let granted: number;
  if (base < firstAnniversary) {
    // 만근 개월수 (해당 월의 입사일자 도달 전이면 미포함)
    let months = (base.getFullYear() - hire.getFullYear()) * 12 + (base.getMonth() - hire.getMonth());
    if (base.getDate() < hire.getDate()) months -= 1;
    granted = Math.min(Math.max(0, months), 11);
  } else {
    granted = 15;
  }
  const used = Number.isFinite(usedDays) ? usedDays : 0;
  return Math.max(0, granted - used);
}

export const LEAVE_APPLICATION_TEMPLATE_HTML = `
<style>
@page{size:A4;margin:0;}
.leave-app{position:relative;box-sizing:border-box;width:210mm;height:297mm;min-height:297mm;margin:0 auto;background:#fff;color:#111;overflow:hidden;font-family:Batang,"AppleMyungjo","Nanum Myeongjo","Noto Serif KR",serif;letter-spacing:-1px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.leave-app *{box-sizing:border-box;}
.leave-app .title{position:absolute;top:32mm;left:0;z-index:1;width:100%;margin:0;text-align:center;font-size:12mm;font-weight:700;letter-spacing:2mm;line-height:1;}
.leave-app .section{position:absolute;left:28mm;z-index:1;width:154mm;font-size:4.2mm;line-height:1;}
.leave-app .section-1{top:62mm;}
.leave-app .section-2{top:112mm;}
.leave-app .section-title{margin:0 0 5mm 1mm;font-size:4.4mm;font-weight:700;line-height:1;}
.leave-app table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #222;}
.leave-app td{height:11mm;border:1px solid #222;vertical-align:middle;font-size:4.2mm;font-weight:400;line-height:1.35;}
.leave-app .label{text-align:center;background:#f5f5f5;}
.leave-app col:nth-child(1){width:20%;}
.leave-app col:nth-child(2){width:30%;}
.leave-app col:nth-child(3){width:20%;}
.leave-app col:nth-child(4){width:30%;}
.leave-app .value{padding:0 4mm;letter-spacing:0;white-space:normal;word-break:keep-all;}
.leave-app .highlight{font-weight:700;color:#1A5AD9;}
.leave-app .statement{position:absolute;top:176mm;left:0;z-index:1;width:100%;margin:0;text-align:center;font-size:4.4mm;line-height:1;}
.leave-app .date{position:absolute;top:200mm;left:0;z-index:1;width:100%;margin:0;text-align:center;font-size:4.2mm;line-height:1;letter-spacing:0;word-spacing:3mm;}
.leave-app .signer{position:absolute;top:222mm;left:0;z-index:1;width:100%;text-align:center;font-size:4.4mm;line-height:1;}
.leave-app .signer .name{margin-left:4mm;font-weight:700;letter-spacing:1mm;}
.leave-app .approver{position:absolute;top:246mm;left:0;z-index:1;width:100%;text-align:center;font-size:4.2mm;}
@media print{html,body{width:210mm;height:297mm;min-height:297mm;margin:0!important;padding:0!important;background:#fff;overflow:hidden}.leave-app{width:210mm;height:297mm;min-height:297mm;margin:0;box-shadow:none;}}
</style>
<article class="leave-app">
  <h1 class="title">{{report_title}}</h1>

  <section class="section section-1">
    <h2 class="section-title">1. 신청자 정보</h2>
    <table>
      <colgroup><col><col><col><col></colgroup>
      <tbody>
        <tr>
          <td class="label">부서</td>
          <td class="value">{{department}}</td>
          <td class="label">성명</td>
          <td class="value">{{employee_name}}</td>
        </tr>
        <tr>
          <td class="label">입사일</td>
          <td class="value">{{hire_date_ko}}</td>
          <td class="label">비상연락처</td>
          <td class="value">{{emergency_contact}}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section class="section section-2">
    <h2 class="section-title">2. 휴가 내역</h2>
    <table>
      <colgroup><col><col><col><col></colgroup>
      <tbody>
        <tr>
          <td class="label">휴가기간</td>
          <td class="value" colspan="3">{{leave_start_date_ko}} ~ {{leave_end_date_ko}}</td>
        </tr>
        <tr>
          <td class="label">기 사용 휴가</td>
          <td class="value">{{used_leave_days}} 일</td>
          <td class="label">남은 휴가일수</td>
          <td class="value highlight">{{remaining_leave_days}} 일</td>
        </tr>
        <tr>
          <td class="label">사유</td>
          <td class="value" colspan="3">{{leave_reason}}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <p class="statement">위와 같이 휴가를 신청합니다.</p>
  <p class="date">{{report_date_ko}}</p>
  <p class="signer">신청인 : <span class="name">{{employee_name}}</span> (서명)</p>
  <p class="approver">{{company_name}} 대표이사 {{representative_name}} 귀하</p>
</article>
`.trim();

export function isLeaveApplicationTemplateName(templateName: string | null | undefined) {
  return Boolean(templateName && /휴가원/.test(templateName));
}

export function createLeaveApplicationTemplateBundle(): TemplateBundle {
  return {
    version: 1,
    mode: 'html-template',
    layoutHtml: LEAVE_APPLICATION_TEMPLATE_HTML,
    outline: LEAVE_APPLICATION_OUTLINE,
    fields: LEAVE_APPLICATION_FIELDS,
    sections: [],
  };
}
