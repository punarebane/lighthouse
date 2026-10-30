import { wrapAngle } from './math';

/**
 * Uniform-grid spatial hash built by counting sort, so a rebuild is two linear passes and
 * never allocates. Covers the square [-half, half]^2; anything outside is clamped into the
 * border cells (queries still do an exact narrow-phase test, so clamping is safe).
 */
export class SpatialHash {
  readonly cellSize: number;
  readonly half: number;
  readonly dim: number;
  readonly cellStart: Int32Array; // dim*dim + 1
  private readonly cellFill: Int32Array;
  readonly items: Int32Array; // indices sorted by cell
  private readonly cellOf: Int32Array; // cell of each indexed item
  count = 0;

  constructor(half: number, cellSize: number, capacity: number) {
    this.cellSize = cellSize;
    this.half = half;
    this.dim = Math.ceil((half * 2) / cellSize);
    const cells = this.dim * this.dim;
    this.cellStart = new Int32Array(cells + 1);
    this.cellFill = new Int32Array(cells);
    this.items = new Int32Array(capacity);
    this.cellOf = new Int32Array(capacity);
  }

  cellCoord(v: number): number {
    const c = Math.floor((v + this.half) / this.cellSize);
    return c < 0 ? 0 : c >= this.dim ? this.dim - 1 : c;
  }

  /** Rebuild from SoA positions for every live slot in [0, hi). */
  rebuild(xs: Float32Array, ys: Float32Array, alive: Uint8Array, hi: number): void {
    const start = this.cellStart;
    const fill = this.cellFill;
    const cellOf = this.cellOf;
    start.fill(0);
    for (let i = 0; i < hi; i++) {
      if (!alive[i]) {
        cellOf[i] = -1;
        continue;
      }
      const c = this.cellCoord(ys[i]!) * this.dim + this.cellCoord(xs[i]!);
      cellOf[i] = c;
      start[c + 1]!++;
    }
    const cells = this.dim * this.dim;
    for (let c = 0; c < cells; c++) start[c + 1]! += start[c]!;
    for (let c = 0; c < cells; c++) fill[c] = start[c]!;
    for (let i = 0; i < hi; i++) {
      const c = cellOf[i]!;
      if (c >= 0) this.items[fill[c]!++] = i;
    }
    this.count = start[cells]!;
  }

  /**
   * Collect candidates in cells overlapping the AABB [x0,x1]x[y0,y1] into `out`
   * (starting at `n`); returns the new count. Broad phase only.
   */
  queryAABB(x0: number, y0: number, x1: number, y1: number, out: Int32Array, n: number): number {
    const cx0 = this.cellCoord(x0), cx1 = this.cellCoord(x1);
    const cy0 = this.cellCoord(y0), cy1 = this.cellCoord(y1);
    const cap = out.length;
    for (let cy = cy0; cy <= cy1; cy++) {
      const row = cy * this.dim;
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = row + cx;
        const end = this.cellStart[c + 1]!;
        for (let k = this.cellStart[c]!; k < end && n < cap; k++) out[n++] = this.items[k]!;
      }
    }
    return n;
  }

  /** Exact circle query: indices whose centre is within r (+ per-item radius) of (x, y). */
  queryCircle(
    x: number, y: number, r: number,
    xs: Float32Array, ys: Float32Array, radii: Float32Array | null, maxR: number,
    out: Int32Array,
  ): number {
    const pad = radii ? maxR : 0; // max entity radius margin for the broad phase
    const n = this.queryAABB(x - r - pad, y - r - pad, x + r + pad, y + r + pad, out, 0);
    let m = 0;
    for (let k = 0; k < n; k++) {
      const i = out[k]!;
      const dx = xs[i]! - x, dy = ys[i]! - y;
      const rr = r + (radii ? radii[i]! : 0);
      if (dx * dx + dy * dy <= rr * rr) out[m++] = i;
    }
    return m;
  }

  /**
   * Cone query. Broad phase: cells overlapping the bounding box of the cone's wedge
   * (apex, both edge endpoints, and any axis extreme the arc sweeps through), with cells
   * entirely beyond range skipped. Narrow phase: distance + angle test against each item.
   */
  queryCone(
    ox: number, oy: number, dir: number, halfWidth: number, range: number,
    xs: Float32Array, ys: Float32Array, radii: Float32Array | null, maxR: number,
    out: Int32Array,
  ): number {
    const reach = range + maxR;
    let x0 = ox, x1 = ox, y0 = oy, y1 = oy;
    const a0 = dir - halfWidth, a1 = dir + halfWidth;
    const ex0 = ox + Math.cos(a0) * reach, ey0 = oy + Math.sin(a0) * reach;
    const ex1 = ox + Math.cos(a1) * reach, ey1 = oy + Math.sin(a1) * reach;
    x0 = Math.min(x0, ex0, ex1); x1 = Math.max(x1, ex0, ex1);
    y0 = Math.min(y0, ey0, ey1); y1 = Math.max(y1, ey0, ey1);
    if (halfWidth >= Math.PI) {
      x0 = ox - reach; x1 = ox + reach; y0 = oy - reach; y1 = oy + reach;
    } else {
      // axis extremes swept by the arc: angles 0, PI/2, PI, -PI/2
      for (let q = 0; q < 4; q++) {
        const ang = (q * Math.PI) / 2;
        if (Math.abs(wrapAngle(ang - dir)) <= halfWidth) {
          const px = ox + Math.cos(ang) * reach, py = oy + Math.sin(ang) * reach;
          if (px < x0) x0 = px; if (px > x1) x1 = px;
          if (py < y0) y0 = py; if (py > y1) y1 = py;
        }
      }
    }
    // pad by the max item radius so circles straddling an edge are caught
    x0 -= maxR; y0 -= maxR; x1 += maxR; y1 += maxR;

    const cs = this.cellSize;
    const cx0 = this.cellCoord(x0), cx1 = this.cellCoord(x1);
    const cy0 = this.cellCoord(y0), cy1 = this.cellCoord(y1);
    const cap = out.length;
    const reach2 = (reach + cs * 0.7072) * (reach + cs * 0.7072);
    let m = 0;
    for (let cy = cy0; cy <= cy1; cy++) {
      const ccy = (cy + 0.5) * cs - this.half - oy;
      for (let cx = cx0; cx <= cx1; cx++) {
        const ccx = (cx + 0.5) * cs - this.half - ox;
        // skip cells whose centre is further than reach + half-diagonal (unless clamped border cells)
        const border = cx === 0 || cy === 0 || cx === this.dim - 1 || cy === this.dim - 1;
        if (!border && ccx * ccx + ccy * ccy > reach2) continue;
        const c = cy * this.dim + cx;
        const end = this.cellStart[c + 1]!;
        for (let k = this.cellStart[c]!; k < end; k++) {
          const i = this.items[k]!;
          const dx = xs[i]! - ox, dy = ys[i]! - oy;
          const r = radii ? radii[i]! : 0;
          const rr = range + r;
          const d2 = dx * dx + dy * dy;
          if (d2 > rr * rr) continue;
          if (d2 > r * r) {
            const d = Math.sqrt(d2);
            const ang = r > 0 ? Math.asin(r / d) : 0;
            if (Math.abs(wrapAngle(Math.atan2(dy, dx) - dir)) > halfWidth + ang) continue;
          }
          if (m < cap) out[m++] = i;
        }
      }
    }
    return m;
  }
}
