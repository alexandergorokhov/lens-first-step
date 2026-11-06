// The companion points at shops but stays in view. Pure logic shared by the Lens and the Node
// tests: no imports and no Lens globals.
//   - clampToView: a spot pulled into the cone you are looking along (±VIEW_HALF_DEG, between
//     VIEW_NEAR_M and VIEW_FAR_M ahead), never behind you.
//   - asideSpot: where it stands to point: at most ASIDE_MAX_M off its lead spot toward the shop,
//     then clamped to the view.
//   - PointMachine: lead → aside → point → return → lead, once per shop, COOLDOWN_S between points.
//   - OutOfViewTimer: the small floor arrow shows once it has been out of view for OUT_OF_VIEW_S.
//   - shopTrigger: the matching shop to point at (within TRIGGER_RADIUS_M, near the path, ahead).
// Headings are degrees, 0 = looking along +z (as in freewalk.ts and pet.ts).

export interface VXYZ {
  x: number;
  y: number;
  z: number;
}

export const VIEW_HALF_DEG = 15;
// Out of view (for the floor arrow): further off than this from where you look. Wider than the
// cone it is kept in, so a companion catching up with a moving spot never flickers out.
export const FOV_HALF_DEG = 20;
export const VIEW_NEAR_M = 1.5;
export const VIEW_FAR_M = 6;
export const ASIDE_MAX_M = 1.2;
export const POINT_HOLD_S = 2.5;
export const ASIDE_GIVE_UP_S = 3;
export const COOLDOWN_S = 10;
export const OUT_OF_VIEW_S = 2;
export const ARROW_OPACITY = 0.2;
export const TRIGGER_RADIUS_M = 8;
export const NEAR_PATH_M = 3;
// A shop further behind you than this (m, along your path) is not pointed at.
const BEHIND_M = 0.5;
const SAME_FLOOR_M = 1;

function wrap(deg: number): number {
  let d = deg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function flat(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// Is this spot inside the view cone (angle only up to a small margin, and not behind)?
export function inView(user: VXYZ, heading: number, p: { x: number; z: number }, halfDeg: number = VIEW_HALF_DEG): boolean {
  if (flat(user, p) < 1e-6) return false;
  const a = (Math.atan2(p.x - user.x, p.z - user.z) * 180) / Math.PI;
  return Math.abs(wrap(a - heading)) <= halfDeg + 1e-6;
}

// The spot moved into the view cone: its bearing clamped to ±halfDeg of where you look (a spot
// behind you goes to the front edge on its own side), its distance to [VIEW_NEAR_M, VIEW_FAR_M].
// `far` can be raised for a companion that leads further than VIEW_FAR_M (the Inspector's lead).
export function clampToView(user: VXYZ, heading: number, p: VXYZ, halfDeg: number = VIEW_HALF_DEG, far: number = VIEW_FAR_M): VXYZ {
  let d = flat(user, p);
  let off = d < 1e-6 ? 0 : wrap((Math.atan2(p.x - user.x, p.z - user.z) * 180) / Math.PI - heading);
  const inside = Math.abs(off) <= halfDeg && d >= VIEW_NEAR_M && d <= far;
  if (inside) return p;
  off = Math.max(-halfDeg, Math.min(halfDeg, off));
  d = Math.max(VIEW_NEAR_M, Math.min(far, d));
  const rad = ((heading + off) * Math.PI) / 180;
  return { x: user.x + Math.sin(rad) * d, y: p.y, z: user.z + Math.cos(rad) * d };
}

// Where the companion stands to point: from its lead spot, up to `step` m toward the shop, then
// into the view.
export function asideSpot(user: VXYZ, heading: number, lead: VXYZ, shop: { x: number; z: number }, step: number = ASIDE_MAX_M): VXYZ {
  const d = flat(lead, shop);
  const k = d <= step || d < 1e-6 ? 1 : step / d;
  const raw = { x: lead.x + (shop.x - lead.x) * k, y: lead.y, z: lead.z + (shop.z - lead.z) * k };
  return clampToView(user, heading, raw);
}

export type PointState = "lead" | "aside" | "point" | "return";

// lead → aside (walking to the aside spot) → point (POINT_HOLD_S) → return (to the lead spot) → lead.
// update(now, arrived): `arrived` = it has reached the spot it is walking to this frame.
export class PointMachine {
  state: PointState = "lead";
  shop: string | null = null;
  pointSeconds = POINT_HOLD_S;
  cooldown = COOLDOWN_S;
  private since = 0;
  private lastPoint = -Infinity;
  private done: { [id: string]: boolean } = Object.create(null);

  // Start pointing at a shop: false when busy, within the cooldown, or already pointed at.
  trigger(id: string, now: number): boolean {
    if (this.state !== "lead" || this.done[id] || now - this.lastPoint < this.cooldown) return false;
    this.done[id] = true;
    this.shop = id;
    this.state = "aside";
    this.since = now;
    this.lastPoint = now;
    return true;
  }

  wasPointed(id: string): boolean {
    return !!this.done[id];
  }

  update(now: number, arrived: boolean): PointState {
    if (this.state === "aside" && (arrived || now - this.since >= ASIDE_GIVE_UP_S)) {
      this.state = "point";
      this.since = now;
    } else if (this.state === "point" && now - this.since >= this.pointSeconds) {
      this.state = "return";
    } else if (this.state === "return" && arrived) {
      this.state = "lead";
      this.shop = null;
    }
    return this.state;
  }

  // A card, an arrival or a re-route: stop pointing and go back to lead.
  stop(): void {
    if (this.state === "aside" || this.state === "point") this.state = "return";
  }

  reset(): void {
    this.state = "lead";
    this.shop = null;
    this.lastPoint = -Infinity;
    this.done = Object.create(null);
  }
}

// The floor arrow: true once the companion has been out of view for `after` seconds in a row.
export class OutOfViewTimer {
  private out = 0;
  private after: number;

  constructor(after: number = OUT_OF_VIEW_S) {
    this.after = after;
  }

  update(inViewNow: boolean, dt: number): boolean {
    if (inViewNow) {
      this.out = 0;
      return false;
    }
    this.out += dt;
    return this.out > this.after;
  }

  reset(): void {
    this.out = 0;
  }
}

export interface VShop {
  id: string;
  x: number;
  y: number;
  z: number;
  match: boolean;
}

function distToSegment(p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
  return flat(p, { x: a.x + dx * t, z: a.z + dz * t });
}

// The nearest matching shop not yet done: within `radius` of you, on your floor, within
// NEAR_PATH_M of the path ahead (the route, or a short line ahead in Free walk) and not behind you.
export function shopTrigger(shops: VShop[], user: VXYZ, path: VXYZ[], done: (id: string) => boolean, radius: number = TRIGGER_RADIUS_M): VShop | null {
  let dir: { x: number; z: number } | null = null;
  for (let i = 0; i < path.length - 1 && !dir; i++) {
    const l = flat(path[i], path[i + 1]);
    if (l > 1e-3) dir = { x: (path[i + 1].x - path[i].x) / l, z: (path[i + 1].z - path[i].z) / l };
  }
  let best: VShop | null = null;
  for (const s of shops) {
    if (!s.match || done(s.id) || Math.abs(s.y - user.y) >= SAME_FLOOR_M) continue;
    const d = flat(s, user);
    if (d > radius) continue;
    if (dir && (s.x - user.x) * dir.x + (s.z - user.z) * dir.z < -BEHIND_M) continue;
    let near = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      if (Math.abs(path[i].y - user.y) >= SAME_FLOOR_M) continue;
      near = Math.min(near, distToSegment(s, path[i], path[i + 1]));
    }
    if (near > NEAR_PATH_M) continue;
    if (!best || d < flat(best, user)) best = s;
  }
  return best;
}

// The offers card never covers an open menu. Rects are centre + full size, in cm on the
// head-locked plane 70 cm ahead (x right, y up). Slots are all above the line of sight: top
// right first (as on a trip), then top left, then higher up on either side.
export interface VRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const OFFER_SLOTS: { x: number; y: number }[] = [
  { x: 11.5, y: 5 },
  { x: -13, y: 5 },
  { x: 11.5, y: 11 },
  { x: -13, y: 11 },
];

export function rectsOverlap(a: VRect, b: VRect): number {
  const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
  const oy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
  return ox > 0 && oy > 0 ? ox * oy : 0;
}

// What the wearer sees on that plane (cm, full size; the preview is about 40 x 45, Specs a bit more).
export const OFFER_VIEW = { w: 38, h: 40 };

export function offersSlot(card: { w: number; h: number }, panels: VRect[], slots = OFFER_SLOTS): { x: number; y: number } {
  // Every slot is pulled in so the whole card stays inside the view.
  const fit = (v: number, size: number, view: number) => {
    const m = Math.max(0, view / 2 - size / 2);
    return Math.max(-m, Math.min(m, v));
  };
  const inView = slots.map((s) => ({ x: fit(s.x, card.w, OFFER_VIEW.w), y: fit(s.y, card.h, OFFER_VIEW.h) }));
  let best = inView[0];
  let bestArea = Infinity;
  for (const s of inView) {
    const r = { x: s.x, y: s.y, w: card.w, h: card.h };
    const area = panels.reduce((sum, p) => sum + rectsOverlap(r, p), 0);
    if (area === 0) return s;
    if (area < bestArea) {
      best = s;
      bestArea = area;
    }
  }
  return best;
}
