export const NODE_COLOR: Record<string, string> = {
  default: '#94A3B8',
  blue:    '#6366F1',
  green:   '#22C55E',
  yellow:  '#F59E0B',
  red:     '#EF4444',
  purple:  '#A855F7',
};

export const BG_COLOR      = '#FFFFFF';
export const LINK_TITLE    = '#6366F1AA';
export const LINK_DASHED   = '#94A3B888';
export const LINK_SEMANTIC = '#3B82F6AA';

export type Pt = { x: number; y: number };

export function convexHull(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const hull: Pt[] = [];
  for (const p of sorted) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
    hull.push(p);
  }
  const t = hull.length + 1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (hull.length >= t && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
    hull.push(p);
  }
  hull.pop();
  return hull;
}

export function hullColor(): string {
  return 'rgba(148, 163, 184, 0.07)';
}
