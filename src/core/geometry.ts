// Pure guidance and coordinate maths shared by the Lens and the Node tests. No imports and no
// Lens globals, so the same file runs in both. The Lens keeps a byte-identical copy at
// Assets/Scripts/FindYourWayGeometry.ts.
//
// Map metres: x east, y up, z north. Headings: degrees clockwise from north.
// Building-local centimetres: the start sign at the origin, north along -Z, y up.

export interface XYZ {
  x: number;
  y: number;
  z: number;
}

export function headingOf(a: XYZ, b: XYZ): number | null {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (Math.abs(dx) < 1e-3 && Math.abs(dz) < 1e-3) return null;
  return (Math.atan2(dx, dz) * 180) / Math.PI;
}

export function wrap(deg: number): number {
  if (!isFinite(deg)) return 0;
  if (deg >= -180 && deg <= 180) return deg;
  const d = (deg + 180) % 360;
  const out = (d <= 0 ? d + 360 : d) - 180;
  return deg < 0 && out === 180 ? -180 : out;
}

// Signed yaw from the viewer's heading to the target (+ = to the right).
export function yawTo(user: XYZ, headingDeg: number, target: XYZ): number | null {
  const h = headingOf(user, target);
  if (h === null) return null;
  return wrap(h - headingDeg);
}

export function flatDistance(a: XYZ, b: XYZ): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// Given the route from the traveller onward ([closest point, next node, ...], e.g. from
// lineAhead with a long look-ahead), the next point where it bends by at least minTurnDeg,
// or its end.
export function nextTurnAlong(ahead: XYZ[], minTurnDeg: number = 25): XYZ | null {
  if (ahead.length < 2) return null;
  for (let i = 1; i < ahead.length - 1; i++) {
    const h1 = headingOf(ahead[i - 1], ahead[i]);
    const h2 = headingOf(ahead[i], ahead[i + 1]);
    if (h1 === null || h2 === null) continue;
    if (Math.abs(wrap(h2 - h1)) >= minTurnDeg) return ahead[i];
  }
  return ahead[ahead.length - 1];
}

// True when the turn arrow should show: the next turn is more than halfViewDeg off the
// viewer's heading and at least minDistance away.
export function turnOutOfView(user: XYZ, headingDeg: number, turn: XYZ | null, halfViewDeg: number,
    minDistance: number = 1.5): boolean {
  if (!turn || flatDistance(user, turn) < minDistance) return false;
  const yaw = yawTo(user, headingDeg, turn);
  return yaw !== null && Math.abs(yaw) > halfViewDeg;
}

// Map metres -> building-local cm. The origin is the start node (x, y and z), so a start sign
// on an upper floor is still at local height 0; liftCm raises the result (e.g. sign height).
export function mapToLocalCm(p: XYZ, origin: XYZ, liftCm: number = 0): XYZ {
  return { x: (p.x - origin.x) * 100, y: (p.y - origin.y) * 100 + liftCm, z: -(p.z - origin.z) * 100 };
}

// Building-local cm of the eyes -> map metres of the feet (the inverse of mapToLocalCm with
// liftCm = eyeHeightCm).
export function localCmToMap(local: XYZ, origin: XYZ, eyeHeightCm: number): XYZ {
  return { x: local.x / 100 + origin.x, y: (local.y - eyeHeightCm) / 100 + origin.y, z: origin.z - local.z / 100 };
}

// Below this horizontal length the view direction is (almost) straight up or down and has no
// usable heading.
export const MIN_FORWARD_XZ = 0.05;

// Yaw (radians, about +Y) that turns -Z toward the view direction projected on the floor:
// facing -Z is 0, facing -X is +PI/2. Looking straight down or up keeps lastYaw.
export function yawFromForward(fx: number, fz: number, lastYaw: number): number {
  if (Math.sqrt(fx * fx + fz * fz) < MIN_FORWARD_XZ) return lastYaw;
  return Math.atan2(-fx, -fz) + 0;
}

// How far either side of a slope's centre line counts as on it, and how far the feet may be from
// its surface: enough for a walking step, too little to catch someone on the floor underneath.
const SLOPE_HALF_WIDTH_M = 1.2;
const SLOPE_STEP_M = 0.5;

// The height of the stairs, ramp or escalator under these feet, or null when they aren't on one.
// A closed connection is not a slope, and an escalator only carries you its own way.
export function feetOnSlope(
  map: { nodes: (XYZ & { id: string })[]; edges: { from: string; to: string; kind: string; open: boolean }[] },
  feet: XYZ,
): number | null {
  let best: number | null = null;
  let bestGap = SLOPE_STEP_M;
  for (const e of map.edges) {
    if (!e.open || (e.kind !== "stairs" && e.kind !== "ramp" && e.kind !== "escalator")) continue;
    const a = map.nodes.filter((n) => n.id === e.from)[0];
    const b = map.nodes.filter((n) => n.id === e.to)[0];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const rise = b.y - a.y;
    const len2 = dx * dx + dz * dz;
    if (len2 === 0 || Math.abs(rise) < 0.3) continue;
    const t = ((feet.x - a.x) * dx + (feet.z - a.z) * dz) / len2;
    if (t < 0 || t > 1) continue;
    if (Math.abs((feet.x - a.x) * dz - (feet.z - a.z) * dx) / Math.sqrt(len2) > SLOPE_HALF_WIDTH_M) continue;
    const h = a.y + rise * t;
    const gap = Math.abs(h - feet.y);
    if (gap > bestGap) continue;
    if (e.kind === "escalator" && (h - feet.y) * rise < 0) continue;
    best = h;
    bestGap = gap;
  }
  return best;
}

// The drawn line ends at the foot of a vertical lift segment (ridden with the floor button).
export function stopAtLift<T extends XYZ>(pts: T[]): T[] {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (Math.abs(b.y - a.y) > 1 && flatDistance(a, b) < 0.5) return pts.slice(0, i);
  }
  return pts;
}

// The drawn line stays on the traveller's floor: it ends at the foot of the next level change
// (lift, escalator, stairs or ramp: any segment that climbs or drops at least 0.5 m), where a
// short up/down marker shows instead of a line through the ceiling or floor. Standing on a
// sloped connection already (its first segment climbs and, when the traveller's floor height is
// given, the closest point is at least 0.25 m off it), the line is drawn up it and on; before
// that, or standing in a lift, only the marker shows. floorY: router.ts's TripAhead.floorY.
export function lineOnLevel<T extends XYZ>(pts: T[], floorY?: number): { line: T[]; marker: { at: T; up: boolean } | null } {
  // Still at the foot: the closest point is (nearly) on the traveller's floor.
  const atFoot = typeof floorY === "number" && pts.length > 1 && Math.abs(pts[0].y - floorY) < 0.25 && Math.abs(pts[1].y - floorY) >= 0.25;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (Math.abs(b.y - a.y) < 0.5) continue;
    if (i === 0 && flatDistance(a, b) >= 0.5 && !atFoot) continue;
    return { line: pts.slice(0, i + 1), marker: { at: a, up: b.y > a.y } };
  }
  return { line: pts, marker: null };
}

// What stops you in the preview: the outer walls, the shop fronts, the lift shafts and the sides of
// stairs, ramps and escalators, all worked out from the map so every building gets them. On Specs the
// real building does this.

interface WallNode extends XYZ {
  id: string;
  kind: string;
  front?: unknown;
}

interface WallEdge {
  from: string;
  to: string;
  kind: string;
  open: boolean;
}

export interface WallMap {
  nodes: WallNode[];
  edges: WallEdge[];
  place?: { footprint?: { minX: number; maxX: number; minZ: number; maxZ: number } };
}

const BODY_M = 1.15; // how near a wall your eyes may come: panels float 1 m ahead and must stay in front of it
const SAME_FLOOR_M = 0.5;
const SHOP_BACK_M = 1.7; // a shop's front stands this far behind its node (the stand-in draws it here)
const SHOP_HALF_M = 2.8;
const LIFT_BACK_M = 1.4;
const LIFT_HALF_M = 1.1;
const SLAB_HALF_M = 1.2;
const RAIL_M = 0.3; // on a slope you stay this close to its side
const HEADROOM_M = 2.2; // a slab higher than this above you is walked under
const SLAB_NEAR_M = 0.5; // a slab within this of your feet is the way on, not a wall
const PATH_HALF_M = 0.5; // the map's own walkways stay open, however tight the building
const STEP_M = 0.2; // long moves are checked in steps this long, so a wall can't be jumped
const JUMP_M = 3; // further than this in a frame is a ride or a reset, not walking

function dirFrom(map: WallMap, n: WallNode): { x: number; z: number } | null {
  for (const e of map.edges) {
    if (e.kind === "lift") continue;
    const otherId = e.from === n.id ? e.to : e.to === n.id ? e.from : null;
    if (otherId === null) continue;
    const o = map.nodes.filter((m) => m.id === otherId)[0];
    if (!o || Math.abs(o.y - n.y) > SAME_FLOOR_M) continue;
    const dx = o.x - n.x;
    const dz = o.z - n.z;
    const l = Math.sqrt(dx * dx + dz * dz);
    if (l > 0.01) return { x: dx / l, z: dz / l };
  }
  return null;
}

// Is p too close to the wall across dir, `back` metres behind n and `half` metres each way?
function nearWall(p: XYZ, n: WallNode, dir: { x: number; z: number }, back: number, half: number): boolean {
  const cx = n.x - dir.x * back;
  const cz = n.z - dir.z * back;
  const along = (p.x - cx) * -dir.z + (p.z - cz) * dir.x;
  const across = (p.x - cx) * dir.x + (p.z - cz) * dir.z;
  return Math.abs(along) < half + BODY_M && Math.abs(across) < BODY_M;
}

// Where p falls along and beside a connection, and the connection's height there; null if not beside it.
function besideSlope(map: WallMap, e: WallEdge, p: XYZ, halfM: number): { h: number; offFloor: number } | null {
  if (e.kind !== "stairs" && e.kind !== "ramp" && e.kind !== "escalator") return null;
  const a = map.nodes.filter((n) => n.id === e.from)[0];
  const b = map.nodes.filter((n) => n.id === e.to)[0];
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return null;
  const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2;
  if (t < 0 || t > 1) return null;
  if (Math.abs((p.x - a.x) * dz - (p.z - a.z) * dx) / Math.sqrt(len2) > halfM) return null;
  const h = a.y + (b.y - a.y) * t;
  return { h, offFloor: Math.min(Math.abs(h - a.y), Math.abs(h - b.y)) };
}

function onWalkway(map: WallMap, p: XYZ): boolean {
  for (const e of map.edges) {
    const a = map.nodes.filter((n) => n.id === e.from)[0];
    const b = map.nodes.filter((n) => n.id === e.to)[0];
    if (!a || !b || Math.abs(a.y - p.y) > SAME_FLOOR_M || Math.abs(b.y - p.y) > SAME_FLOOR_M) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
    if (Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t) < PATH_HALF_M) return true;
  }
  return false;
}

// The drawn half-widths of the stand-in's connectors (FindYourWayStandIn: 120 / 180 / 160 cm wide).
// Ramps rise gently and corridors run beside them (hospital): only stairs and escalators block here.
export const DRAWN_HALF_M: { [kind: string]: number } = { escalator: 0.6, stairs: 0.9 };

// Does a walkway on p's floor, near p, run across this connector's footprint? (A map may lead a corridor
// under a staircase, as the hospital does: that corridor stays walkable.)
function walkwayCrosses(map: WallMap, c: WallEdge, p: XYZ, half: number): boolean {
  const ca = map.nodes.filter((n) => n.id === c.from)[0];
  const cb = map.nodes.filter((n) => n.id === c.to)[0];
  if (!ca || !cb) return false;
  for (const e of map.edges) {
    if (e.kind !== "walk") continue;
    const a = map.nodes.filter((n) => n.id === e.from)[0];
    const b = map.nodes.filter((n) => n.id === e.to)[0];
    if (!a || !b || Math.abs(a.y - p.y) > SAME_FLOOR_M || Math.abs(b.y - p.y) > SAME_FLOOR_M) continue;
    const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
    if (Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t) >= PATH_HALF_M) continue;
    // Sample the walkway: does it pass inside the connector's drawn body, away from both of its ends?
    for (let k = 1; k < 20; k++) {
      const q = { x: a.x + (dx * k) / 20, y: p.y, z: a.z + (dz * k) / 20 };
      const s = besideSlope(map, c, q, half);
      if (s && s.offFloor > SLAB_NEAR_M) return true;
    }
  }
  return false;
}

function slabInTheWay(map: WallMap, p: XYZ): boolean {
  for (const e of map.edges) {
    const half = DRAWN_HALF_M[e.kind];
    if (!half) continue;
    const s = besideSlope(map, e, p, half);
    if (!s) continue;
    const above = s.h - p.y;
    if (Math.abs(above) > SLAB_NEAR_M && above < HEADROOM_M && above > -HEADROOM_M && !walkwayCrosses(map, e, p, half)) return true;
  }
  return false;
}

// True when you can stand at p.
export function isClear(map: WallMap, p: XYZ): boolean {
  // A stair or escalator body blocks even next to a walkway (R2-30): beside it mid-height, or over
  // its opening on the floor above. On the slope itself you are fine.
  if (feetOnSlope(map, p) !== null) return true;
  if (slabInTheWay(map, p)) return false;
  if (onWalkway(map, p)) return true;
  const box = map.place && map.place.footprint;
  if (box && (p.x < box.minX + BODY_M || p.x > box.maxX - BODY_M || p.z < box.minZ + BODY_M || p.z > box.maxZ - BODY_M)) return false;
  if (feetOnSlope(map, p) !== null) return true;
  for (const n of map.nodes) {
    if (Math.abs(n.y - p.y) > SAME_FLOOR_M) continue;
    const shop = n.kind === "place" || n.kind === "destination";
    if (!shop && n.kind !== "lift") continue;
    const dir = dirFrom(map, n);
    if (dir && nearWall(p, n, dir, shop ? SHOP_BACK_M : LIFT_BACK_M, shop ? SHOP_HALF_M : LIFT_HALF_M)) return false;
  }
  for (const e of map.edges) {
    const s = besideSlope(map, e, p, SLAB_HALF_M + BODY_M / 2);
    if (!s) continue;
    const above = s.h - p.y;
    if (Math.abs(above) > SLAB_NEAR_M && above < HEADROOM_M && above > -HEADROOM_M) return false;
  }
  return true;
}

// Stepping off a slope's side while up on it: the rail holds you. Near either floor you just walk off.
function rail(map: WallMap, from: XYZ, to: XYZ): boolean {
  if (feetOnSlope(map, from) === null || feetOnSlope(map, to) !== null || onWalkway(map, to)) return false;
  for (const e of map.edges) {
    const s = besideSlope(map, e, to, SLAB_HALF_M + RAIL_M);
    if (s && s.offFloor > SLAB_NEAR_M && Math.abs(s.h - from.y) < 1) return true;
  }
  return false;
}

function free(map: WallMap, from: XYZ, to: XYZ): boolean {
  return isClear(map, to) && !rail(map, from, to);
}

// Where a step from `from` towards `to` really ends: stopped at a wall, sliding along it if the step
// goes along it too. A ride or a jump passes, and so does any step that starts inside a wall.
export function walkStep(map: WallMap, from: XYZ, to: XYZ): XYZ {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > JUMP_M || Math.abs(to.y - from.y) > 1 || !isClear(map, from)) return to;
  const steps = Math.max(1, Math.ceil(dist / STEP_M));
  const y = to.y;
  let x = from.x;
  let z = from.z;
  // Each axis on its own, so a blocked step still slides along the wall.
  for (let i = 0; i < steps; i++) {
    if (free(map, { x, y, z }, { x: x + dx / steps, y, z })) x += dx / steps;
    if (free(map, { x, y, z }, { x, y, z: z + dz / steps })) z += dz / steps;
  }
  return Math.abs(x - to.x) < 1e-9 && Math.abs(z - to.z) < 1e-9 ? to : { x, y, z };
}

// Chevrons along the floor line: every `spacing` (the first at 0.6 of it), a "^" `size` long and
// wide pointing the way the line goes. Same units as the points (the Lens passes cm).
export function chevronMarks(pts: XYZ[], spacing: number, size: number): { apex: XYZ; left: XYZ; right: XYZ }[] {
  const out: { apex: XYZ; left: XYZ; right: XYZ }[] = [];
  if (pts.length < 2 || spacing <= 0) return out;
  let next = spacing * 0.6;
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
    const flatLen = Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
    if (len < 1e-9) continue;
    while (next <= walked + len && flatLen > 1e-9) {
      const t = (next - walked) / len;
      const c = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
      const dx = (b.x - a.x) / flatLen;
      const dz = (b.z - a.z) / flatLen;
      const h = size / 2;
      out.push({
        apex: { x: c.x + dx * h, y: c.y, z: c.z + dz * h },
        left: { x: c.x - dx * h - dz * h, y: c.y, z: c.z - dz * h + dx * h },
        right: { x: c.x - dx * h + dz * h, y: c.y, z: c.z - dz * h - dx * h },
      });
      next += spacing;
    }
    walked += len;
  }
  return out;
}

