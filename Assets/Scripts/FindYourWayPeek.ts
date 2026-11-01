// Peek ahead (hand zoom): pinch and pull, and a small model of the route appears in front of the
// traveller with a dot for them. This builds that model from the route points alone: one uniform
// scale so the route fits a box of PEEK_SIZE metres centred on the origin (the Lens parents it
// ~0.6 m ahead at waist height), the traveller's dot in the same space, and where the walked part
// ends. Pure: it never changes the route or the position it is given, so showing or hiding the
// model can never change the route (Z3).
// Shared by the Lens and the Node tests: no imports and no Lens globals; the Lens keeps a
// byte-identical, renamed copy.
//
// Map metres: x east, y up, z north. Model space: metres too, just smaller.

export interface PeekPoint {
  x: number;
  y: number;
  z: number;
}

export interface PeekModel {
  // Model metres per map metre (the same on every axis, so proportions are kept).
  scale: number;
  // The map point that sits at the model's origin (the centre of the route's bounding box).
  centre: PeekPoint;
  // The route points in model space.
  route: PeekPoint[];
  // The traveller's dot in model space.
  you: PeekPoint;
  // Index of the first route point still ahead: route[0..done) is walked (drawn dim), the rest
  // glows from the dot on.
  done: number;
}

// Edge of the box the model fits in (m).
export const PEEK_SIZE = 0.4;

// The traveller's place on the route: segment index and fraction along it (closest in 3D).
function project(route: PeekPoint[], user: PeekPoint): { seg: number; t: number } {
  let seg = 0;
  let segT = 0;
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2;
    let t = len2 === 0 ? 0 : ((user.x - a.x) * (b.x - a.x) + (user.y - a.y) * (b.y - a.y) + (user.z - a.z) * (b.z - a.z)) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + (b.x - a.x) * t - user.x;
    const py = a.y + (b.y - a.y) * t - user.y;
    const pz = a.z + (b.z - a.z) * t - user.z;
    const d = px * px + py * py + pz * pz;
    if (d < best - 1e-12) {
      best = d;
      seg = i;
      segT = t;
    }
  }
  return { seg, t: segT };
}

// The model of `points` (route, map metres) with the traveller at `user`. opts.size: box edge (m).
// An empty route gives an empty model centred on the traveller; a single point (or a route with
// no extent) uses scale 1 around that point.
export function peekModel(points: PeekPoint[], user: PeekPoint, opts?: { size?: number }): PeekModel {
  const size = opts && typeof opts.size === "number" && opts.size > 0 ? opts.size : PEEK_SIZE;
  if (points.length === 0) {
    return { scale: 1, centre: { x: user.x, y: user.y, z: user.z }, route: [], you: { x: 0, y: 0, z: 0 }, done: 0 };
  }
  const lo = { x: Infinity, y: Infinity, z: Infinity };
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    lo.x = Math.min(lo.x, p.x);
    lo.y = Math.min(lo.y, p.y);
    lo.z = Math.min(lo.z, p.z);
    hi.x = Math.max(hi.x, p.x);
    hi.y = Math.max(hi.y, p.y);
    hi.z = Math.max(hi.z, p.z);
  }
  const centre = { x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2, z: (lo.z + hi.z) / 2 };
  const extent = Math.max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z);
  const scale = extent > 1e-9 ? size / extent : 1;
  const toModel = (p: PeekPoint): PeekPoint => ({ x: (p.x - centre.x) * scale, y: (p.y - centre.y) * scale, z: (p.z - centre.z) * scale });

  let done = 0;
  if (points.length === 1) done = 1;
  else {
    const { seg, t } = project(points, user);
    // Past the segment's start; at its end (only possible on the last one) the whole route is walked.
    done = t >= 1 ? seg + 2 : seg + 1;
  }
  return { scale, centre, route: points.map(toModel), you: toModel(user), done: Math.min(done, points.length) };
}

// The whole walked map as a small model ("See my map"), for the Map builder's review: every
// stretch as a segment, a dot per shop and one for you, in the same box as peekModel.
export interface PeekMapModel {
  scale: number;
  segments: { a: PeekPoint; b: PeekPoint }[];
  shops: PeekPoint[];
  you: PeekPoint;
}

export function peekMap(
  map: { nodes: (PeekPoint & { id: string; kind: string })[]; edges: { from: string; to: string }[] },
  user: PeekPoint,
  opts?: { size?: number },
): PeekMapModel {
  const size = opts && typeof opts.size === "number" && opts.size > 0 ? opts.size : PEEK_SIZE;
  const lo = { x: Infinity, y: Infinity, z: Infinity };
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of (map.nodes as PeekPoint[]).concat([user])) {
    lo.x = Math.min(lo.x, p.x);
    lo.y = Math.min(lo.y, p.y);
    lo.z = Math.min(lo.z, p.z);
    hi.x = Math.max(hi.x, p.x);
    hi.y = Math.max(hi.y, p.y);
    hi.z = Math.max(hi.z, p.z);
  }
  const extent = Math.max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z);
  const scale = extent > 1e-9 ? size / extent : 1;
  const c = { x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2, z: (lo.z + hi.z) / 2 };
  const toModel = (p: PeekPoint): PeekPoint => ({ x: (p.x - c.x) * scale, y: (p.y - c.y) * scale, z: (p.z - c.z) * scale });
  const at: { [id: string]: PeekPoint } = Object.create(null);
  for (const n of map.nodes) at[n.id] = n;
  const segments: { a: PeekPoint; b: PeekPoint }[] = [];
  for (const e of map.edges) if (at[e.from] && at[e.to]) segments.push({ a: toModel(at[e.from]), b: toModel(at[e.to]) });
  return { scale, segments, shops: map.nodes.filter((n) => n.kind === "place").map(toModel), you: toModel(user) };
}

// The whole place as a small model you can look into: every floor a plate, stacked evenly apart
// (real floors would sit almost on top of each other at this scale), its corridors and shops, the
// connections between floors, and your route and dot on top.
export type PlaceGroup = "food" | "fun" | "service" | "shop";

export interface PeekPlaceSpot {
  id: string;
  at: PeekPoint;
  group: PlaceGroup;
}

export interface PeekFloor {
  y: number;
  segments: { a: PeekPoint; b: PeekPoint }[];
  places: PeekPlaceSpot[];
}

export interface PeekPlaceModel {
  scale: number;
  floors: PeekFloor[];
  links: { a: PeekPoint; b: PeekPoint; kind: string; open: boolean }[];
  route: PeekPoint[];
  you: PeekPoint;
  target: PeekPoint | null;
  // As in PeekModel: route[0..done) is walked.
  done: number;
  // Index of your floor.
  current: number;
  // Stays the same while only the route and your dot move, so the floors need no rebuilding.
  key: string;
}

interface PlaceMap {
  nodes: (PeekPoint & { id: string; kind: string; category?: string })[];
  edges: { from: string; to: string; kind: string; open?: boolean }[];
}

// Model metres between two floors of the stack.
export const PEEK_FLOOR_GAP = 0.13;
const SAME_FLOOR = 0.5;

const GROUPS: { [category: string]: PlaceGroup } = Object.create(null);
for (const c of ["coffee", "food"]) GROUPS[c] = "food";
for (const c of ["kids", "sport", "books"]) GROUPS[c] = "fun";
for (const c of ["toilet", "accessibleToilet", "pharmacy", "cash"]) GROUPS[c] = "service";

// The colour family of a place.
export function placeGroup(category: string | undefined): PlaceGroup {
  return (category && GROUPS[category]) || "shop";
}

const isPlace = (n: { kind: string }) => n.kind === "place" || n.kind === "destination";

function floorHeights(map: PlaceMap): number[] {
  const out: number[] = [];
  for (const y of map.nodes.map((n) => n.y).sort((a, b) => a - b)) {
    if (out.every((o) => Math.abs(o - y) >= SAME_FLOOR)) out.push(y);
  }
  return out;
}

function floorIndex(levels: number[], y: number): number {
  let best = 0;
  for (let i = 1; i < levels.length; i++) if (Math.abs(levels[i] - y) < Math.abs(levels[best] - y)) best = i;
  return best;
}

// Where a height sits in the stack, in floors: 1.5 is halfway between floors 1 and 2.
function stackHeight(levels: number[], y: number): number {
  if (levels.length === 0 || y <= levels[0]) return 0;
  for (let i = 0; i < levels.length - 1; i++) {
    if (y <= levels[i + 1]) return i + (y - levels[i]) / (levels[i + 1] - levels[i]);
  }
  return levels.length - 1;
}

export function peekPlace(map: PlaceMap, route: PeekPoint[], user: PeekPoint, opts?: { size?: number; gap?: number }): PeekPlaceModel {
  const size = opts && typeof opts.size === "number" && opts.size > 0 ? opts.size : PEEK_SIZE;
  const gap = opts && typeof opts.gap === "number" && opts.gap > 0 ? opts.gap : PEEK_FLOOR_GAP;
  const levels = floorHeights(map);
  const xs = map.nodes.map((n) => n.x);
  const zs = map.nodes.map((n) => n.z);
  const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  const minZ = Math.min.apply(null, zs), maxZ = Math.max.apply(null, zs);
  const extent = Math.max(maxX - minX, maxZ - minZ);
  const scale = extent > 1e-9 ? size / extent : 1;
  const middle = (levels.length - 1) / 2;
  const toModel = (p: PeekPoint): PeekPoint => ({
    x: (p.x - (minX + maxX) / 2) * scale,
    y: (stackHeight(levels, p.y) - middle) * gap,
    z: (p.z - (minZ + maxZ) / 2) * scale,
  });
  const floors: PeekFloor[] = levels.map((_, i) => ({ y: (i - middle) * gap, segments: [], places: [] }));
  const at: { [id: string]: PeekPoint } = Object.create(null);
  for (const n of map.nodes) {
    at[n.id] = n;
    if (isPlace(n)) floors[floorIndex(levels, n.y)].places.push({ id: n.id, at: toModel(n), group: placeGroup(n.category) });
  }
  const links: PeekPlaceModel["links"] = [];
  const closed: string[] = [];
  for (const e of map.edges) {
    const a = at[e.from], b = at[e.to];
    if (!a || !b) continue;
    if (e.open === false) closed.push(e.from + ">" + e.to);
    const from = floorIndex(levels, a.y), to = floorIndex(levels, b.y);
    if (from === to) floors[from].segments.push({ a: toModel(a), b: toModel(b) });
    else links.push({ a: toModel(a), b: toModel(b), kind: e.kind, open: e.open !== false });
  }
  const line = route.map(toModel);
  return {
    scale,
    floors,
    links,
    route: line,
    you: toModel(user),
    target: line.length > 0 ? line[line.length - 1] : null,
    done: route.length > 0 ? peekModel(route, user).done : 0,
    current: floorIndex(levels, user.y),
    key: size + ":" + gap + ":" + map.nodes.length + ":" + map.edges.length + ":" + levels.join(",") + ":" + (map.nodes.length > 0 ? map.nodes[0].id : "") + ":" + closed.join(","),
  };
}

// The "You are here" board: one floor drawn flat, north up, centred, in the units of width/height.
export interface BoardModel {
  paths: { a: { x: number; y: number }; b: { x: number; y: number } }[];
  places: { id: string; at: { x: number; y: number }; group: PlaceGroup }[];
  you: { x: number; y: number };
}

export function boardModel(map: PlaceMap, startId: string, width: number, height: number): BoardModel | null {
  const start = map.nodes.filter((n) => n.id === startId)[0];
  if (!start) return null;
  const ns = map.nodes.filter((n) => Math.abs(n.y - start.y) < SAME_FLOOR);
  const xs = ns.map((n) => n.x), zs = ns.map((n) => n.z);
  const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  const minZ = Math.min.apply(null, zs), maxZ = Math.max.apply(null, zs);
  const k = Math.min(width / Math.max(1, maxX - minX), height / Math.max(1, maxZ - minZ));
  const spot = (n: PeekPoint) => ({ x: (n.x - (minX + maxX) / 2) * k, y: (n.z - (minZ + maxZ) / 2) * k });
  const on: { [id: string]: PeekPoint } = Object.create(null);
  for (const n of ns) on[n.id] = n;
  const paths: BoardModel["paths"] = [];
  for (const e of map.edges) {
    const a = on[e.from], b = on[e.to];
    if (a && b && (a.x !== b.x || a.z !== b.z)) paths.push({ a: spot(a), b: spot(b) });
  }
  return {
    paths,
    places: ns.filter(isPlace).map((n) => ({ id: n.id, at: spot(n), group: placeGroup(n.category) })),
    you: spot(start),
  };
}
