import { BOSSES, CONFIG, ENEMIES } from '../data/config';
import { UPGRADES, EVOLUTIONS } from '../data/upgrades';
import { META } from '../data/meta';
import { hex, palette } from '../data/palette';
import { DMG_SRC_NAMES, OFFER_EVO, OFFER_HEAL, RunState, type World } from '../sim/world';
import type { NavAction } from '../input/input';
import type { SaveData, Settings } from './save';

type Child = Node | string | null | undefined | false;
function h(tag: string, attrs: Record<string, string | number | boolean | ((e: Event) => void)> = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (typeof v === 'boolean') { if (v) el.setAttribute(k, ''); }
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function fmtTime(t: number): string {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Applies palette.ui to CSS variables so no colour lives in the stylesheet. */
export function applyCssPalette(): void {
  const r = document.documentElement.style;
  const u = palette.ui;
  r.setProperty('--bg', u.bg);
  r.setProperty('--panel', u.panel);
  r.setProperty('--border', u.border);
  r.setProperty('--text', u.text);
  r.setProperty('--dim', u.dim);
  r.setProperty('--accent', u.accent);
  r.setProperty('--accent2', u.accent2);
  r.setProperty('--danger', u.danger);
  r.setProperty('--good', u.good);
  r.setProperty('--hp', hex(palette.hpBar));
  r.setProperty('--hp-low', hex(palette.hpBarLow));
  r.setProperty('--xp', hex(palette.xpBar));
  r.setProperty('--ember', hex(palette.ember));
}

export interface UICallbacks {
  start: () => void;
  resume: () => void;
  abandon: () => void;
  toMenu: () => void;
  pick: (offer: number) => void;
  buyMeta: (i: number) => void;
  settingsChanged: (s: Settings) => void;
  click: () => void;
}

/** DOM overlay: HUD + menus, navigable by mouse, keyboard and gamepad. */
export class UI {
  private readonly root: HTMLElement;
  private readonly hud: HTMLElement;
  private screen: HTMLElement | null = null;
  private focusables: HTMLElement[] = [];
  private focusIdx = 0;
  private backAction: (() => void) | null = null;
  current = '';
  private hudEls: Record<string, HTMLElement> = {};
  private last: Record<string, string | number> = {};

  constructor(private readonly cb: UICallbacks, private save: SaveData) {
    this.root = document.getElementById('ui')!;
    this.hud = document.getElementById('hud')!;
    this.buildHud();
  }

  setSave(s: SaveData): void {
    this.save = s;
  }

  // ---------- navigation ----------
  handleNav(a: NavAction): boolean {
    if (!this.screen) return false;
    const el = this.focusables[this.focusIdx];
    switch (a) {
      case 'up': case 'left': {
        if (el?.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range' && a === 'left') { this.nudge(el as HTMLInputElement, -1); return true; }
        this.moveFocus(-1);
        return true;
      }
      case 'down': case 'right': {
        if (el?.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range' && a === 'right') { this.nudge(el as HTMLInputElement, 1); return true; }
        this.moveFocus(1);
        return true;
      }
      case 'confirm':
        if (el && document.activeElement !== el) el.focus();
        el?.click();
        return true;
      case 'back': case 'pause':
        if (this.backAction) { this.backAction(); return true; }
        return false;
      case 'pick1': case 'pick2': case 'pick3': {
        if (this.current !== 'levelup') return false;
        const idx = a === 'pick1' ? 0 : a === 'pick2' ? 1 : 2;
        this.focusables[idx]?.click();
        return true;
      }
    }
    return false;
  }

  private nudge(el: HTMLInputElement, dir: number): void {
    el.value = String(Math.max(0, Math.min(1, Number(el.value) + dir * 0.1)));
    el.dispatchEvent(new Event('input'));
  }

  private moveFocus(d: number): void {
    if (this.focusables.length === 0) return;
    this.focusIdx = (this.focusIdx + d + this.focusables.length) % this.focusables.length;
    this.focusables[this.focusIdx]!.focus();
    this.cb.click();
  }

  private show(name: string, el: HTMLElement, back: (() => void) | null, focusFirst = 0): void {
    this.hide();
    this.current = name;
    this.screen = el;
    this.backAction = back;
    this.root.append(el);
    this.focusables = Array.from(el.querySelectorAll<HTMLElement>('button:not([disabled]), input, .card'));
    this.focusables.forEach((f, i) => {
      if (!f.hasAttribute('tabindex')) f.tabIndex = 0;
      f.addEventListener('mouseenter', () => { this.focusIdx = i; f.focus(); });
      f.addEventListener('focus', () => { this.focusIdx = i; });
    });
    this.focusIdx = Math.min(focusFirst, this.focusables.length - 1);
    this.focusables[this.focusIdx]?.focus();
  }

  hide(): void {
    this.screen?.remove();
    this.screen = null;
    this.current = '';
    this.focusables = [];
    this.backAction = null;
  }

  // ---------- screens ----------
  showMenu(): void {
    const s = this.save;
    const el = h('div', { class: 'screen menu' },
      h('h1', { class: 'title' }, 'LIGHTHOUSE'),
      h('p', { class: 'tagline' }, 'You are the last lighthouse. Hold the dark back for fifteen minutes.'),
      h('div', { class: 'menu-buttons' },
        h('button', { onclick: () => this.cb.start() }, 'Light the lamp'),
        h('button', { onclick: () => this.showShop() }, `Keeper's upgrades`),
        h('button', { onclick: () => this.showSettings(() => this.showMenu()) }, 'Settings'),
        h('button', { onclick: () => this.showHelp() }, 'How to play'),
      ),
      h('div', { class: 'menu-stats' },
        h('span', { class: 'coins' }, `◉ ${s.coins} coins`),
        s.best.time > 0 ? h('span', {}, `Best: ${fmtTime(s.best.time)} · level ${s.best.level}${s.best.wins ? ` · ${s.best.wins} dawn${s.best.wins > 1 ? 's' : ''}` : ''}`) : null,
      ),
    );
    this.show('menu', el, null);
  }

  showHelp(): void {
    const el = h('div', { class: 'screen panel help' },
      h('h2', {}, 'How to play'),
      h('p', {}, 'Things crawl out of the night sea toward your rock. You cannot move: you aim the light. Survive until dawn (15:00) and defeat what rises at the end.'),
      h('table', {},
        h('tr', {}, h('th', {}, ''), h('th', {}, 'Mouse & keys'), h('th', {}, 'Gamepad')),
        h('tr', {}, h('td', {}, 'Aim'), h('td', {}, 'Mouse, or A / D'), h('td', {}, 'Right stick (left stick turns)')),
        h('tr', {}, h('td', {}, 'Focus'), h('td', {}, 'Mouse wheel, or W / S'), h('td', {}, 'RT narrows, LT widens')),
        h('tr', {}, h('td', {}, 'Pause'), h('td', {}, 'Esc or P'), h('td', {}, 'Start')),
        h('tr', {}, h('td', {}, 'Choose upgrade'), h('td', {}, 'Click or 1 / 2 / 3'), h('td', {}, 'D-pad + A')),
      ),
      h('ul', {},
        h('li', {}, 'A narrow beam burns hard; a wide beam covers more but burns less.'),
        h('li', {}, 'Shielded ships only take damage from a narrow beam (watch their blue ring fade).'),
        h('li', {}, 'Embers only drift home while your light is on them.'),
        h('li', {}, 'Max out two matching upgrades to unlock an evolution.'),
      ),
      h('button', { onclick: () => this.showMenu() }, 'Back'),
    );
    this.show('help', el, () => this.showMenu());
  }

  showShop(focus = 0): void {
    const s = this.save;
    const rows = META.map((m, i) => {
      const rank = s.meta[i] ?? 0;
      const maxed = rank >= m.maxRank;
      const cost = maxed ? 0 : m.cost(rank + 1);
      const pips = h('span', { class: 'pips' }, ...Array.from({ length: m.maxRank }, (_, k) => h('i', { class: k < rank ? 'on' : '' })));
      return h('div', { class: 'shop-row' },
        h('div', { class: 'shop-info' }, h('b', {}, m.name), h('small', {}, rank > 0 ? m.desc(rank) : m.desc(1) + ' (at rank 1)')),
        pips,
        h('button', { disabled: maxed || s.coins < cost, onclick: () => { this.cb.buyMeta(i); this.showShop(i); } }, maxed ? 'MAX' : `◉ ${cost}`),
      );
    });
    const el = h('div', { class: 'screen panel shop' },
      h('h2', {}, `Keeper's upgrades`),
      h('p', { class: 'coins' }, `◉ ${s.coins} coins`),
      h('div', { class: 'shop-list' }, ...rows),
      h('button', { onclick: () => this.showMenu() }, 'Back'),
    );
    this.show('shop', el, () => this.showMenu(), focus);
  }

  showSettings(back: () => void): void {
    const st = this.save.settings;
    const slider = (label: string, key: 'master' | 'sfx' | 'ambience' | 'shake') => {
      const input = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st[key] }) as HTMLInputElement;
      const val = h('span', { class: 'val' }, `${Math.round(st[key] * 100)}%`);
      input.addEventListener('input', () => {
        st[key] = Number(input.value);
        val.textContent = `${Math.round(st[key] * 100)}%`;
        this.cb.settingsChanged(st);
      });
      return h('label', { class: 'setting' }, h('span', {}, label), input, val);
    };
    const toggle = (label: string, key: 'colorblind' | 'crt') => {
      const b = h('button', { class: 'toggle' }, st[key] ? 'On' : 'Off');
      b.addEventListener('click', () => {
        st[key] = !st[key];
        b.textContent = st[key] ? 'On' : 'Off';
        this.cb.settingsChanged(st);
      });
      return h('div', { class: 'setting' }, h('span', {}, label), b);
    };
    const el = h('div', { class: 'screen panel settings' },
      h('h2', {}, 'Settings'),
      slider('Master volume', 'master'),
      slider('Effects', 'sfx'),
      slider('Sea & wind', 'ambience'),
      slider('Screen shake', 'shake'),
      toggle('Colour-blind palette', 'colorblind'),
      toggle('CRT vignette', 'crt'),
      h('button', { onclick: back }, 'Back'),
    );
    this.show('settings', el, back);
  }

  showPause(): void {
    const el = h('div', { class: 'screen panel pause' },
      h('h2', {}, 'Paused'),
      h('button', { onclick: () => this.cb.resume() }, 'Resume'),
      h('button', { onclick: () => this.showSettings(() => this.showPause()) }, 'Settings'),
      h('button', { onclick: () => this.cb.abandon() }, 'Let the light go out'),
    );
    this.show('pause', el, () => this.cb.resume());
  }

  showLevelUp(w: World): void {
    const cards: HTMLElement[] = [];
    for (let k = 0; k < w.offers.length; k++) {
      const o = w.offers[k]!;
      if (o < 0) continue;
      let icon: string, name: string, desc: string, lvl: string, cls = 'card';
      if (o >= OFFER_HEAL) {
        icon = '✚'; name = 'Patch the walls'; desc = `Restore ${Math.round(CONFIG.levels.healFraction * 100)}% HP.`; lvl = '';
      } else if (o >= OFFER_EVO) {
        const e = EVOLUTIONS[o - OFFER_EVO]!;
        icon = e.icon; name = e.name; desc = e.desc; lvl = 'EVOLUTION'; cls += ' evo';
      } else {
        const u = UPGRADES[o]!;
        const cur = w.upgradeLevels[o]!;
        icon = u.icon; name = u.name; desc = u.desc(cur + 1);
        lvl = cur === 0 ? 'NEW' : `Lv ${cur} → ${cur + 1}`;
      }
      const card = h('div', { class: cls, role: 'button', onclick: () => this.cb.pick(o) },
        h('div', { class: 'card-key' }, String(k + 1)),
        h('div', { class: 'card-icon' }, icon),
        h('div', { class: 'card-name' }, name),
        h('div', { class: 'card-lvl' }, lvl),
        h('div', { class: 'card-desc' }, desc),
      );
      cards.push(card);
    }
    const el = h('div', { class: 'screen levelup' },
      h('h2', {}, `Level ${w.level - w.pendingLevels + 1}`),
      h('div', { class: 'cards' }, ...cards),
    );
    this.show('levelup', el, null);
  }

  showSummary(w: World, coins: number, isNewBest: boolean): void {
    const won = w.state === RunState.Won;
    const killRows = ENEMIES.map((e, i) => (w.killsByType[i]! > 0 ? h('tr', {}, h('td', {}, i === 7 ? 'Bosses' : e.name + 's'), h('td', {}, String(w.killsByType[i]))) : null));
    let maxDmg = 1;
    for (const d of w.damageBySource) maxDmg = Math.max(maxDmg, d);
    const dmgRows = Array.from(w.damageBySource).map((d, i) => d > 0
      ? h('div', { class: 'dmg-row' }, h('span', {}, DMG_SRC_NAMES[i]!), h('div', { class: 'bar' }, h('i', { style: `width:${(d / maxDmg) * 100}%` })), h('span', { class: 'num' }, Math.round(d).toLocaleString()))
      : null);
    const build = UPGRADES.map((u, i) => (w.upgradeLevels[i]! > 0 ? h('span', { class: 'chip', title: u.name }, `${u.icon} ${u.name} ${w.upgradeLevels[i]}`) : null));
    const evo = EVOLUTIONS.map((e, i) => (w.evolved[i] ? h('span', { class: 'chip evo' }, `${e.icon} ${e.name}`) : null));
    const el = h('div', { class: 'screen panel summary' },
      h('h2', { class: won ? 'won' : 'lost' }, won ? 'Dawn breaks.' : 'The light went out.'),
      h('p', { class: 'sub' }, won ? 'The sea goes quiet. The keeper sleeps.' : `Survived ${fmtTime(w.t)}${isNewBest ? ' · new best!' : ''}`),
      h('div', { class: 'summary-grid' },
        h('div', {},
          h('h3', {}, 'Run'),
          h('table', {},
            h('tr', {}, h('td', {}, 'Time'), h('td', {}, fmtTime(w.t))),
            h('tr', {}, h('td', {}, 'Level'), h('td', {}, String(w.level))),
            h('tr', {}, h('td', {}, 'Kills'), h('td', {}, w.kills.toLocaleString())),
            h('tr', {}, h('td', {}, 'Bosses slain'), h('td', {}, `${w.bossesKilled} / ${BOSSES.length}`)),
            h('tr', {}, h('td', {}, 'Embers gathered'), h('td', {}, Math.round(w.embersCollected).toLocaleString())),
            h('tr', {}, h('td', {}, 'Damage taken'), h('td', {}, Math.round(w.damageTaken).toLocaleString())),
            h('tr', {}, h('td', {}, 'Most at once'), h('td', {}, String(w.peakEnemies))),
            h('tr', { class: 'coins' }, h('td', {}, 'Coins earned'), h('td', {}, `◉ ${coins}`)),
          ),
        ),
        h('div', {}, h('h3', {}, 'Kills'), h('table', {}, ...killRows)),
        h('div', { class: 'wide' }, h('h3', {}, 'Damage dealt'), ...dmgRows),
        h('div', { class: 'wide build' }, h('h3', {}, 'Build'), ...build, ...evo),
      ),
      h('div', { class: 'row' },
        h('button', { onclick: () => this.cb.start() }, 'Light it again'),
        h('button', { onclick: () => this.cb.toMenu() }, 'Main menu'),
      ),
    );
    this.show('summary', el, () => this.cb.toMenu());
  }

  // ---------- HUD ----------
  private buildHud(): void {
    const e = (cls: string, ...c: Child[]) => (this.hudEls[cls] = h('div', { class: cls }, ...c));
    this.hud.append(
      e('hud-top',
        e('hp', e('hp-fill'), e('hp-text')),
        e('timer'),
        e('xp', e('xp-fill'), e('xp-text')),
      ),
      e('boss', e('boss-name'), e('boss-bar', e('boss-fill'))),
      e('hud-bottom',
        e('build'),
        e('focus', h('span', {}, 'wide'), e('focus-bar', e('focus-knob')), h('span', {}, 'narrow'), h('span', { class: 'focus-keys' }, 'wheel · W/S · LT/RT')),
        e('kills'),
      ),
      e('banner'),
      e('bench'),
    );
  }

  showHud(on: boolean): void {
    this.hud.style.display = on ? '' : 'none';
  }

  private set(key: string, val: string | number, apply: (v: string | number) => void): void {
    if (this.last[key] === val) return;
    this.last[key] = val;
    apply(val);
  }

  banner(text: string, seconds = 2.5): void {
    const b = this.hudEls['banner']!;
    b.textContent = text;
    b.style.animationDuration = `${seconds}s`;
    b.classList.toggle('long', text.length > 40);
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    window.setTimeout(() => b.classList.remove('show'), seconds * 1000);
  }

  /** pulse the focus meter to teach the narrow-beam mechanic */
  flashFocus(): void {
    const f = this.hudEls['focus']!;
    f.classList.remove('teach');
    void f.offsetWidth;
    f.classList.add('teach');
  }

  benchText(text: string): void {
    this.hudEls['bench']!.textContent = text;
  }

  updateHud(w: World): void {
    const E = this.hudEls;
    const hpPct = Math.max(0, w.hp / w.stats.hpMax);
    this.set('hp', Math.round(hpPct * 1000), () => {
      E['hp-fill']!.style.width = `${hpPct * 100}%`;
      E['hp']!.classList.toggle('low', hpPct < 0.3);
    });
    this.set('hpt', `${Math.ceil(w.hp)} / ${Math.round(w.stats.hpMax)}`, (v) => (E['hp-text']!.textContent = String(v)));
    const xpPct = Math.min(1, w.xp / w.xpNext);
    this.set('xp', Math.round(xpPct * 500), () => (E['xp-fill']!.style.width = `${xpPct * 100}%`));
    this.set('lvl', w.level, (v) => (E['xp-text']!.textContent = `Level ${v}`));
    this.set('time', Math.floor(w.t), () => (E['timer']!.textContent = fmtTime(w.t)));
    this.set('kills', w.kills, (v) => (E['kills']!.textContent = `☠ ${Number(v).toLocaleString()}`));
    this.set('focus', Math.round(w.focus * 100), () => {
      E['focus-knob']!.style.left = `${w.focus * 100}%`;
      E['focus']!.classList.toggle('narrow', w.focus >= CONFIG.beam.shieldFocus);
    });
    // boss bar
    let bossHp = -1, bossName = '';
    if (w.bossAlive > 0) {
      const Em = w.enemies;
      for (let i = 0; i < Em.pool.hi; i++) {
        if (Em.pool.alive[i] && Em.type[i] === 7) {
          bossHp = Em.hp[i]! / Em.maxHp[i]!;
          bossName = BOSSES[Em.gen[i]!]!.name;
          break;
        }
      }
    }
    this.set('boss', bossHp < 0 ? -1 : Math.round(bossHp * 400), () => {
      E['boss']!.style.display = bossHp < 0 ? 'none' : '';
      if (bossHp >= 0) E['boss-fill']!.style.width = `${bossHp * 100}%`;
    });
    this.set('bossName', bossName, (v) => (E['boss-name']!.textContent = String(v)));
    // build
    let sig = '';
    for (let i = 0; i < w.upgradeLevels.length; i++) sig += w.upgradeLevels[i];
    for (let i = 0; i < w.evolved.length; i++) sig += w.evolved[i];
    this.set('build', sig, () => {
      const b = E['build']!;
      b.replaceChildren(
        ...UPGRADES.map((u, i) => (w.upgradeLevels[i]! > 0 ? h('span', { class: 'chip', title: u.name }, `${u.icon}${w.upgradeLevels[i]}`) : null)).filter((x): x is HTMLElement => !!x),
        ...EVOLUTIONS.map((e, i) => (w.evolved[i] ? h('span', { class: 'chip evo', title: e.name }, e.icon) : null)).filter((x): x is HTMLElement => !!x),
      );
    });
  }
}
