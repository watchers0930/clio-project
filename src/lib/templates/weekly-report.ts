import type { TemplateBundle, TemplateFieldDefinition } from '@/lib/templates/template-schema';

export const WEEKLY_REPORT_TEMPLATE_NAME = '주간업무';

export const WEEKLY_REPORT_FIELDS: TemplateFieldDefinition[] = [
  { key: 'report_title', label: '문서 제목', type: 'text', required: true, defaultValue: '주간업무' },
  { key: 'report_period', label: '보고기간', type: 'text', placeholder: '예: 2026-10-19 ~ 2026-10-23' },
  { key: 'author', label: '작성자', type: 'text', autoFill: 'user' },
  { key: 'author_department', label: '부서', type: 'text', autoFill: 'user' },
  { key: 'author_position', label: '직급', type: 'text', autoFill: 'user' },
  { key: 'next_week_plan', label: '차주 할 일', type: 'textarea', placeholder: '다음 주 계획을 작성하세요' },
  { key: 'report_date', label: '작성일', type: 'date', autoFill: 'document' },
  // 금주 업무 행(날짜/내용/진행율/비고)의 JSON 배열. 모달의 전용 에디터로 입력하며,
  // 렌더 시 work_rows_html(<tr> 조각)로 변환되어 표 tbody에 주입된다.
  { key: 'work_rows', label: '금주 업무', type: 'textarea' },
];

export const WEEKLY_REPORT_OUTLINE = ['# 주간업무', '## 금주 업무', '## 차주 할 일'].join('\n');

export const WEEKLY_REPORT_TEMPLATE_HTML = `
<style>
@page{size:A4;margin:0;}
.wr{position:relative;box-sizing:border-box;width:210mm;min-height:297mm;margin:0 auto;padding:20mm 22mm;background:#fff;color:#111;font-family:Batang,"AppleMyungjo","Nanum Myeongjo","Noto Serif KR",serif;letter-spacing:-0.3px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.wr *{box-sizing:border-box;}
.wr .top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:9mm;}
.wr .title{margin:4mm 0 0 0;font-size:10mm;font-weight:700;letter-spacing:4mm;}
.wr .approval-box{border-collapse:collapse;table-layout:fixed;width:66mm;}
.wr .approval-box td{border:1px solid #222;text-align:center;font-size:3.4mm;}
.wr .approval-box .ap-side{width:7mm;background:#f5f5f5;font-weight:700;letter-spacing:1mm;}
.wr .approval-box .ap-label{height:7mm;background:#f5f5f5;font-weight:700;}
.wr .approval-box .ap-sign{height:20mm;vertical-align:middle;}
.wr .approval-box .ap-sign img{max-height:17mm;max-width:20mm;object-fit:contain;}
.wr .approval-box .ap-sign img[src=""],.wr .approval-box .ap-sign img:not([src]){display:none;}
.wr table.meta{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:6mm;border:1px solid #222;}
.wr table.meta td{border:1px solid #222;font-size:3.6mm;padding:2mm 3mm;}
.wr table.meta .label{background:#f5f5f5;font-weight:700;text-align:center;white-space:nowrap;}
.wr table.meta col.m-label{width:22mm;}
.wr table.grid{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #222;}
.wr table.grid th,.wr table.grid td{border:1px solid #222;font-size:3.5mm;padding:2mm 2.5mm;line-height:1.55;}
.wr table.grid th{background:#f5f5f5;font-weight:700;height:9mm;text-align:center;}
.wr table.grid td{vertical-align:top;height:13mm;}
.wr table.grid td.center{text-align:center;vertical-align:middle;}
.wr col.c-date{width:20%;}.wr col.c-content{width:50%;}.wr col.c-progress{width:12%;}.wr col.c-note{width:18%;}
.wr .next-week{margin-top:6mm;border:1px solid #222;}
.wr .next-week .nw-title{background:#f5f5f5;font-weight:700;font-size:3.7mm;padding:2mm 3mm;border-bottom:1px solid #222;}
.wr .next-week .nw-body{min-height:32mm;padding:3mm;font-size:3.5mm;line-height:1.75;white-space:pre-wrap;word-break:keep-all;}
</style>
<article class="wr">
  <div class="top">
    <h1 class="title">{{report_title}}</h1>
    <table class="approval-box">
      <tbody>
        <tr>
          <td class="ap-side" rowspan="2">결<br/>재</td>
          <td class="ap-label">담당</td>
          <td class="ap-label">팀장</td>
          <td class="ap-label">대표</td>
        </tr>
        <tr>
          <td class="ap-sign"><img src="{{signature_image_src}}" alt="" /></td>
          <td class="ap-sign"></td>
          <td class="ap-sign"></td>
        </tr>
      </tbody>
    </table>
  </div>

  <table class="meta">
    <colgroup><col class="m-label"/><col/><col class="m-label"/><col/></colgroup>
    <tbody>
      <tr>
        <td class="label">부서</td><td>{{author_department}}</td>
        <td class="label">작성자</td><td>{{author}} {{author_position}}</td>
      </tr>
      <tr>
        <td class="label">보고기간</td><td>{{report_period}}</td>
        <td class="label">작성일</td><td>{{report_date_ko}}</td>
      </tr>
    </tbody>
  </table>

  <table class="grid">
    <colgroup><col class="c-date"/><col class="c-content"/><col class="c-progress"/><col class="c-note"/></colgroup>
    <thead>
      <tr><th>날짜</th><th>내용</th><th>진행율</th><th>비고</th></tr>
    </thead>
    <tbody>
      {{work_rows_html}}
    </tbody>
  </table>

  <div class="next-week">
    <div class="nw-title">차주 할 일</div>
    <div class="nw-body">{{next_week_plan}}</div>
  </div>
</article>
`.trim();

export function isWeeklyReportTemplateName(templateName: string | null | undefined) {
  return Boolean(templateName && /주간\s*업무/.test(templateName));
}

export function createWeeklyReportTemplateBundle(): TemplateBundle {
  return {
    version: 1,
    mode: 'html-template',
    layoutHtml: WEEKLY_REPORT_TEMPLATE_HTML,
    outline: WEEKLY_REPORT_OUTLINE,
    fields: WEEKLY_REPORT_FIELDS,
    sections: [],
  };
}
