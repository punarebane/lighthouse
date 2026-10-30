export const TAU = Math.PI * 2;

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = a % TAU;
  if (a <= -Math.PI) a += TAU;
  else if (a > Math.PI) a -= TAU;
  return a;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Rotate `from` toward `to` by at most `maxStep` radians, taking the short way round. */
export function approachAngle(from: number, to: number, maxStep: number): number {
  const d = wrapAngle(to - from);
  if (Math.abs(d) <= maxStep) return wrapAngle(to);
  return wrapAngle(from + Math.sign(d) * maxStep);
}

/**
 * Cone/circle intersection. The cone has its apex at the origin, points along `dir`,
 * spans `halfWidth` either side and reaches `range`. The target is a circle at (dx, dy)
 * (relative to the apex) with radius `r`. Returns true if any part of the circle's centre
 * region overlaps the cone (we treat the circle as overlapping if its centre is within
 * range + r and within halfWidth + angular radius of the axis).
 */
export function inCone(dx: number, dy: number, r: number, dir: number, halfWidth: number, range: number): boolean {
  const d2 = dx * dx + dy * dy;
  const reach = range + r;
  if (d2 > reach * reach) return false;
  if (d2 <= r * r) return true; // apex is inside the target
  const d = Math.sqrt(d2);
  const angular = r > 0 ? Math.asin(r / d) : 0;
  const diff = Math.abs(wrapAngle(Math.atan2(dy, dx) - dir));
  return diff <= halfWidth + angular;
}

/** Distance falloff for beam damage: 1 at the apex, (1 - strength) at full range. */
export function falloff(dist: number, range: number, strength: number): number {
  const t = range > 0 ? clamp(dist / range, 0, 1) : 1;
  return 1 - strength * t * t;
}

/** Piecewise-linear interpolation through [x, y] keyframes (sorted by x). */
export function curve(points: ReadonlyArray<readonly [number, number]>, x: number): number {
  const n = points.length;
  if (x <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < n; i++) {
    const p = points[i]!;
    if (x <= p[0]) {
      const q = points[i - 1]!;
      return lerp(q[1], p[1], (x - q[0]) / (p[0] - q[0]));
    }
  }
  return points[n - 1]![1];
}
