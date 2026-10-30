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
