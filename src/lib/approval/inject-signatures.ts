// 렌더된 양식 HTML의 결재란(<td class="ap-sign">)에 결재 진행 상태에 따라
// 각 결재자 서명을 순서대로 주입한다. 결재란 테이블 구조는 건드리지 않는다.
// - 셀 순서 = 결재 단계 순서(step_order 1=기안/담당 …)
// - 전결 단계는 서명 + "전결" 표기, 그 위(생략) 칸은 빈칸 유지

export interface ApprovalCellFill {
  /** 서명 이미지 data URL (없으면 null → 빈칸) */
  signatureDataUrl: string | null;
  /** 전결 여부 → "전결" 라벨 표시 */
  delegated?: boolean;
}

const AP_SIGN_CELL = /<td class="ap-sign">[\s\S]*?<\/td>/g;

/** ap-sign 셀들을 순서대로 fills로 채운다. fills 길이를 넘는 셀은 원본 유지. */
export function injectApprovalSignatures(html: string, fills: ApprovalCellFill[]): string {
  let idx = 0;
  return html.replace(AP_SIGN_CELL, (original) => {
    const fill = fills[idx];
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
  steps: Array<{ step_order: number; status: string; signatureDataUrl: string | null }>,
): ApprovalCellFill[] {
  return [...steps]
    .sort((a, b) => a.step_order - b.step_order)
    .map((s) => {
      if (s.status === 'approved' || s.status === 'delegated') {
        return { signatureDataUrl: s.signatureDataUrl, delegated: s.status === 'delegated' };
      }
      return { signatureDataUrl: null };
    });
}
