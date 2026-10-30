import { CONFIG } from '../data/config';
import type { SimInput } from '../sim/world';

export type NavAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause' | 'pick1' | 'pick2' | 'pick3';

const DEAD = 0.3;

/** Mouse + keyboard + gamepad. Produces SimInput for gameplay and edge-triggered nav actions for menus. */
export class InputManager {
  mouseX = 0;
  mouseY = 0;
  private aimDevice: 'mouse' | 'keys' | 'pad' | 'none' = 'none';
  private readonly keys = new Set<string>();
  private wheel = 0;
  private readonly nav: NavAction[] = [];
  private padPrev: boolean[] = [];
  private stickPrev = { x: 0, y: 0 };
  private rs = { x: 0, y: 0 };
  private ls = { x: 0, y: 0 };
  private lt = 0;
  private rt = 0;
  padConnected = false;
  /** called on any user gesture (audio unlock) */
  onGesture: (() => void) | null = null;

  constructor(target: HTMLElement) {
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.aimDevice = 'mouse';
    });
    window.addEventListener('mousedown', () => this.onGesture?.());
    target.addEventListener('wheel', (e) => {
      this.wheel += e.deltaY < 0 ? 1 : e.deltaY > 0 ? -1 : 0;
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      this.onGesture?.();
      const k = e.key.toLowerCase();
      if (!e.repeat) {
        switch (k) {
          case 'arrowup': this.nav.push('up'); break;
          case 'arrowdown': this.nav.push('down'); break;
          case 'arrowleft': this.nav.push('left'); break;
          case 'arrowright': this.nav.push('right'); break;
          case 'enter': case ' ': this.nav.push('confirm'); break;
          case 'escape': case 'p': this.nav.push('pause'); break;
          case 'backspace': this.nav.push('back'); break;
          case '1': this.nav.push('pick1'); break;
          case '2': this.nav.push('pick2'); break;
          case '3': this.nav.push('pick3'); break;
        }
      }
      if (k === 'a' || k === 'd') this.aimDevice = 'keys';
      if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Poll gamepads once per frame. */
  poll(): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    this.padConnected = !!gp;
    if (!gp) return;
    const ax = (i: number) => {
      const v = gp!.axes[i] ?? 0;
      return Math.abs(v) < 0.12 ? 0 : v;
    };
    this.ls.x = ax(0); this.ls.y = ax(1);
    this.rs.x = ax(2); this.rs.y = ax(3);
    this.lt = gp.buttons[6]?.value ?? 0;
    this.rt = gp.buttons[7]?.value ?? 0;
    const pressed = gp.buttons.map((b) => b.pressed);
    const edge = (i: number) => !!pressed[i] && !this.padPrev[i];
    if (pressed.some((b) => b)) this.onGesture?.();
    if (edge(0)) this.nav.push('confirm');
    if (edge(1)) this.nav.push('back');
    if (edge(9)) this.nav.push('pause');
    if (edge(12)) this.nav.push('up');
    if (edge(13)) this.nav.push('down');
    if (edge(14)) this.nav.push('left');
    if (edge(15)) this.nav.push('right');
    // left stick as a d-pad for menus
    const sy = this.ls.y, sx = this.ls.x;
    if (sy < -0.6 && this.stickPrev.y >= -0.6) this.nav.push('up');
    if (sy > 0.6 && this.stickPrev.y <= 0.6) this.nav.push('down');
    if (sx < -0.6 && this.stickPrev.x >= -0.6) this.nav.push('left');
    if (sx > 0.6 && this.stickPrev.x <= 0.6) this.nav.push('right');
    this.stickPrev.x = sx; this.stickPrev.y = sy;
    this.padPrev = pressed;
    if (Math.hypot(this.rs.x, this.rs.y) > DEAD || this.lt > 0.1 || this.rt > 0.1 || Math.abs(this.ls.x) > DEAD) this.aimDevice = 'pad';
  }

  takeNav(): NavAction | undefined {
    return this.nav.shift();
  }

  clearNav(): void {
    this.nav.length = 0;
  }

  /**
   * Fill one sim tick's input. `first` is true for the first tick of a frame (the mouse
   * wheel's discrete steps apply once). `cx, cy` is the lighthouse's screen position.
   */
  fill(out: SimInput, cx: number, cy: number, first: boolean): void {
    const dt = CONFIG.sim.dt;
    const B = CONFIG.beam;
    out.focusTarget = -1;
    let focus = 0;
    if (this.keys.has('w')) focus += B.focusRate * dt;
    if (this.keys.has('s')) focus -= B.focusRate * dt;
    focus += (this.rt - this.lt) * B.focusRate * dt;
    if (first && this.wheel !== 0) {
      focus += this.wheel * B.focusWheelStep;
      this.wheel = 0;
    }
    out.focusDelta = focus;

    const turnKeys = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
    const rsMag = Math.hypot(this.rs.x, this.rs.y);
    if (rsMag > DEAD) {
      out.aimMode = 0;
      out.targetAngle = Math.atan2(this.rs.y, this.rs.x);
    } else if (turnKeys !== 0) {
      out.aimMode = 1;
      out.turn = turnKeys;
    } else if (this.aimDevice === 'pad' && Math.abs(this.ls.x) > DEAD) {
      out.aimMode = 1;
      out.turn = this.ls.x;
    } else if (this.aimDevice === 'mouse') {
      out.aimMode = 0;
      out.targetAngle = Math.atan2(this.mouseY - cy, this.mouseX - cx);
    } else {
      out.aimMode = 1;
      out.turn = 0;
    }
  }
}
