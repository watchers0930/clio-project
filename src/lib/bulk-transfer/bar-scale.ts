// 지출 비교 막대그래프 - 이상치(유난히 큰 달) 막대의 중간을 생략(축 끊김)해 다른 달과의 차이를 줄이는 배치 계산 (순수 함수)

export interface BarLayout {
  /** 막대 전체 높이(px) */
  heightPx: number;
  /** 막대 아래쪽 고정지출 부분 높이(px) */
  fixedPx: number;
  /** 중간을 생략해 줄여 그린 막대인지 */
  broken: boolean;
}

/** 중앙값의 이 배수를 넘는 달을 이상치로 본다 */
export const OUTLIER_RATIO = 3;
/** 이상치가 있을 때 일반 막대가 쓰는 최대 높이 비율 (나머지는 이상치 막대가 더 높아 보이게 남겨둠) */
const NORMAL_SHARE = 0.7;
const MIN_BAR_PX = 4;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * 월별 총지출 막대 배치.
 * 3개월 이상이고 중앙값의 OUTLIER_RATIO배를 넘는 달이 있으면, 나머지 달 최댓값 기준으로 눈금을 잡고
 * 이상치 달은 최대 높이(maxPx)로 그리되 broken=true(중간 생략)로 표시한다.
 */
export function layoutBars(totals: number[], fixedTotal: number, maxPx: number): BarLayout[] {
  const px = (v: number, scaleMax: number, room: number) =>
    v > 0 ? Math.max(MIN_BAR_PX, Math.round((v / scaleMax) * room)) : 0;

  const positives = totals.filter((t) => t > 0);
  const med = positives.length >= 3 ? median(positives) : 0;
  const isOutlier = (t: number) => med > 0 && t > med * OUTLIER_RATIO;
  const normals = totals.filter((t) => !isOutlier(t));
  const hasOutlier = normals.length < totals.length && normals.some((t) => t > 0);

  if (!hasOutlier) {
    const scaleMax = Math.max(...totals, 1);
    return totals.map((t) => {
      const heightPx = px(t, scaleMax, maxPx);
      const fixedPx = t > 0 ? Math.min(heightPx, Math.round((Math.min(fixedTotal, t) / t) * heightPx)) : 0;
      return { heightPx, fixedPx, broken: false };
    });
  }

  const normalRoom = Math.round(maxPx * NORMAL_SHARE);
  const scaleMax = Math.max(...normals);
  return totals.map((t) => {
    if (isOutlier(t)) {
      // 고정지출 부분은 일반 막대와 같은 눈금으로 그려 비교가 가능하게 한다
      const fixedPx = Math.min(px(Math.min(fixedTotal, t), scaleMax, normalRoom), maxPx);
      return { heightPx: maxPx, fixedPx, broken: true };
    }
    const heightPx = px(t, scaleMax, normalRoom);
    const fixedPx = t > 0 ? Math.min(heightPx, px(Math.min(fixedTotal, t), scaleMax, normalRoom)) : 0;
    return { heightPx, fixedPx, broken: false };
  });
}
