// Tour mode and "Pick a place on a map" for "Find Your Way Inside".
// - Tour: after scanning "You are here" the companion walks you through the places that match
//   your preferences, one after the other, in the shortest order (MultiStopTrip does the guiding).
// - Pick on a map: the no-voice fallback to "Where to?". A flat map of the current floor with one
//   dot per destination, gate or place; tapping a dot picks it.
// Neither reads or changes the route; sponsored places are never favoured or dropped.
// Plain TypeScript with no imports (the Lens keeps a byte-identical copy at
// Assets/Scripts/FindYourWayTour.ts): the ordering function (trip.ts's orderStops) and the
// distance between two nodes are injected, like trip.ts does for the distance.
//
// Map metres: x east, y up, z north. Panel centimetres: x right, y up (north is up), origin at
// the middle of the panel.

export interface TourNode {
  id: string;
  kind: string;
  x: number;
  y: number;
  z: number;
  label?: string;
  category?: string;
}

export interface TourMap {
  nodes: TourNode[];
  place?: { levels?: { y: number; name: string; floor?: number }[] };
}

export type TourDistance = (from: string, to: string) => number;
export type TourOrder = (start: string, stops: string[], dist: TourDistance) => string[];

// The same as trip.ts's MAX_EXACT_STOPS (a test keeps them equal): the most stops a tour has.
export const TOUR_MAX_STOPS = 6;

// A node is on the tour when it is a place whose category is one of the picks (the same rule as
// free walk's shop matching). Sponsored is not looked at.
function matches(n: TourNode, prefs: string[]): boolean {
  return n.kind === "place" && typeof n.category === "string" && prefs.indexOf(n.category) >= 0;
}

// The tour from startId: matching places that can be reached (finite distance), not the start
// itself. More than TOUR_MAX_STOPS keeps the nearest ones; `order` (orderStops) then puts them in
// the order with the shortest walk, so the result goes straight into new MultiStopTrip(stops).
// No matches gives an empty list.
export function tourStops(map: TourMap, startId: string, prefs: string[], dist: TourDistance, order: TourOrder): string[] {
  const found: { id: string; d: number }[] = [];
  for (const n of map.nodes) {
    if (!matches(n, prefs) || n.id === startId) continue;
    const d = dist(startId, n.id);
    if (typeof d !== "number" || isNaN(d) || d === Infinity) continue;
    found.push({ id: n.id, d });
  }
  if (found.length === 0) return [];
  // Stable sort on distance: ties keep the map's order.
  const nearest = found
    .map((f, i) => ({ f, i }))
    .sort((a, b) => a.f.d - b.f.d || a.i - b.i)
    .slice(0, TOUR_MAX_STOPS)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.f.id);
  return order(startId, nearest, dist);
}

// ── Pick a place on a map ────────────────────────────────────────────────────

export interface MapDot {
  id: string;
  label: string;
  x: number; // panel cm
  y: number; // panel cm
}

// No two dots are closer than this (cm), so each can be tapped.
export const MAP_DOT_MIN_CM = 3;

const SAME_FLOOR_M = 0.5; // nodes within this of y are on that floor

function pickable(n: TourNode): boolean {
  return (n.kind === "place" || n.kind === "destination" || n.kind === "gate") && typeof n.label === "string" && n.label !== "";
}

// Dots for the pickable nodes on floor y, centred in a widthCm x heightCm panel, scaled by one
// factor on both axes (the shape of the floor is kept), never closer than marginCm to an edge,
// and nudged apart (deterministically) until no two are closer than MAP_DOT_MIN_CM. In the order
// of the map's nodes.
export function pickMapLayout(map: TourMap, y: number, widthCm: number, heightCm: number, marginCm: number): MapDot[] {
  const nodes = map.nodes.filter((n) => pickable(n) && Math.abs(n.y - y) < SAME_FLOOR_M);
  if (nodes.length === 0) return [];
  const halfW = Math.max(0, widthCm / 2 - marginCm);
  const halfH = Math.max(0, heightCm / 2 - marginCm);

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minZ = Math.min(minZ, n.z);
    maxZ = Math.max(maxZ, n.z);
  }
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  // One scale for both axes; a zero span on an axis does not limit it (and a single point, or a
  // line, has no scale to find: 1 is used and the dots are then only centred).
  let scale = Infinity;
  if (spanX > 1e-9) scale = Math.min(scale, (2 * halfW) / spanX);
  if (spanZ > 1e-9) scale = Math.min(scale, (2 * halfH) / spanZ);
  if (scale === Infinity) scale = 1;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  const pts = nodes.map((n) => ({ x: (n.x - cx) * scale, y: (n.z - cz) * scale }));
  separate(pts, halfW, halfH);
  return nodes.map((n, i) => ({ id: n.id, label: n.label as string, x: pts[i].x, y: pts[i].y }));
}

const MAX_SEPARATE_PASSES = 500;
const MAX_SEPARATE_PAIRS = 500000;

// Pushes close dots apart, each pair half the shortfall (plus a hair), then back inside the box;
// repeated until nothing is too close (or the box is too small for that). Dots on exactly the same
// spot are pushed in different fixed directions by their order, so the result never varies.
function separate(pts: { x: number; y: number }[], halfW: number, halfH: number): void {
  const need = MAP_DOT_MIN_CM + 1e-6;
  // Each pass compares every pair, so a crowded map gets fewer passes: one frame's work at most.
  const passes = Math.min(MAX_SEPARATE_PASSES, Math.floor((2 * MAX_SEPARATE_PAIRS) / Math.max(1, pts.length * pts.length)));
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        let dx = pts[j].x - pts[i].x;
        let dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy);
        if (d >= need) continue;
        if (d < 1e-9) {
          const a = ((j - i) * 2.399963229728653) % (2 * Math.PI); // the golden angle spreads them
          dx = Math.cos(a);
          dy = Math.sin(a);
        }
        const len = Math.hypot(dx, dy);
        const push = (need - d) / 2;
        const ux = dx / len;
        const uy = dy / len;
        pts[i].x -= ux * push;
        pts[i].y -= uy * push;
        pts[j].x += ux * push;
        pts[j].y += uy * push;
        moved = true;
      }
    }
    for (const p of pts) {
      p.x = Math.max(-halfW, Math.min(halfW, p.x));
      p.y = Math.max(-halfH, Math.min(halfH, p.y));
    }
    if (!moved) return;
  }
}

// ── Floors ───────────────────────────────────────────────────────────────────

export interface MapLevel {
  y: number;
  label: string;
  floor: number;
}

// The floors for the panel's floor switch, lowest first: the map's place.levels
// ({y, name, floor}), or, if it has none, the distinct heights of its nodes ("Level 1", ...).
export function mapLevels(map: TourMap): MapLevel[] {
  const given = map.place && map.place.levels;
  if (given && given.length > 0) {
    return given
      .slice()
      .sort((a, b) => a.y - b.y)
      .map((l, i) => ({ y: l.y, label: l.name, floor: typeof l.floor === "number" ? l.floor : i }));
  }
  const ys: number[] = [];
  for (const y of map.nodes.map((n) => n.y).sort((a, b) => a - b)) {
    if (ys.every((o) => Math.abs(o - y) >= SAME_FLOOR_M)) ys.push(y);
  }
  return ys.map((y, i) => ({ y, label: "Level " + (i + 1), floor: i }));
}
