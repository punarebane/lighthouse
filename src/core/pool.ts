/**
 * Fixed-capacity free-list index allocator for structure-of-arrays stores.
 * alloc() pops the free stack (lowest indices first), free() pushes back. `hi` is the
 * high-water mark so iteration can stop early: for (i = 0; i < hi; i++) if (alive[i]) ...
 */
export class Pool {
  readonly cap: number;
  readonly alive: Uint8Array;
  private readonly free_: Int32Array;
  private top: number;
  count = 0;
  hi = 0;

  constructor(cap: number) {
    this.cap = cap;
    this.alive = new Uint8Array(cap);
    this.free_ = new Int32Array(cap);
    this.top = cap;
    for (let i = 0; i < cap; i++) this.free_[i] = cap - 1 - i;
  }

  /** Returns a slot index, or -1 if the pool is full. */
  alloc(): number {
    if (this.top === 0) return -1;
    const i = this.free_[--this.top]!;
    this.alive[i] = 1;
    this.count++;
    if (i + 1 > this.hi) this.hi = i + 1;
    return i;
  }

  free(i: number): void {
    if (!this.alive[i]) return;
    this.alive[i] = 0;
    this.free_[this.top++] = i;
    this.count--;
    // shrink the high-water mark past trailing dead slots
    while (this.hi > 0 && !this.alive[this.hi - 1]) this.hi--;
  }

  clear(): void {
    this.alive.fill(0);
    this.top = this.cap;
    for (let i = 0; i < this.cap; i++) this.free_[i] = this.cap - 1 - i;
    this.count = 0;
    this.hi = 0;
  }
}
