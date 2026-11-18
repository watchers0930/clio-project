// 렌더된 양식 HTML의 결재란(<td class="ap-sign">)에 결재 진행 상태에 따라
// 각 결재자 서명을 주입한다. 결재란 테이블 구조는 건드리지 않는다.
// - 1단계(담당·기안)는 항상 첫 칸
// - 결재선이 칸 수보다 짧으면(예: 사원→대표 2단계, 칸은 담당/관리/대표 3칸)
//   직급명이 칸 이름과 순서대로 맞으면 그 칸에, 아니면 마지막 결재자가 맨 오른쪽(대표·승인) 칸에 오게 오른쪽으로 붙인다
// - 전결 단계는 서명 + "전결" 표기, 그 위(생략) 칸은 빈칸 유지

export interface ApprovalCellFill {
  /** 서명 이미지 data URL (없으면 null → 빈칸) */
  signatureDataUrl: string | null;
  /** 전결 여부 → "전결" 라벨 표시 */
  delegated?: boolean;
  /** 결재 단계 직급명(담당·팀장·대표 …) — 결재란 칸 이름과 맞춰 칸을 고른다 */
  rankTitle?: string | null;
}

const AP_SIGN_CELL = /<td class="ap-sign">[\s\S]*?<\/td>/g;
const AP_LABEL_CELL = /<td class="ap-label">([\s\S]*?)<\/td>/g;

/** 결재 단계 i 가 들어갈 칸 번호 목록. 칸보다 단계가 많으면 앞에서부터 순서대로(넘치는 단계는 버림). */
export function placeApprovalCells(cellCount: number, labels: string[], fills: ApprovalCellFill[]): number[] {
  const m = fills.length;
  if (m >= cellCount || m === 0) return fills.map((_, i) => i);
  // 칸 이름과 직급명이 순서대로 모두 맞으면 그 칸
  if (labels.length === cellCount) {
    const byLabel = [0];
    for (let i = 1; i < m; i += 1) {
      const want = (fills[i].rankTitle ?? '').trim();
      const at = labels.findIndex((l, idx) => idx > byLabel[i - 1] && l === want);
      if (!want || at < 0) break;
      byLabel.push(at);
    }
    if (byLabel.length === m) return byLabel;
  }
  // 오른쪽 정렬: 첫 칸=담당, 나머지는 마지막 칸(최종 결재)부터 거꾸로
  return fills.map((_, i) => (i === 0 ? 0 : cellCount - m + i));
}

/** ap-sign 셀들을 결재 단계에 맞춰 채운다. 배정되지 않은 셀은 원본 유지. */
export function injectApprovalSignatures(html: string, fills: ApprovalCellFill[]): string {
  const cellCount = html.match(AP_SIGN_CELL)?.length ?? 0;
  const labels = [...html.matchAll(AP_LABEL_CELL)].map((x) => x[1].replace(/<[^>]*>/g, '').trim());
  const placement = placeApprovalCells(cellCount, labels, fills);
  const fillAt = new Map<number, ApprovalCellFill>();
  placement.forEach((cell, i) => { if (cell < cellCount) fillAt.set(cell, fills[i]); });

  let idx = 0;
  return html.replace(AP_SIGN_CELL, (original) => {
    const fill = fillAt.get(idx);
    idx += 1;
    if (!fill) return original;
    if (!fill.signatureDataUrl) return '<td class="ap-sign"></td>';
    const img = `<img src="${fill.signatureDataUrl}" style="max-height:15mm;max-width:90%;object-fit:contain;" alt="" />`;
    const tag = fill.delegated
      ? `${img}<div style="font-size:3mm;font-weight:800;color:#7c5cdb;margin-top:1mm;">전결</div>`
      : img;
    return `<td class="ap-sign">${tag}</td>`;
  });
}

/** 결재 단계 상태 → 각 셀 채움 정보로 변환.
 * step_order 오름차순, status가 approved/delegated면 서명 표시, delegated면 전결 표기,
 * 그 뒤 skipped 단계는 빈칸. */
export function buildApprovalFills(
  steps: Array<{ step_order: number; status: string; signatureDataUrl: string | null; rank_title?: string | null }>,
): ApprovalCellFill[] {
  return [...steps]
    .sort((a, b) => a.step_order - b.step_order)
    .map((s) => {
      if (s.status === 'approved' || s.status === 'delegated') {
        return { signatureDataUrl: s.signatureDataUrl, delegated: s.status === 'delegated', rankTitle: s.rank_title ?? null };
      }
      return { signatureDataUrl: null, rankTitle: s.rank_title ?? null };
    });
}
