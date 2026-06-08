/**
 * 계약서 리스크 분석 PDF용 HTML 리포트 생성
 * - standalone HTML (외부 의존성 없음)
 * - 브라우저에서 열면 바로 인쇄 다이얼로그 트리거 → PDF 저장 가능
 */

import type { ContractRiskAnalysis } from '../types/contract-risk';
import {
  CONTRACT_TYPE_LABELS,
  PERSPECTIVE_LABELS,
  CATEGORY_LABELS,
  RISK_LEVEL_LABELS,
  CONTRACT_RISK_ITEMS,
} from '../contract-risk-items';

const RISK_COLORS: Record<string, string> = {
  high: '#C0392B',
  medium: '#D68910',
  low: '#1E8449',
};

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateContractRiskPdfHtml(analysis: ContractRiskAnalysis): string {
  const { file_name, contract_type, perspective, risk_result, risk_count, created_at } = analysis;
  const foundItems = (risk_result?.items ?? []).filter(i => i.found);
  const total = risk_count.high + risk_count.medium + risk_count.low;
  const dateStr = new Date(created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  const levelOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...foundItems].sort((a, b) => (levelOrder[a.risk_level] ?? 3) - (levelOrder[b.risk_level] ?? 3));

  const rawScore = risk_count.high * 10 + risk_count.medium * 5 + risk_count.low * 2;
  const safetyScore = Math.round(Math.max(0, 100 - (rawScore / 250) * 100));

  let itemsHtml = '';
  for (const item of sorted) {
    const def = CONTRACT_RISK_ITEMS.find(d => d.id === item.id);
    const color = RISK_COLORS[item.risk_level] ?? '#555';
    const label = RISK_LEVEL_LABELS[item.risk_level] ?? item.risk_level;
    const catLabel = def ? (CATEGORY_LABELS[def.category] ?? '') : '';

    itemsHtml += `
      <div class="item">
        <div class="item-header" style="border-left-color:${color}">
          <span class="badge" style="background:${color}">${label}위</span>
          <span class="item-id">${esc(item.id)}</span>
          <span class="item-name">${esc(def?.name ?? item.id)}</span>
          ${catLabel ? `<span class="cat-badge">${esc(catLabel)}</span>` : ''}
        </div>
        ${item.excerpt ? `<div class="section"><div class="section-label" style="color:#2E6FF2">원문 발췌</div><div class="excerpt">${esc(item.excerpt)}</div></div>` : ''}
        ${item.explanation ? `<div class="section"><div class="section-label">AI 분석</div><p>${esc(item.explanation)}</p></div>` : ''}
        ${item.recommendation ? `<div class="section"><div class="section-label" style="color:#1E8449">권고사항</div><div class="recommend">${esc(item.recommendation)}</div></div>` : ''}
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>리스크분석 - ${esc(file_name)}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: '맑은 고딕','Malgun Gothic','Apple SD Gothic Neo',sans-serif; font-size:12px; color:#1B1F2B; line-height:1.7; background:#fff; max-width:800px; margin:0 auto; padding:40px 32px; }
  .cover { text-align:center; padding:60px 0 40px; border-bottom:2px solid #E2E5EA; margin-bottom:32px; }
  .cover h1 { font-size:24px; font-weight:700; color:#1B1F2B; }
  .cover .file { font-size:14px; color:#666; margin-top:8px; }
  .cover .meta { font-size:12px; color:#2E6FF2; margin-top:6px; }
  .cover .date { font-size:11px; color:#999; margin-top:4px; }
  .summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:24px 0; }
  .stat { border-radius:12px; padding:14px 16px; text-align:center; }
  .stat .num { font-size:28px; font-weight:700; }
  .stat .label { font-size:10px; font-weight:600; margin-top:2px; }
  .stat-high { background:#FEF2F2; color:#C0392B; }
  .stat-medium { background:#FFFBEB; color:#D68910; }
  .stat-low { background:#F0FDF4; color:#1E8449; }
  .stat-total { background:#F7F8FA; color:#1B1F2B; }
  .score-row { text-align:center; margin:16px 0 24px; font-size:13px; color:#666; }
  .score-row strong { font-size:22px; }
  h2 { font-size:16px; font-weight:700; color:#1B1F2B; margin:28px 0 12px; padding-bottom:8px; border-bottom:1px solid #E2E5EA; }
  .ai-summary { background:#F7F8FA; border:1px solid #E2E5EA; border-radius:12px; padding:16px; margin-bottom:20px; font-size:13px; color:#333; line-height:1.8; }
  .item { border:1px solid #E2E5EA; border-radius:12px; margin-bottom:14px; overflow:hidden; page-break-inside:avoid; }
  .item-header { display:flex; align-items:center; gap:8px; padding:12px 16px; border-left:4px solid #999; background:#FAFBFC; flex-wrap:wrap; }
  .badge { color:#fff; font-size:10px; font-weight:700; padding:3px 10px; border-radius:8px; }
  .item-id { font-family:monospace; font-size:11px; color:#999; }
  .item-name { font-size:13px; font-weight:600; }
  .cat-badge { font-size:9px; color:#999; background:#F0F1F4; padding:2px 8px; border-radius:6px; }
  .section { padding:10px 16px; }
  .section-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px; color:#1B1F2B; }
  .section p { font-size:12px; color:#333; }
  .excerpt { background:#F7F8FA; border:1px solid #E2E5EA; border-radius:8px; padding:10px 14px; font-size:12px; color:#555; font-style:italic; }
  .recommend { background:#F0FDF4; border:1px solid #BBF7D0; border-radius:8px; padding:10px 14px; font-size:12px; color:#166534; }
  .disclaimer { text-align:center; color:#999; font-size:10px; margin-top:40px; padding-top:20px; border-top:1px solid #E2E5EA; }
  @media print { body { padding:0; } .no-print { display:none; } }
</style>
</head>
<body>
  <div class="cover">
    <h1>계약서 AI 리스크 분석 리포트</h1>
    <div class="file">${esc(file_name)}</div>
    <div class="meta">${esc(CONTRACT_TYPE_LABELS[contract_type] ?? contract_type)} | 입장: ${esc(PERSPECTIVE_LABELS[perspective] ?? perspective)}</div>
    <div class="date">분석 일시: ${esc(dateStr)}</div>
  </div>

  <h2>리스크 요약</h2>
  <div class="summary-grid">
    <div class="stat stat-high"><div class="num">${risk_count.high}</div><div class="label">상위 리스크</div></div>
    <div class="stat stat-medium"><div class="num">${risk_count.medium}</div><div class="label">중위 리스크</div></div>
    <div class="stat stat-low"><div class="num">${risk_count.low}</div><div class="label">하위 리스크</div></div>
    <div class="stat stat-total"><div class="num">${total}</div><div class="label">총 탐지</div></div>
  </div>
  <div class="score-row">안전 점수: <strong>${safetyScore}</strong> / 100</div>

  ${risk_result?.summary ? `<h2>AI 종합 의견</h2><div class="ai-summary">${esc(risk_result.summary)}</div>` : ''}

  ${sorted.length > 0 ? `<h2>탐지된 리스크 항목 상세 (${sorted.length}건)</h2>${itemsHtml}` : ''}

  <div class="disclaimer">
    ⚠️ 이 분석은 AI가 생성한 참고 자료이며 법적 조언이 아닙니다.<br>
    최종 계약 체결 전 법률 전문가 검토를 권장합니다.
  </div>

  <script>window.onload=function(){window.print();}</script>
</body>
</html>`;
}
