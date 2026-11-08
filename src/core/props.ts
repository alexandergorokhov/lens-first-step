// Dressing the stand-in places with props (CC0 models from Quaternius, Kenney and others, in
// Assets/Models/Props): plants and racks beside the shop fronts, seats and screens at the gates, palms,
// benches and bins in open floor, an info board by the entrance. Pure logic shared by the Lens and
// the Node tests: no imports and no Lens globals; the Lens keeps a byte-identical copy at
// Assets/Scripts/FindYourWayProps.ts. Never on a walkway: you walk where the map's edges go.
// Map metres: x east, y up, z north. Headings: degrees clockwise from north (0 = facing north).

export interface PropXYZ { x: number; y: number; z: number }
export interface PropNode extends PropXYZ { id: string; kind: string; category?: string; icon?: string; type?: string }
export interface PropEdge { from: string; to: string; kind: string }
export interface PropMap {
  nodes: PropNode[];
  edges: PropEdge[];
  place?: { footprint?: { minX: number; maxX: number; minZ: number; maxZ: number }; start?: string };
}
export interface PropFront extends PropXYZ { facing: { x: number; z: number } }

// One prop to stand: which model, where (map m), its heading and its height in metres.
// mountM: hung on the wall this high above the floor (the screens).
export interface Prop { model: string; x: number; y: number; z: number; heading: number; heightM: number; liftM?: number; mountM?: number }

// Each model's own height (m, as downloaded) and how tall it should stand here (m). The Lens scales
// by the ratio. liftM: the model's pivot is this far above its lowest point.
export const PROP_MODELS: { [model: string]: { rawM: number; heightM: number; liftM?: number } } = {
  plant_1: { rawM: 0.928, heightM: 1.15 },
  plant_2: { rawM: 0.882, heightM: 0.95 },
  bench: { rawM: 0.316, heightM: 0.75 },
  palm_tree: { rawM: 3.587, heightM: 3.3 },
  trash_bin: { rawM: 0.712, heightM: 0.95 },
  clothes_rack: { rawM: 0.77, heightM: 1.75 },
  shopping_bag: { rawM: 0.6, heightM: 0.45 },
  floor_lamp: { rawM: 1.603, heightM: 1.8 },
  airport_seat: { rawM: 0.4, heightM: 0.85 },
  suitcase: { rawM: 0.501, heightM: 0.7 },
  luggage_bag: { rawM: 0.627, heightM: 0.5, liftM: 0.314 },
  departure_screen: { rawM: 0.455, heightM: 0.95 },
  info_sign: { rawM: 1.032, heightM: 1.2 },
  vending_fridge: { rawM: 4.385, heightM: 1.95 },
};

const KEEP_OFF_PATH_M = 1.1; // never this close to a walkway's centre line
const OPEN_FROM_PATH_M = 2.4; // open-floor props stand at least this far from the walkways
const APART_M = 1.8; // props at least this far apart
const NODE_CLEAR_M = 1.6; // and this far from any node (doors, lifts, signs)
const SHOP_SIDE_M = 3.3; // beside a shop front: past its half width
const SHOP_OUT_M = 0.9; // a little out into the hall from the front
const SAME_FLOOR_M = 0.6;
const OPEN_STEP_M = 2;
const OPEN_MAX = 10;

// The walkways as segments, worked out once per map (the Lens runs this at every restart).
interface Seg { ax: number; az: number; dx: number; dz: number; len2: number; ya: number; yb: number }
let segCache: { map: PropMap; segs: Seg[] } | null = null;
function segmentsOf(map: PropMap): Seg[] {
  if (segCache && segCache.map === map) return segCache.segs;
  const byId: { [id: string]: PropNode } = {};
  for (const n of map.nodes) byId[n.id] = n;
  const segs: Seg[] = [];
  for (const e of map.edges) {
    const a = byId[e.from], b = byId[e.to];
    if (!a || !b) continue;
    const dx = b.x - a.x, dz = b.z - a.z;
    segs.push({ ax: a.x, az: a.z, dx, dz, len2: dx * dx + dz * dz, ya: a.y, yb: b.y });
  }
  segCache = { map, segs };
  return segs;
}

function pathDistance(map: PropMap, p: PropXYZ): number {
  let best = Infinity;
  for (const s of segmentsOf(map)) {
    if (Math.abs(s.ya - p.y) > SAME_FLOOR_M && Math.abs(s.yb - p.y) > SAME_FLOOR_M) continue;
    const t = s.len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - s.ax) * s.dx + (p.z - s.az) * s.dz) / s.len2));
    const d = Math.hypot(p.x - s.ax - s.dx * t, p.z - s.az - s.dz * t);
    if (d < best) best = d;
  }
  return best;
}

function headingOf(d: { x: number; z: number }): number {
  return Math.round((Math.atan2(d.x, d.z) * 180) / Math.PI * 1000) / 1000;
}

// The props for a map: kit "airport" or "mall" (anything else: none). clear(p): you could stand at p
// (geometry's isClear); front(id): the drawn shop front of a place (freewalk's shopFrontPose).
export function propPlan(map: PropMap, kit: string, clear: (p: PropXYZ) => boolean, front: (id: string) => PropFront | null): Prop[] {
  if (kit !== "airport" && kit !== "mall") return [];
  const out: Prop[] = [];
  const fp = map.place && map.place.footprint;
  const ok = (p: PropXYZ, fromPath: number): boolean => {
    if (fp && (p.x < fp.minX + 0.5 || p.x > fp.maxX - 0.5 || p.z < fp.minZ + 0.5 || p.z > fp.maxZ - 0.5)) return false;
    if (pathDistance(map, p) < fromPath) return false;
    for (const n of map.nodes) if (Math.abs(n.y - p.y) < SAME_FLOOR_M && Math.hypot(n.x - p.x, n.z - p.z) < NODE_CLEAR_M) return false;
    for (const q of out) if (Math.abs(q.y - p.y) < SAME_FLOOR_M && Math.hypot(q.x - p.x, q.z - p.z) < APART_M) return false;
    return clear(p);
  };
  const add = (model: string, p: PropXYZ, heading: number): boolean => {
    const m = PROP_MODELS[model];
    out.push({ model, x: p.x, y: p.y, z: p.z, heading, heightM: m.heightM, liftM: m.liftM });
    return true;
  };

  // The entrance: an info board beside the sign.
  const sign = map.nodes.filter((n) => n.id === (map.place && map.place.start) || n.kind === "sign")[0];
  if (sign) {
    for (const dx of [2.2, -2.2, 3.2, -3.2]) {
      const p = { x: sign.x + dx, y: sign.y, z: sign.z + 1.2 };
      if (ok(p, KEEP_OFF_PATH_M)) { add("info_sign", p, 0); break; }
    }
  }

  // Beside each shop front, one side, alternating; at the gates, seats facing the gate and a screen.
  let i = 0;
  for (const n of map.nodes) {
    if (n.kind !== "place" && n.kind !== "destination") continue;
    const f = front(n.id);
    if (!f) continue;
    const t = { x: -f.facing.z, z: f.facing.x };
    const gate = n.type === "gate" || n.icon === "flight";
    if (kit === "airport" && gate) {
      // Two seats in a row, out in front of the gate, facing it; the screen beside the door.
      for (const s of [1, -1]) {
        const p = { x: f.x + f.facing.x * 3 + t.x * s * 2.2, y: f.y, z: f.z + f.facing.z * 3 + t.z * s * 2.2 };
        if (ok(p, KEEP_OFF_PATH_M)) add("airport_seat", p, headingOf({ x: -f.facing.x, z: -f.facing.z }));
      }
      // On the wall beside the gate door, above head height.
      const scr = { x: f.x + f.facing.x * 0.15 + t.x * 2.4, y: f.y, z: f.z + f.facing.z * 0.15 + t.z * 2.4 };
      if (pathDistance(map, scr) >= 0.7) {
        add("departure_screen", scr, headingOf(f.facing));
        out[out.length - 1].mountM = 2.1;
      }
      i++;
      continue;
    }
    const side = i % 2 === 0 ? 1 : -1;
    i++;
    const model = n.category === "clothes" ? "clothes_rack"
      : kit === "airport" ? (i % 3 === 0 ? "suitcase" : "plant_1")
      : ["plant_1", "floor_lamp", "plant_2", "plant_1"][i % 4];
    for (const s of [side, -side]) {
      const p = { x: f.x + f.facing.x * SHOP_OUT_M + t.x * s * SHOP_SIDE_M, y: f.y, z: f.z + f.facing.z * SHOP_OUT_M + t.z * s * SHOP_SIDE_M };
      if (ok(p, KEEP_OFF_PATH_M)) { add(model, p, headingOf(f.facing)); break; }
    }
  }

  // Open floor: the spots furthest from the walkways and each other, per floor.
  if (fp) {
    const floors: number[] = [];
    for (const n of map.nodes) if (floors.every((y) => Math.abs(y - n.y) > SAME_FLOOR_M)) floors.push(n.y);
    floors.sort((a, b) => a - b);
    const kitOpen = kit === "airport"
      ? ["palm_tree", "airport_seat", "luggage_bag", "vending_fridge", "trash_bin", "suitcase"]
      : ["palm_tree", "bench", "trash_bin", "plant_2", "vending_fridge", "bench", "shopping_bag"];
    let k = 0;
    for (const y of floors) {
      const cands: PropXYZ[] = [];
      for (let x = fp.minX + 1.5; x <= fp.maxX - 1.5; x += OPEN_STEP_M) {
        for (let z = fp.minZ + 1.5; z <= fp.maxZ - 1.5; z += OPEN_STEP_M) {
          const p = { x, y, z };
          const d = pathDistance(map, p);
          if (d >= OPEN_FROM_PATH_M && d < 6) cands.push(p);
        }
      }
      let placed = 0;
      while (placed < OPEN_MAX / floors.length + 1 && cands.length > 0) {
        // Farthest from what is already there (deterministic: first best wins).
        let best = -1, bestD = -1;
        for (let c = 0; c < cands.length; c++) {
          let d = 50;
          for (const q of out) if (Math.abs(q.y - y) < SAME_FLOOR_M) d = Math.min(d, Math.hypot(q.x - cands[c].x, q.z - cands[c].z));
          if (d > bestD) { bestD = d; best = c; }
        }
        const p = cands.splice(best, 1)[0];
        if (bestD < 4) break;
        if (!ok(p, OPEN_FROM_PATH_M)) continue;
        const model = kitOpen[k % kitOpen.length];
        k++;
        // Face the nearest walkway's side: north or south, whichever way the path is.
        const north = pathDistance(map, { x: p.x, y: p.y, z: p.z + 1.5 }) < pathDistance(map, { x: p.x, y: p.y, z: p.z - 1.5 });
        add(model, p, north ? 0 : 180);
        placed++;
      }
    }
  }
  return out;
}

// ── A food court that looks like one (ROUND2.md R2-11, Alex's v3 review) ──────────────────────────
// Destinations with the "restaurant" icon get an open front (no glass): three food stalls with bright
// menu boards inside, and tables with chairs outside, to either side of the way in, so the approach
// (and the demo's walk, which stops 2.7 m out) never crosses them. Parts are boxes in cm on the front:
// side along the front (the Lens's `at` x), up from the floor, out toward the hall (+ outside).
export interface DressPart { part: "counter" | "board" | "table" | "leg" | "chair" | "back" | "stool" | "lamp"; side: number; up: number; out: number; w: number; h: number; d: number; tint: number }
// The way in is kept clear this far each side of the front's middle (cm).
export const DINING_AISLE_CM = 150;
export function foodHallParts(halfCm: number): DressPart[] {
  const out: DressPart[] = [];
  const stall = (2 * halfCm - 40) / 3;
  for (let i = 0; i < 3; i++) {
    const side = -halfCm + 20 + stall * (i + 0.5);
    out.push({ part: "counter", side, up: 52, out: -90, w: stall - 30, h: 104, d: 60, tint: i });
    // The menu board over each stall, below the fascia so it shows from the hall.
    out.push({ part: "board", side, up: 172, out: -118, w: stall - 50, h: 62, d: 5, tint: i });
    out.push({ part: "lamp", side, up: 140, out: -60, w: 26, h: 14, d: 26, tint: i });
    for (const k of [-1, 1]) out.push({ part: "stool", side: side + k * stall * 0.22, up: 33, out: -35, w: 30, h: 66, d: 30, tint: i });
  }
  // Tables for two under the awning, either side of the way in: a top on one leg, a chair each side.
  for (const s of [-1, 1]) {
    for (const side of [200, 320]) {
      const o = 90;
      out.push({ part: "table", side: s * side, up: 74, out: o, w: 66, h: 4, d: 66, tint: 0 });
      out.push({ part: "leg", side: s * side, up: 37, out: o, w: 8, h: 72, d: 8, tint: 0 });
      for (const c of [-1, 1]) {
        out.push({ part: "chair", side: s * side + c * 52, up: 45, out: o, w: 38, h: 5, d: 38, tint: 0 });
        out.push({ part: "back", side: s * side + c * 70, up: 68, out: o, w: 4, h: 42, d: 38, tint: 0 });
        out.push({ part: "leg", side: s * side + c * 52, up: 22, out: o, w: 6, h: 44, d: 6, tint: 0 });
      }
    }
  }
  return out;
}

// Which places get the dining dressing: the "restaurant" destinations (food court) and food places
// (the Bakery, demo 2's one-floor destination, R2-31).
export function foodPlace(n: { kind: string; icon?: string; category?: string }): boolean {
  return (n.kind === "destination" && n.icon === "restaurant") || (n.kind === "place" && n.category === "food");
}
export const dressedAsDining = foodPlace;

// A part's middle in map metres, given its front (x, y, z on the floor, facing into the hall).
export function partAt(front: PropFront, p: DressPart): PropXYZ {
  const f = front.facing;
  return { x: front.x + (f.z * p.side + f.x * p.out) / 100, y: front.y + p.up / 100, z: front.z + (-f.x * p.side + f.z * p.out) / 100 };
}
