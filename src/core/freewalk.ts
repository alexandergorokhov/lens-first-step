// Free walk: browsing with no destination. Looking at a node's "front" line from
// outside gives a dot; opening it lists what the shop shows (at most 3 items), or, at stairs, an
// escalator or a lift, your picks on the other floor. The companion walks ahead with no route:
// along your walking direction, or your head direction once you stand still; it runs around you
// when you turn, stops at matching shops and points. Also the "Say it" / "Where to?" matcher of
// Go to a place. Pure logic shared by the Lens and the Node tests: no imports and no Lens globals;
// the Lens keeps a byte-identical copy at Assets/Scripts/FindYourWayFreeWalk.ts. Every name and
// place comes from the map; nothing here names a shop.
//
// Map metres: x east, y up, z north. Headings: degrees clockwise from north.

export interface FwXYZ {
  x: number;
  y: number;
  z: number;
}

export interface FwNode extends FwXYZ {
  id: string;
  kind: string;
  label?: string;
  category?: string;
  sponsored?: boolean;
  sponsorTag?: string;
  front?: { x1: number; z1: number; x2: number; z2: number };
  offer?: { text: string; price: string; image?: string }[];
}

export interface FwEdge {
  from: string;
  to: string;
  kind: string;
  open?: boolean;
}

export interface FwMap {
  nodes: FwNode[];
  edges: FwEdge[];
  place?: { interests?: { id: string; label: string }[]; sayIt?: string; destination?: string };
}

// Everything the brief calls a default and the Inspector can tune.
export interface FreeSettings {
  aheadM: number; // how far ahead the companion walks
  stillSeconds: number; // standing this long makes "ahead" your head direction
  clearM: number; // it never comes closer to you than this
  speed: number; // walking pace (m/s)
  runSpeed: number; // catching up / running around you (m/s)
  pointSeconds: number; // how long it points at a shop
  pointRadiusM: number; // how near a matching shop must be for it to stop
  maxStops: number; // stops per walk; 0 = no limit
  bubbleSeconds: number; // how long it waits at a floor change with its bubble
  lookRangeM: number; // how far a front can be looked at from
  dotShowSeconds: number;
  dotHideSeconds: number;
  listAwayM: number; // walking this far from where it was opened closes the list
}

export const FREE_DEFAULTS: FreeSettings = {
  aheadM: 2.5,
  stillSeconds: 1,
  clearM: 1,
  speed: 2.4,
  runSpeed: 4.5,
  pointSeconds: 3,
  pointRadiusM: 8,
  maxStops: 0,
  bubbleSeconds: 5,
  lookRangeM: 12,
  dotShowSeconds: 0.5,
  dotHideSeconds: 2,
  listAwayM: 5,
};

// At most this many picks on a floor-change list; more shows "and more".
export const MAX_PICKS = 3;
// A shop or stairs behind you by more than this (m, along "ahead") is not stopped at.
const BEHIND_M = 2;
// The companion stands this far outside a front when it stops there (m).
const OUTSIDE_FRONT_M = 1.2;
// It gives up reaching a stop after this long (s), or when you are this far from it (m).
const STOP_TIMEOUT_S = 4;
const STOP_LEAVE_M = 15;
// Moving at least this far (m) means walking; the direction is taken over that stretch.
const MOVE_STEP_M = 0.3;
const SAME_FLOOR_M = 1;
const SPONSOR_TAG = "Sponsored";
// The Lens's interests for maps with no place.interests.
const DEFAULT_INTERESTS = [
  { id: "coffee", label: "Coffee" },
  { id: "food", label: "Food" },
  { id: "shopping", label: "Shops" },
  { id: "toilet", label: "Toilets" },
  { id: "pharmacy", label: "Pharmacy" },
];

function flat(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function headingDir(deg: number): { x: number; z: number } {
  const r = (deg * Math.PI) / 180;
  return { x: Math.sin(r), z: Math.cos(r) };
}

function headingTo(a: { x: number; z: number }, b: { x: number; z: number }): number | null {
  if (flat(a, b) < 1e-3) return null;
  return (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI;
}

// ── Looking at a front ───────────────────────────────────────────────────────

export interface LookTarget {
  id: string;
  y: number;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  // Which side of the line (x1,z1)->(x2,z2) is outside: +1, -1, or 0 when the map doesn't say.
  outside: number;
}

function sideOf(t: { x1: number; z1: number; x2: number; z2: number }, p: { x: number; z: number }): number {
  return (t.x2 - t.x1) * (p.z - t.z1) - (t.z2 - t.z1) * (p.x - t.x1);
}

// Every node with a front. The outside is the side its walk edge arrives from.
export function frontTargets(map: FwMap): LookTarget[] {
  const out: LookTarget[] = [];
  const at: { [id: string]: FwNode } = Object.create(null);
  for (const n of map.nodes) at[n.id] = n;
  for (const n of map.nodes) {
    if (!n.front) continue;
    const t: LookTarget = { id: n.id, y: n.y, x1: n.front.x1, z1: n.front.z1, x2: n.front.x2, z2: n.front.z2, outside: 0 };
    for (const e of map.edges) {
      if (e.kind !== "walk" || (e.from !== n.id && e.to !== n.id)) continue;
      const other = at[e.from === n.id ? e.to : e.from];
      const s = other ? sideOf(t, other) : 0;
      if (Math.abs(s) > 1e-6) {
        t.outside = s > 0 ? 1 : -1;
        break;
      }
    }
    out.push(t);
  }
  return out;
}

// The id of the nearest front the head direction crosses from outside, on your floor, within range.
export function lookTarget(targets: LookTarget[], pos: FwXYZ, heading: number, range: number): string | null {
  const d = headingDir(heading);
  let best: string | null = null;
  let bestT = range;
  for (const t of targets) {
    if (Math.abs(t.y - pos.y) >= SAME_FLOOR_M) continue;
    const side = sideOf(t, pos);
    if (t.outside !== 0 && side * t.outside <= 0) continue;
    const ex = t.x2 - t.x1;
    const ez = t.z2 - t.z1;
    const denom = d.x * ez - d.z * ex;
    if (Math.abs(denom) < 1e-9) continue;
    const ox = t.x1 - pos.x;
    const oz = t.z1 - pos.z;
    const along = (ox * ez - oz * ex) / denom;
    const u = (ox * d.z - oz * d.x) / denom;
    if (along > 0 && along <= bestT && u >= 0 && u <= 1) {
      bestT = along;
      best = t.id;
    }
  }
  return best;
}

// The dot in the corner and the list it opens. If you don't open it, nothing happens.
export class DotTracker {
  dot: string | null = null;
  open: string | null = null;
  private cand: string | null = null;
  private candSince = 0;
  private awaySince: number | null = null;
  private openAt: FwXYZ | null = null;
  private showS: number;
  private hideS: number;
  private awayM: number;

  constructor(showS: number = FREE_DEFAULTS.dotShowSeconds, hideS: number = FREE_DEFAULTS.dotHideSeconds, awayM: number = FREE_DEFAULTS.listAwayM) {
    this.showS = showS;
    this.hideS = hideS;
    this.awayM = awayM;
  }

  update(look: string | null, now: number, pos: FwXYZ): void {
    if (this.open !== null) {
      if (this.openAt && flat(pos, this.openAt) >= this.awayM) this.closeList();
      return;
    }
    if (look !== this.cand) {
      this.cand = look;
      this.candSince = now;
    }
    if (look !== null && look !== this.dot && now - this.candSince >= this.showS) {
      this.dot = look;
      this.awaySince = null;
    }
    if (this.dot === null) return;
    if (look === this.dot) this.awaySince = null;
    else if (this.awaySince === null) this.awaySince = now;
    else if (now - this.awaySince >= this.hideS) {
      this.dot = null;
      this.awaySince = null;
    }
  }

  // The pinch on the dot: returns what opened, or null with no dot showing.
  openDot(pos: FwXYZ): string | null {
    if (this.dot === null) return null;
    this.open = this.dot;
    this.openAt = { x: pos.x, y: pos.y, z: pos.z };
    this.dot = null;
    this.awaySince = null;
    return this.open;
  }

  closeList(): void {
    this.open = null;
    this.openAt = null;
    this.cand = null;
  }
}

// ── Offers and picks ─────────────────────────────────────────────────────────

export interface OfferRow {
  text: string;
  price: string;
  image?: string;
}

export interface OfferView {
  id: string;
  title: string;
  tag: string; // "Sponsored" (always on a sponsored place), or ""
  rows: OfferRow[];
  more: boolean; // "and more"
}

function tagOf(n: FwNode): string {
  if (!n.sponsored) return "";
  return SPONSOR_TAG + (n.sponsorTag && n.sponsorTag !== SPONSOR_TAG ? " · " + n.sponsorTag : "");
}

function matches(n: FwNode, prefs: string[]): boolean {
  return n.kind === "place" && typeof n.category === "string" && prefs.indexOf(n.category) >= 0;
}

// The matching shops above (or below) height y: paid ones first, then in map order. Paying only
// changes this order, never whether a shop is listed.
export function otherFloorPicks(map: FwMap, prefs: string[], y: number, up: boolean): FwNode[] {
  const all = map.nodes.filter((n) => matches(n, prefs) && Math.abs(n.y - y) >= SAME_FLOOR_M && n.y > y === up);
  return all.filter((n) => n.sponsored === true).concat(all.filter((n) => n.sponsored !== true));
}

export function floorBubble(count: number, up: boolean): string {
  return count + (count === 1 ? " pick " : " picks ") + (up ? "upstairs" : "downstairs");
}

// A floor connection at this node: which way it goes, and whether you can set off from here (an
// escalator only runs from -> to). Null for any other node.
function connection(map: FwMap, id: string): { up: boolean; usable: boolean } | null {
  const at: { [id: string]: FwNode } = Object.create(null);
  for (const n of map.nodes) at[n.id] = n;
  const here = at[id];
  if (!here) return null;
  let found: { up: boolean; usable: boolean } | null = null;
  for (const e of map.edges) {
    if (e.kind === "walk" || e.open === false || (e.from !== id && e.to !== id)) continue;
    const other = at[e.from === id ? e.to : e.from];
    if (!other || Math.abs(other.y - here.y) < SAME_FLOOR_M) continue;
    const usable = e.kind !== "escalator" || e.from === id;
    if (!found || (usable && !found.usable)) found = { up: other.y > here.y, usable };
  }
  return found;
}

// What a dot opens: a shop's offer, or at a floor connection the first picks on the other floor.
export function offerView(map: FwMap, id: string, prefs: string[], y: number): OfferView | null {
  let node: FwNode | null = null;
  for (const n of map.nodes) if (n.id === id) node = n;
  if (!node) return null;
  const conn = connection(map, id);
  const picks = conn ? otherFloorPicks(map, prefs, y, conn.up) : [];
  if (conn && picks.length > 0) {
    return {
      id,
      title: "Your picks " + (conn.up ? "upstairs" : "downstairs"),
      tag: "",
      rows: picks.slice(0, MAX_PICKS).map((p) => {
        const tag = tagOf(p);
        return { text: (p.label || p.id) + (tag ? " · " + tag : ""), price: "" };
      }),
      more: picks.length > MAX_PICKS,
    };
  }
  const rows: OfferRow[] = (node.offer || []).slice(0, MAX_PICKS).map((o) => {
    const r: OfferRow = { text: o.text, price: o.price };
    if (o.image) r.image = o.image;
    return r;
  });
  return { id, title: node.label || node.id, tag: tagOf(node), rows, more: false };
}

// What the button in your view says a pinch will open.
export function dotLabel(map: FwMap, id: string, prefs: string[], y: number): string {
  const view = offerView(map, id, prefs, y);
  if (!view) return "";
  return view.rows.length > 0 && view.rows[0].price ? "Offers: " + view.title : view.title;
}

// The preference checkboxes: the map's list, or today's interests on maps without one.
export function interestList(map: FwMap): { id: string; label: string }[] {
  const own = map.place && map.place.interests;
  return (own && own.length > 0 ? own : DEFAULT_INTERESTS).map((i) => ({ id: i.id, label: i.label }));
}

// ── The companion with no route ──────────────────────────────────────────────

// What "ahead" means: your walking direction while you walk, so glancing at a shop doesn't swing
// the companion around; your head direction once you have stood still for stillSeconds.
export class AheadTracker {
  private dir: { x: number; z: number } | null = null;
  private anchor: FwXYZ | null = null;
  private still = 0;
  private stillSeconds: number;

  constructor(stillSeconds: number = FREE_DEFAULTS.stillSeconds) {
    this.stillSeconds = stillSeconds;
  }

  update(pos: FwXYZ, heading: number, dt: number): { x: number; z: number } {
    if (!this.dir || !this.anchor) {
      this.dir = headingDir(heading);
      this.anchor = { x: pos.x, y: pos.y, z: pos.z };
      return this.dir;
    }
    const moved = flat(pos, this.anchor);
    if (moved >= MOVE_STEP_M) {
      this.dir = { x: (pos.x - this.anchor.x) / moved, z: (pos.z - this.anchor.z) / moved };
      this.anchor = { x: pos.x, y: pos.y, z: pos.z };
      this.still = 0;
      return this.dir;
    }
    this.still += dt;
    if (this.still >= this.stillSeconds) this.dir = headingDir(heading);
    return this.dir;
  }
}

// The nearest point on the walk edges of the floor at height y, or null with none there.
export function clampToPaths(map: FwMap, p: { x: number; z: number }, y: number): FwXYZ | null {
  const at: { [id: string]: FwNode } = Object.create(null);
  for (const n of map.nodes) at[n.id] = n;
  let best: FwXYZ | null = null;
  let bestD = Infinity;
  for (const e of map.edges) {
    if (e.kind !== "walk") continue;
    const a = at[e.from];
    const b = at[e.to];
    if (!a || !b || Math.abs(a.y - y) >= SAME_FLOOR_M || Math.abs(b.y - y) >= SAME_FLOOR_M) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
    const q = { x: a.x + dx * t, y: a.y + (b.y - a.y) * t, z: a.z + dz * t };
    const d = flat(p, q);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

export interface FreePet {
  pos: FwXYZ;
  heading: number;
  mood: "lead" | "run" | "point";
}

export interface FreeFrame {
  dot: string | null;
  open: string | null;
  pet: FreePet | null;
  pointing: string | null; // the stop it is walking to or pointing at
  bubble: string | null;
  stopped: string | null; // set on the frame it reaches a stop (the chime)
}

interface Stop {
  id: string;
  at: FwXYZ; // what it points at
  spot: FwXYZ; // where it stands
  seconds: number;
  bubble: string | null;
  giveUp: number;
  until: number | null; // null while still on its way
}

// One walk: created when the walk starts, with the preferences that apply to it.
export class FreeWalk {
  pet: FreePet | null = null;
  prefs: string[];
  settings: FreeSettings;
  private map: FwMap;
  private targets: LookTarget[];
  private dots: DotTracker;
  private ahead: AheadTracker;
  private stop: Stop | null = null;
  private done: { [id: string]: boolean } = Object.create(null);
  private stops = 0;

  constructor(map: FwMap, prefs: string[], settings?: Partial<FreeSettings>) {
    this.map = map;
    this.prefs = prefs.slice();
    const s: FreeSettings = { ...FREE_DEFAULTS, ...(settings || {}) };
    this.settings = s;
    this.targets = frontTargets(map);
    this.dots = new DotTracker(s.dotShowSeconds, s.dotHideSeconds, s.listAwayM);
    this.ahead = new AheadTracker(s.stillSeconds);
  }

  dot(): string | null { return this.dots.dot; }
  dotText(pos: FwXYZ): string { return this.dots.dot === null ? "" : dotLabel(this.map, this.dots.dot, this.prefs, pos.y); }
  openId(): string | null { return this.dots.open; }
  pointingAt(): string | null { return this.stop ? this.stop.id : null; }
  // Counts as already pointed at this walk.
  markDone(ids: string[]): void { for (const id of ids) this.done[id] = true; }

  openDot(pos: FwXYZ): string | null { return this.dots.openDot(pos); }
  closeList(): void { this.dots.closeList(); }

  list(pos: FwXYZ): OfferView | null {
    return this.dots.open === null ? null : offerView(this.map, this.dots.open, this.prefs, pos.y);
  }

  private spotAhead(pos: FwXYZ, dir: { x: number; z: number }): FwXYZ {
    const raw = { x: pos.x + dir.x * this.settings.aheadM, z: pos.z + dir.z * this.settings.aheadM };
    return clampToPaths(this.map, raw, pos.y) || { x: raw.x, y: pos.y, z: raw.z };
  }

  setCompanion(on: boolean, pos: FwXYZ, heading: number): void {
    this.stop = null;
    if (!on) {
      this.pet = null;
      return;
    }
    this.ahead = new AheadTracker(this.settings.stillSeconds);
    const dir = this.ahead.update(pos, heading, 0);
    this.pet = { pos: this.spotAhead(pos, dir), heading, mood: "lead" };
  }

  // Where it stands at a stop: just outside the front, or at the node with no front.
  private stopSpot(n: FwNode, y: number): FwXYZ {
    if (!n.front) return { x: n.x, y, z: n.z };
    const mid = { x: (n.front.x1 + n.front.x2) / 2, z: (n.front.z1 + n.front.z2) / 2 };
    let nx = -(n.front.z2 - n.front.z1);
    let nz = n.front.x2 - n.front.x1;
    const len = Math.sqrt(nx * nx + nz * nz);
    nx /= len;
    nz /= len;
    let outside = 0;
    for (const t of this.targets) if (t.id === n.id) outside = t.outside;
    if (outside === 0) outside = 1;
    // sideOf() is positive along (-ez, ex): the same normal as above.
    return { x: mid.x + nx * outside * OUTSIDE_FRONT_M, y, z: mid.z + nz * outside * OUTSIDE_FRONT_M };
  }

  private nextStop(pos: FwXYZ, dir: { x: number; z: number }, now: number): Stop | null {
    const s = this.settings;
    if (s.maxStops > 0 && this.stops >= s.maxStops) return null;
    const near = (n: FwNode) => Math.abs(n.y - pos.y) < SAME_FLOOR_M && flat(n, pos) <= s.pointRadiusM &&
      (n.x - pos.x) * dir.x + (n.z - pos.z) * dir.z >= -BEHIND_M;
    let shop: FwNode | null = null;
    for (const n of this.map.nodes) {
      if (!matches(n, this.prefs) || this.done[n.id] || !near(n)) continue;
      if (!shop || flat(n, pos) < flat(shop, pos)) shop = n;
    }
    if (shop) {
      this.done[shop.id] = true;
      return { id: shop.id, at: shop, spot: this.stopSpot(shop, pos.y), seconds: s.pointSeconds, bubble: null, giveUp: now + STOP_TIMEOUT_S, until: null };
    }
    // Picks on the other floor: the first usable connection each way, once per walk per floor.
    const floor = levelOf(this.map, pos.y);
    let best: FwNode | null = null;
    let bestUp = true;
    for (const n of this.map.nodes) {
      const conn = near(n) ? connection(this.map, n.id) : null;
      if (!conn || !conn.usable || this.done[floorKey(floor, conn.up)]) continue;
      if (otherFloorPicks(this.map, this.prefs, pos.y, conn.up).length === 0) continue;
      if (!best || flat(n, pos) < flat(best, pos)) {
        best = n;
        bestUp = conn.up;
      }
    }
    if (!best) return null;
    this.done[floorKey(floor, bestUp)] = true;
    const count = otherFloorPicks(this.map, this.prefs, pos.y, bestUp).length;
    return { id: best.id, at: best, spot: this.stopSpot(best, pos.y), seconds: s.bubbleSeconds, bubble: floorBubble(count, bestUp), giveUp: now + STOP_TIMEOUT_S, until: null };
  }

  // One step toward `target`, going around you (never closer than clearM).
  private move(pet: FreePet, target: FwXYZ, pos: FwXYZ, dt: number, run: boolean): FreePet {
    const s = this.settings;
    let goal: { x: number; z: number } = target;
    // Does the straight line to the target pass too close to you?
    const dx = target.x - pet.pos.x;
    const dz = target.z - pet.pos.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((pos.x - pet.pos.x) * dx + (pos.z - pet.pos.z) * dz) / len2));
    const closest = { x: pet.pos.x + dx * t, z: pet.pos.z + dz * t };
    const around = t > 0 && t < 1 && flat(closest, pos) < s.clearM;
    if (around) {
      // Head for a point beside you, on the side it is already on (the right one when dead behind).
      const fromYou = flat(pet.pos, pos) > 1e-6 ? { x: pet.pos.x - pos.x, z: pet.pos.z - pos.z } : { x: 0, z: 1 };
      const l = Math.sqrt(fromYou.x * fromYou.x + fromYou.z * fromYou.z);
      let sx = -fromYou.z / l;
      let sz = fromYou.x / l;
      if (sx * dx + sz * dz < 0 || flat(closest, pos) < 1e-6) {
        sx = -sx;
        sz = -sz;
      }
      const out = s.clearM + 0.3;
      goal = { x: pos.x + sx * out, z: pos.z + sz * out };
    }
    const away = flat(pet.pos, goal);
    const running = run || around || flat(pet.pos, target) > s.aheadM + 1;
    const step = (running ? s.runSpeed : s.speed) * dt;
    const k = away <= step ? 1 : step / away;
    const next = { x: pet.pos.x + (goal.x - pet.pos.x) * k, y: pos.y, z: pet.pos.z + (goal.z - pet.pos.z) * k };
    // Never inside the clear circle: pushed out straight away from you.
    const d = flat(next, pos);
    if (d < s.clearM) {
      const ux = d > 1e-6 ? (next.x - pos.x) / d : 1;
      const uz = d > 1e-6 ? (next.z - pos.z) / d : 0;
      next.x = pos.x + ux * s.clearM;
      next.z = pos.z + uz * s.clearM;
    }
    const h = headingTo(pet.pos, next);
    return { pos: next, heading: h === null ? pet.heading : h, mood: running ? "run" : "lead" };
  }

  // The same place with a change (a connection closed): what is ahead changes, the walk doesn't.
  setMap(map: FwMap): void {
    this.map = map;
    this.targets = frontTargets(map);
  }

  update(pos: FwXYZ, heading: number, dt: number, now: number): FreeFrame {
    this.dots.update(lookTarget(this.targets, pos, heading, this.settings.lookRangeM), now, pos);
    const dir = this.ahead.update(pos, heading, dt);
    let stopped: string | null = null;
    let pet = this.pet;
    if (pet) {
      if (Math.abs(pet.pos.y - pos.y) >= SAME_FLOOR_M) {
        // It comes along on a floor change, and never hints back the way you came.
        this.done[floorKey(levelOf(this.map, pos.y), pet.pos.y > pos.y)] = true;
        this.stop = null;
        pet = { pos: this.spotAhead(pos, dir), heading: pet.heading, mood: "lead" };
      }
      if (this.stop) {
        const st = this.stop;
        if ((st.until !== null && now >= st.until) || flat(st.spot, pos) > STOP_LEAVE_M) this.stop = null;
      }
      if (!this.stop) {
        this.stop = this.nextStop(pos, dir, now);
        if (this.stop) this.stops++;
      }
      if (this.stop) {
        const st = this.stop;
        if (st.until === null) {
          const stepped = this.move(pet, st.spot, pos, dt, true);
          pet = { pos: stepped.pos, heading: stepped.heading, mood: "point" };
          if (flat(pet.pos, st.spot) < 0.15 || flat(st.spot, pos) < this.settings.clearM || now >= st.giveUp) {
            st.until = now + st.seconds;
            stopped = st.id;
          }
        } else {
          const h = headingTo(pet.pos, st.at);
          pet = { pos: pet.pos, heading: h === null ? pet.heading : h, mood: "point" };
        }
      } else {
        pet = this.move(pet, this.spotAhead(pos, dir), pos, dt, false);
      }
      this.pet = pet;
    }
    const st = this.stop;
    return {
      dot: this.dots.dot,
      open: this.dots.open,
      pet,
      pointing: st ? st.id : null,
      bubble: st && st.until !== null ? st.bubble : null,
      stopped,
    };
  }
}

function floorKey(y: number, up: boolean): string {
  return "floor:" + y + (up ? ":up" : ":down");
}

// The height of the map's floor closest to these feet, so swaying feet are always one floor.
function levelOf(map: FwMap, y: number): number {
  let best = y;
  let bestD = Infinity;
  for (const n of map.nodes) {
    const d = Math.abs(n.y - y);
    if (d < bestD) {
      bestD = d;
      best = n.y;
    }
  }
  return best;
}

// ── Go to a place ────────────────────────────────────────────────────────────

// The map's named places and destinations, by name: the "Where to?" list and the matcher's names.
export function destinationsOf(map: FwMap): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const n of map.nodes) {
    if ((n.kind === "place" || n.kind === "destination" || n.kind === "gate") && n.label) out.push({ id: n.id, label: n.label });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

// The "Say it" stand-in's phrase: the map's own, or the map's default destination.
export function sayItPhrase(map: FwMap): string {
  const p = map.place;
  if (p && p.sayIt) return p.sayIt;
  const to = p && p.destination ? map.nodes.filter((n) => n.id === p.destination)[0] : null;
  return to ? "Take me to " + (to.label || to.id) : "";
}

const FILLER = ["take", "me", "to", "the", "go", "find", "where", "is", "i", "want", "please", "a", "an", "show", "can", "you", "at", "lets"];

function words(text: string): string[] {
  const plain = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ");
  return plain.split(" ").filter((w) => w !== "");
}

// A name said in full at the end of the phrase ("take me to the show"), the longest such name.
function saidInFull(map: FwMap, heard: string[]): string | null {
  let best: string | null = null;
  let bestLength = 0;
  for (const d of destinationsOf(map)) {
    const name = words(d.label);
    if (name.length <= bestLength || name.length > heard.length) continue;
    if (name.join(" ") === heard.slice(heard.length - name.length).join(" ")) {
      bestLength = name.length;
      best = d.id;
    }
  }
  return best;
}

// The plain-code matcher: a name said in full wins; otherwise it drops filler words and a name
// matches when all the words left are in it, shortest name first. Null when nothing matches.
export function matchDestination(map: FwMap, phrase: string): string | null {
  const heard = words(phrase);
  const full = saidInFull(map, heard);
  if (full !== null) return full;
  const said = heard.filter((w) => FILLER.indexOf(w) < 0);
  if (said.length === 0) return null;
  let best: string | null = null;
  let bestExtra = Infinity;
  for (const d of destinationsOf(map)) {
    const name = words(d.label);
    if (!said.every((w) => name.indexOf(w) >= 0)) continue;
    const extra = name.length - said.length;
    if (extra < bestExtra) {
      bestExtra = extra;
      best = d.id;
    }
  }
  return best;
}
