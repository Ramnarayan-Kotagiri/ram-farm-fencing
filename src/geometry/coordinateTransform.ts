import { vertices, sides, sideIds, expectedEdges, type SideId } from '../data/farmSurvey';
export type Point = { x: number; z: number };
export const point = (id: string): Point => {
  const v = vertices.find((v) => v.id === id)!;
  return { x: v.e - 522893, z: 1875409.3 - v.n };
};
export const polygon = vertices.map((v) => point(v.id));
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export const path = (side: SideId) => sides[side].path.map(point);
export const pathLength = (pts: Point[]) =>
  pts.slice(1).reduce((sum, p, i) => sum + distance(p, pts[i]), 0);
export function atPath(side: SideId, fraction: number): Point {
  const pts = path(side);
  let left = Math.max(0, Math.min(1, fraction)) * pathLength(pts);
  for (let i = 1; i < pts.length; i++) {
    const d = distance(pts[i - 1], pts[i]);
    if (left <= d || i === pts.length - 1) {
      const t = left / d;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t,
      };
    }
    left -= d;
  }
  return pts[0];
}
export function vertexFractions(side: SideId) {
  const pts = path(side),
    total = pathLength(pts);
  let sum = 0;
  return pts.map((p, i) => {
    if (i) sum += distance(pts[i - 1], p);
    return sum / total;
  });
}
export function inside(p: Point) {
  let c = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
}
export const areaM2 =
  Math.abs(
    polygon.reduce((s, p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      return s + p.x * q.z - q.x * p.z;
    }, 0),
  ) / 2;
export const validation = vertices.map((v, i) => ({
  edge: v.id + '–' + vertices[(i + 1) % vertices.length].id,
  calculated: distance(polygon[i], polygon[(i + 1) % polygon.length]),
  official: expectedEdges[i],
}));
export const geometryWarnings = validation.filter((v) => Math.abs(v.calculated - v.official) > 0.2);
export function latLng(p: Point): [number, number] {
  // Affine interpolation from three supplied control points; sufficient for display, UTM remains authoritative.
  const a = vertices[0],
    b = vertices[1],
    c = vertices[2],
    dx = b.e - a.e,
    dy = b.n - a.n,
    ex = c.e - a.e,
    ey = c.n - a.n,
    det = dx * ey - ex * dy;
  const u = (p.x * ey + ex * p.z) / det,
    v = (-dx * p.z - p.x * dy) / det;
  return [
    a.lat + u * (b.lat - a.lat) + v * (c.lat - a.lat),
    a.lng + u * (b.lng - a.lng) + v * (c.lng - a.lng),
  ];
}
export const surveyPerimeter = sideIds.reduce((sum, id) => sum + sides[id].meters, 0);
