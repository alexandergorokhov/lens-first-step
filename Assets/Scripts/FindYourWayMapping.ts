// "Learn this place" (mapping mode): the traveller walks the place and pinches "Point here" at
// corners, doors, lifts and stairs; each point joins the previous one with the distance actually
// walked. One pinch tags the last stretch (stairs, lift, ramp...), another names the last point
// from a short list, and "next floor" marks a level change. The result is a map.json in the
// src/core/data format that parseMap accepts, so the normal Walk / Step-Free routing works on it.
// Pure logic shared by the Lens and the Node tests: no imports and no Lens globals (the Lens keeps
// a byte-identical, renamed copy, so the map types below are structural twins of router.ts's).
//
// Map metres: x east, y up, z north.

export interface MapPoint {
  x: number;
  y: number;
  z: number;
}

// The same shape as router.ts's MapNode / MapEdge / MapData (only the fields mapping writes).
export interface MappedNode {
  id: string;
  x: number;
  y: number;
  z: number;
  kind: string;
  label?: string;
  // Shops (kind "place"): marked by one pinch, named and given offers later in the map's JSON.
  category?: string;
  sponsored?: boolean;
  sponsorTag?: string;
  front?: { x1: number; z1: number; x2: number; z2: number };
  offer?: { text: string; price: string; image?: string }[];
}

// The connection kinds router.ts knows (its EdgeKind).
export type MappedEdgeKind = "walk" | "stairs" | "escalator" | "lift" | "ramp";

export interface MappedEdge {
  id: string;
  from: string;
  to: string;
  length: number;
  kind: MappedEdgeKind;
  open: boolean;
}

export interface MappedMap {
  version: number;
  name: string;
  units: string;
  nodes: MappedNode[];
  edges: MappedEdge[];
  place: { title: string; start?: string; levels: { y: number; name: string }[]; interests?: { id: string; label: string }[]; sayIt?: string };
}

// The names a point can get (the short list on the panel). Duplicates become "Room 2", "Room 3".
export const MAPPING_NAMES = ["Entrance sign", "Gate", "Room", "Toilet", "Lift", "Stairs", "Exit", "Café", "Shop"];
// What a stretch can be tagged as; "stepFree" is a plain walk (no steps).
export const MAPPING_TAGS = ["stairs", "lift", "ramp", "escalator", "walk", "stepFree"];
export type MappingTag = "stairs" | "lift" | "ramp" | "escalator" | "walk" | "stepFree";
// A point closer than this (m) to the previous one is a double pinch and ignored; one this close
// to any other point joins that point (closing a loop, e.g. back at the sign).
export const MIN_POINT_GAP = 0.5;
// A named point closer than this (m) is where you already are, not a place to be guided to.
export const NEAR_POINT = 3;
// Router limit on nodes in a map file (MAX_MAP_NODES).
export const MAX_POINTS = 2000;
export const DEFAULT_TITLE = "My place";
export const MAP_FORMAT_VERSION = 1;
// Two heights closer than this are the same level (router.ts SAME_LEVEL).
const SAME_LEVEL = 0.5;
const EDGE_KINDS: MappedEdgeKind[] = ["walk", "stairs", "escalator", "lift", "ramp"];
// Map builder defaults: samples every SAMPLE_GAP m, corners kept past
// CORNER_TOLERANCE m, crossings joined within JOIN_RADIUS m. A height change of FLOOR_RISE m held
// FLOOR_HOLD s starts a floor; heights within LEVEL_BAND m of a floor are on it. "Next floor"
// assumes MANUAL_FLOOR_RISE m. A shop's front is SHOP_WIDTH m wide, SHOP_AHEAD m ahead of you;
// marking within SHOP_REPLACE m of a shop replaces it.
export const SAMPLE_GAP = 0.5;
export const CORNER_TOLERANCE = 1;
export const JOIN_RADIUS = 1.5;
export const FLOOR_RISE = 1;
export const FLOOR_HOLD = 2;
export const LEVEL_BAND = 0.3;
export const MANUAL_FLOOR_RISE = 4;
export const SHOP_AHEAD = 1.5;
export const SHOP_WIDTH = 6;
export const SHOP_REPLACE = 2;
const SHOP_CATEGORY = "shop";
const SHOP_INTEREST = { id: SHOP_CATEGORY, label: "Shops" };
// A map goes through the log in lines this long at most (characters of map text).
export const LOG_CHUNK = 700;
const LOG_TAG = "[FYW-MAP]";

function d3(a: MapPoint, b: MapPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

// Millimetres are plenty for a walked map and keep the file short.
const mm = (v: number) => Math.round(v * 1000) / 1000 + 0;

// The trip right after saving, from where the traveller stands: start at the nearest point and go
// to the last named point that is further than NEAR_POINT away, else back to the sign.
export function tripAfterSaving(map: MappedMap, here: MapPoint): { start: string; destination: string } {
  let start = map.nodes[0];
  for (const n of map.nodes) if (d3(n, here) < d3(start, here)) start = n;
  const away = map.nodes.filter((n) => (n.kind === "destination" || n.kind === "place") && d3(n, here) > NEAR_POINT);
  return { start: start.id, destination: away.length > 0 ? away[away.length - 1].id : "sign" };
}

// One undoable step: the node it added (if new), the edge it added (if any), the level it
// started (if any) and the point that was last before it.
interface Step {
  node: string | null;
  edge: string | null;
  level: boolean;
  prevLast: string | null;
  // A shop that replaced an older mark: what to put back.
  replaced?: { node: MappedNode; edge: MappedEdge; index: number };
  // A crossing split an old stretch at step.node: the stretch to put back and where it was.
  split?: { edge: MappedEdge; index: number; a: string; b: string };
}

// Where a walk joins what is already mapped: a node, or a point on a stretch.
export interface MapJoin {
  node: string | null;
  edge: string | null;
  at: MapPoint;
}

function copyNode(n: MappedNode): MappedNode {
  const c: MappedNode = { id: n.id, x: n.x, y: n.y, z: n.z, kind: n.kind };
  if (n.label !== undefined) c.label = n.label;
  if (n.category !== undefined) c.category = n.category;
  if (n.sponsored !== undefined) c.sponsored = n.sponsored;
  if (n.sponsorTag !== undefined) c.sponsorTag = n.sponsorTag;
  if (n.front !== undefined) c.front = { x1: n.front.x1, z1: n.front.z1, x2: n.front.x2, z2: n.front.z2 };
  if (n.offer !== undefined) c.offer = n.offer.map((o) => ({ ...o }));
  return c;
}

export class MapRecorder {
  title: string;
  private nodes: MappedNode[] = [];
  private edges: MappedEdge[] = [];
  // Floor heights in the order they were mapped, with the node that started each.
  private levels: { y: number; node: string }[] = [];
  private history: Step[] = [];
  private last: string | null = null;
  private nextNode = 1;
  private nextEdge = 1;
  private nextShop = 1;
  private newFloor = false;
  // place fields a walk doesn't make: kept from a restored map.
  private interests: { id: string; label: string }[] | null = null;
  private sayIt: string | null = null;
  // Walking since the last point: distance so far and the previous feet sample.
  private walkedSum = 0;
  private lastFeet: MapPoint | null = null;

  constructor(title: string = DEFAULT_TITLE) {
    this.title = title || DEFAULT_TITLE;
  }

  private node(id: string | null): MappedNode | null {
    for (const n of this.nodes) if (n.id === id) return n;
    return null;
  }

  private resetWalk(at: MapPoint | null): void {
    this.walkedSum = 0;
    this.lastFeet = at ? { x: at.x, y: at.y, z: at.z } : null;
  }

  // The first point: the entrance sign, which is the map's start. Starts a fresh map.
  start(feet: MapPoint): void {
    this.nodes = [{ id: "sign", x: mm(feet.x), y: mm(feet.y), z: mm(feet.z), kind: "sign", label: "Entrance sign" }];
    this.edges = [];
    this.levels = [{ y: mm(feet.y), node: "sign" }];
    this.history = [{ node: "sign", edge: null, level: true, prevLast: null }];
    this.last = "sign";
    this.nextNode = 1;
    this.nextEdge = 1;
    this.nextShop = 1;
    this.newFloor = false;
    this.resetWalk(feet);
  }

  // Call every frame with the feet position while mapping: adds up the distance walked.
  walked(feet: MapPoint): void {
    if (this.last === null) return;
    if (this.lastFeet) this.walkedSum += d3(this.lastFeet, feet);
    this.lastFeet = { x: feet.x, y: feet.y, z: feet.z };
  }

  // The next point is on another level (pinch before or after riding / climbing).
  nextFloor(): void {
    if (this.last !== null) this.newFloor = true;
  }

  // "Point here": a node at the feet joined to the previous point by a walk edge as long as the
  // distance walked (never shorter than the straight line). Returns the point's id, or null when
  // ignored (not started, under MIN_POINT_GAP from the previous point, or the map is full). Within
  // MIN_POINT_GAP of another existing point it joins that point instead of adding one.
  pointHere(feet: MapPoint): string | null {
    const prev = this.node(this.last);
    if (!prev) return null;
    const at = { x: mm(feet.x), y: mm(feet.y), z: mm(feet.z) };
    if (d3(prev, at) < MIN_POINT_GAP) return null;
    let target: MappedNode | null = null;
    for (const n of this.nodes) if (n.id !== prev.id && d3(n, at) < MIN_POINT_GAP && (!target || d3(n, at) < d3(target, at))) target = n;
    if (!target && this.nodes.length >= MAX_POINTS) return null;
    let isNew = false;
    let level = false;
    if (!target) {
      target = { id: "p" + this.nextNode++, x: at.x, y: at.y, z: at.z, kind: "junction" };
      this.nodes.push(target);
      isNew = true;
      if (this.newFloor && this.levels.every((l) => Math.abs(l.y - at.y) >= SAME_LEVEL)) {
        this.levels.push({ y: at.y, node: target.id });
        level = true;
      }
    }
    // Rounded up to the millimetre so the edge never ends up shorter than the straight line.
    const length = Math.ceil(Math.max(this.walkedSum, d3(prev, target)) * 1000 - 1e-6) / 1000;
    const edge: MappedEdge = { id: "e" + this.nextEdge++, from: prev.id, to: target.id, length, kind: "walk", open: true };
    this.edges.push(edge);
    this.history.push({ node: isNew ? target.id : null, edge: edge.id, level, prevLast: prev.id });
    this.last = target.id;
    this.newFloor = false;
    this.resetWalk(target);
    return target.id;
  }

  // The point the next stretch leaves from, or null before start.
  lastPoint(): MapPoint | null {
    const n = this.node(this.last);
    return n ? { x: n.x, y: n.y, z: n.z } : null;
  }

  // The stretch of the last step, or null.
  lastEdgeId(): string | null {
    const step = this.history.length > 0 ? this.history[this.history.length - 1] : null;
    return step ? step.edge : null;
  }

  hasEdge(id: string): boolean {
    return this.edges.some((e) => e.id === id);
  }

  stepCount(): number {
    return this.history.length;
  }

  canUndo(): boolean {
    return this.history.length > 1;
  }

  // Like pointHere, for a point the walk tracer picked: lengthM is the distance walked to it.
  pointAt(p: MapPoint, lengthM: number): string | null {
    this.walkedSum = lengthM;
    return this.pointHere(p);
  }

  // What the walk joins at p, within radius m on the same level: the nearest other junction, else
  // a stretch that doesn't touch the last point. Shops and their stubs are never joined.
  nearJoin(p: MapPoint, radius: number): MapJoin | null {
    const prev = this.node(this.last);
    if (!prev || d3(prev, p) < radius) return null;
    const level = (n: MappedNode) => Math.abs(n.y - p.y) < SAME_LEVEL;
    let bestNode: MappedNode | null = null;
    for (const n of this.nodes) {
      if (n.id === prev.id || n.kind === "place" || !level(n) || d3(n, p) >= radius) continue;
      if (!bestNode || d3(n, p) < d3(bestNode, p)) bestNode = n;
    }
    if (bestNode) return { node: bestNode.id, edge: null, at: { x: bestNode.x, y: bestNode.y, z: bestNode.z } };
    let best: MapJoin | null = null;
    let bestD = radius;
    for (const e of this.edges) {
      const a = this.node(e.from);
      const b = this.node(e.to);
      if (!a || !b || e.kind !== "walk" || e.from === prev.id || e.to === prev.id) continue;
      if (a.kind === "place" || b.kind === "place" || !level(a) || !level(b)) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      if (len2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
      const at = { x: mm(a.x + dx * t), y: a.y, z: mm(a.z + dz * t) };
      const d = d3(at, { x: p.x, y: a.y, z: p.z });
      if (d < bestD) {
        bestD = d;
        best = { node: null, edge: e.id, at };
      }
    }
    return best;
  }

  // Ends the walk's stretch at a join (splitting the stretch it crosses); returns the node joined.
  join(j: MapJoin, lengthM: number): string | null {
    const prev = this.node(this.last);
    if (!prev) return null;
    let id = j.node;
    if (id === null) {
      if (this.nodes.length >= MAX_POINTS) return null;
      const index = this.edges.findIndex((e) => e.id === j.edge);
      if (index < 0) return null;
      const old = this.edges[index];
      const a = this.node(old.from) as MappedNode;
      const mid: MappedNode = { id: "p" + this.nextNode++, x: j.at.x, y: j.at.y, z: j.at.z, kind: "junction" };
      this.nodes.push(mid);
      const part = (from: MappedNode, to: string, len: number): MappedEdge => ({ id: "e" + this.nextEdge++, from: from.id, to, length: len, kind: old.kind, open: old.open });
      const toMid = Math.ceil(d3(a, mid) * 1000 - 1e-6) / 1000;
      const e1 = part(a, mid.id, Math.max(toMid, 0.001));
      const e2 = part(mid, old.to, Math.max(old.length - toMid, Math.ceil(d3(mid, this.node(old.to) as MappedNode) * 1000 - 1e-6) / 1000, 0.001));
      this.edges.splice(index, 1, e1, e2);
      this.history.push({ node: mid.id, edge: null, level: false, prevLast: prev.id, split: { edge: old, index, a: e1.id, b: e2.id } });
      id = mid.id;
    }
    const target = this.node(id) as MappedNode;
    let edge: string | null = null;
    if (!this.edges.some((e) => (e.from === prev.id && e.to === id) || (e.to === prev.id && e.from === id))) {
      const length = Math.ceil(Math.max(lengthM, d3(prev, target)) * 1000 - 1e-6) / 1000;
      edge = "e" + this.nextEdge++;
      this.edges.push({ id: edge, from: prev.id, to: id, length, kind: "walk", open: true });
    }
    this.history.push({ node: null, edge, level: false, prevLast: prev.id });
    this.last = id;
    this.newFloor = false;
    this.resetWalk(target);
    return id;
  }

  // "Mark shop": a shop node and its front SHOP_AHEAD m ahead of feet, SHOP_WIDTH m wide, square to
  // the facing direction, joined to the last point by a stub. Within SHOP_REPLACE m of a shop it
  // replaces that shop, keeping its id and name. The walk goes on from the last point.
  markShop(feet: MapPoint, headingDeg: number): { id: string; label: string; replaced: boolean } | null {
    const from = this.node(this.last);
    if (!from) return null;
    const r = (headingDeg * Math.PI) / 180;
    const d = { x: Math.sin(r), z: Math.cos(r) };
    const right = { x: Math.cos(r), z: -Math.sin(r) };
    const at = { x: mm(feet.x + d.x * SHOP_AHEAD), y: mm(feet.y), z: mm(feet.z + d.z * SHOP_AHEAD) };
    const half = SHOP_WIDTH / 2;
    const front = { x1: mm(at.x - right.x * half), z1: mm(at.z - right.z * half), x2: mm(at.x + right.x * half), z2: mm(at.z + right.z * half) };
    let old: MappedNode | null = null;
    for (const n of this.nodes) {
      if (n.kind === "place" && Math.abs(n.y - at.y) < SAME_LEVEL && d3(n, at) <= SHOP_REPLACE && (!old || d3(n, at) < d3(old, at))) old = n;
    }
    const length = Math.ceil(Math.max(d3(from, at), 0.001) * 1000 - 1e-6) / 1000;
    const edge: MappedEdge = { id: "e" + this.nextEdge++, from: from.id, to: "", length, kind: "walk", open: true };
    if (old) {
      const oldId = old.id;
      const index = this.edges.findIndex((e) => e.from === oldId || e.to === oldId);
      const replaced = { node: copyNode(old), edge: this.edges[index], index };
      old.x = at.x;
      old.y = at.y;
      old.z = at.z;
      old.front = front;
      edge.to = old.id;
      if (index >= 0) this.edges.splice(index, 1);
      this.edges.push(edge);
      this.history.push({ node: null, edge: edge.id, level: false, prevLast: this.last, replaced });
      return { id: old.id, label: old.label || old.id, replaced: true };
    }
    if (this.nodes.length >= MAX_POINTS) return null;
    const n = this.nextShop++;
    const shop: MappedNode = { id: "shop" + n, x: at.x, y: at.y, z: at.z, kind: "place", label: "Shop " + n, category: SHOP_CATEGORY, front };
    edge.to = shop.id;
    this.nodes.push(shop);
    this.edges.push(edge);
    this.history.push({ node: shop.id, edge: edge.id, level: false, prevLast: this.last });
    return { id: shop.id, label: shop.label as string, replaced: false };
  }

  // Sets the kind of one stretch (the floor change confirmed later than its step).
  tagEdge(id: string, kind: MappedEdgeKind): boolean {
    for (const e of this.edges) {
      if (e.id === id) {
        e.kind = kind;
        return true;
      }
    }
    return false;
  }

  // Tags the last stretch: stairs / lift / ramp / escalator / walk ("stepFree" = walk). False when
  // there is no stretch yet or the tag is unknown.
  tagLast(kind: MappingTag): boolean {
    if (MAPPING_TAGS.indexOf(kind) < 0) return false;
    const step = this.history.length > 0 ? this.history[this.history.length - 1] : null;
    if (!step || step.edge === null) return false;
    for (const e of this.edges) if (e.id === step.edge) e.kind = kind === "stepFree" ? "walk" : kind;
    return true;
  }

  // Names the last point from MAPPING_NAMES; a taken name gets the next number ("Room 2").
  // Named points become destinations (the sign stays the sign). Returns the label, or null.
  name(label: string): string | null {
    const n = this.node(this.last);
    if (!n || MAPPING_NAMES.indexOf(label) < 0) return null;
    const taken = (l: string) => this.nodes.some((o) => o !== n && o.label === l);
    let out = label;
    for (let k = 2; taken(out); k++) out = label + " " + k;
    n.label = out;
    if (n.kind !== "sign") n.kind = "destination";
    return out;
  }

  // Removes the last point and its edge (or the last join's edge). False when the map is empty.
  undo(): boolean {
    const step = this.history.pop();
    if (!step) return false;
    if (step.edge !== null) this.edges = this.edges.filter((e) => e.id !== step.edge);
    if (step.split) {
      const { a, b, edge, index } = step.split;
      this.edges = this.edges.filter((e) => e.id !== a && e.id !== b);
      this.edges.splice(index, 0, edge);
    }
    if (step.replaced) {
      const back = step.replaced;
      this.nodes = this.nodes.map((n) => (n.id === back.node.id ? back.node : n));
      if (back.edge) this.edges.splice(back.index, 0, back.edge);
    }
    if (step.node !== null) {
      this.nodes = this.nodes.filter((n) => n.id !== step.node);
      this.levels = this.levels.filter((l) => l.node !== step.node);
    }
    this.last = step.prevLast;
    this.newFloor = false;
    this.resetWalk(this.node(this.last));
    return true;
  }

  // The map so far, in the src/core/data format (copies; changing them never changes the recorder).
  toMap(): MappedMap {
    const ys = this.levels.map((l) => l.y).sort((a, b) => a - b);
    const place: MappedMap["place"] = { title: this.title, levels: ys.map((y, i) => ({ y, name: "Floor " + i })) };
    if (this.node("sign")) place.start = "sign";
    const interests = (this.interests || []).map((i) => ({ id: i.id, label: i.label }));
    // Shops marked on the walk are this map's own interest, or nothing could ever pick them.
    if (this.nodes.some((n) => n.category === SHOP_CATEGORY) && !interests.some((i) => i.id === SHOP_CATEGORY)) interests.push(SHOP_INTEREST);
    if (interests.length > 0) place.interests = interests;
    if (this.sayIt) place.sayIt = this.sayIt;
    return {
      version: MAP_FORMAT_VERSION,
      name: this.title,
      units: "m",
      nodes: this.nodes.map(copyNode),
      edges: this.edges.map((e) => ({ id: e.id, from: e.from, to: e.to, length: e.length, kind: e.kind, open: e.open })),
      place,
    };
  }

  // The map as map.json text (save it to persistent storage).
  toJson(): string {
    return JSON.stringify(this.toMap(), null, 2);
  }

  // Resumes mapping from saved text (after a reload): the last point is where the last stretch
  // ended. Null when the text is not a mapping-mode map.
  static fromJson(text: string): MapRecorder | null {
    let raw: any;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return null;
    }
    if (!raw || typeof raw !== "object" || raw.version !== MAP_FORMAT_VERSION) return null;
    if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges) || raw.nodes.length === 0 || raw.nodes.length > MAX_POINTS) return null;
    const ids: { [id: string]: boolean } = Object.create(null);
    for (const n of raw.nodes) {
      if (!n || typeof n.id !== "string" || typeof n.kind !== "string" || ids[n.id] === true) return null;
      for (const k of ["x", "y", "z"]) if (typeof n[k] !== "number" || !isFinite(n[k])) return null;
      if (n.label !== undefined && typeof n.label !== "string") return null;
      if (n.front !== undefined && (!n.front || typeof n.front !== "object")) return null;
      if (n.offer !== undefined && !Array.isArray(n.offer)) return null;
      ids[n.id] = true;
    }
    if (ids["sign"] !== true) return null;
    for (const e of raw.edges) {
      if (!e || ids[e.from] !== true || ids[e.to] !== true || EDGE_KINDS.indexOf(e.kind) < 0) return null;
      if (typeof e.length !== "number" || !(e.length > 0) || !isFinite(e.length)) return null;
    }
    const place = raw.place && typeof raw.place === "object" ? raw.place : {};
    const rec = new MapRecorder(typeof place.title === "string" ? place.title : typeof raw.name === "string" ? raw.name : DEFAULT_TITLE);
    rec.nodes = raw.nodes.map(copyNode);
    if (Array.isArray(place.interests)) rec.interests = place.interests;
    if (typeof place.sayIt === "string") rec.sayIt = place.sayIt;
    rec.edges = raw.edges.map((e: any, i: number) => ({
      id: typeof e.id === "string" && e.id !== "" ? e.id : "e" + (i + 1),
      from: e.from,
      to: e.to,
      length: e.length,
      kind: e.kind,
      open: e.open !== false,
    }));
    // Fresh ids continue after the highest p<n> / e<n> already used.
    const after = (list: { id: string }[], prefix: string) => {
      let max = 0;
      for (const o of list) {
        const m = /^([a-z]+)(\d+)$/.exec(o.id);
        if (m && m[1] === prefix) max = Math.max(max, Number(m[2]));
      }
      return max + 1;
    };
    rec.nextNode = after(rec.nodes, "p");
    rec.nextEdge = after(rec.edges, "e");
    rec.nextShop = after(rec.nodes, "shop");
    // History: the sign, then each edge in order (adding its far node the first time it appears).
    const seen: { [id: string]: boolean } = Object.create(null);
    seen["sign"] = true;
    rec.history = [{ node: "sign", edge: null, level: false, prevLast: null }];
    let last = "sign";
    for (const e of rec.edges) {
      const isNew = seen[e.to] !== true;
      seen[e.to] = true;
      rec.history.push({ node: isNew ? e.to : null, edge: e.id, level: false, prevLast: e.from });
      // A shop's stub is a side step: the walk goes on from where the shop was marked.
      const to = rec.node(e.to);
      if (!to || to.kind !== "place") last = e.to;
    }
    rec.last = last;
    // Levels: each saved height belongs to the first mapped node at that height.
    const order = ["sign"].concat(rec.history.filter((s) => s.node !== null && s.node !== "sign").map((s) => s.node as string));
    const ys: number[] = Array.isArray(place.levels) ? place.levels.filter((l: any) => l && typeof l.y === "number").map((l: any) => l.y) : [];
    rec.levels = [];
    for (const y of ys) {
      let owner = "sign";
      for (const id of order) {
        const n = rec.node(id);
        if (n && Math.abs(n.y - y) < SAME_LEVEL) {
          owner = id;
          break;
        }
      }
      rec.levels.push({ y, node: owner });
    }
    rec.resetWalk(rec.node(last));
    return rec;
  }
}

// The floor-change kind a climb looks like: no walking = lift, gentle = ramp, an even speed =
// escalator, else stairs. jitter: how much the climbing speed varied (0 = steady).
export function guessConnection(from: MapPoint, to: MapPoint, seconds: number, jitter: number): MappedEdgeKind {
  const h = Math.sqrt((to.x - from.x) ** 2 + (to.z - from.z) ** 2);
  const rise = Math.abs(to.y - from.y);
  if (h < 1.5) return "lift";
  if (rise > 0 && h / rise >= 5) return "ramp";
  return seconds > 0 && jitter <= 0.15 ? "escalator" : "stairs";
}

function pathLength(from: MapPoint, pts: MapPoint[]): number {
  let sum = 0;
  let at = from;
  for (const p of pts) {
    sum += d3(at, p);
    at = p;
  }
  return sum;
}

// Map builder: turns the walk into points by itself. Call sample() every frame with the feet; it
// keeps a point every SAMPLE_GAP m, commits a corner when the stretch bends past CORNER_TOLERANCE,
// joins what is already mapped within JOIN_RADIUS, and starts a floor when the height holds.
export class WalkTracer {
  rec: MapRecorder;
  private pending: MapPoint[] = [];
  private lastSample: MapPoint | null = null;
  private lastOn: MapPoint | null = null;
  private base = 0;
  private yOffset = 0;
  // Manual floor rises, newest last: the step count after each, and the offset to go back to.
  private rises: { steps: number; offset: number }[] = [];
  private climb: { from: MapPoint; since: number; ys: { t: number; y: number }[] } | null = null;
  private holdY = 0;
  private holdSince = 0;
  private floor: { edge: string; guess: MappedEdgeKind } | null = null;

  constructor(rec: MapRecorder) {
    this.rec = rec;
  }

  private lift(p: MapPoint): MapPoint {
    return { x: mm(p.x), y: mm(p.y + this.yOffset), z: mm(p.z) };
  }

  start(feet: MapPoint, _now: number): void {
    this.rec.start(feet);
    this.pending = [];
    this.yOffset = 0;
    this.rises = [];
    this.climb = null;
    this.floor = null;
    this.lastSample = this.lastOn = this.lift(feet);
    this.base = this.lastOn.y;
  }

  // The guess waiting for its one-pinch confirmation, or null.
  // Metres added by "Next floor" so far: the height the tracking itself never saw.
  floorOffset(): number {
    return this.yOffset;
  }

  floorPending(): MappedEdgeKind | null {
    return this.floor ? this.floor.guess : null;
  }

  confirmFloor(kind?: MappedEdgeKind): boolean {
    if (!this.floor) return false;
    const ok = this.rec.tagEdge(this.floor.edge, kind || this.floor.guess);
    this.floor = null;
    return ok;
  }

  private anchor(): MapPoint {
    return this.rec.lastPoint() || (this.lastSample as MapPoint);
  }

  // Ends the current stretch at p.
  private flushTo(p: MapPoint): void {
    const from = this.anchor();
    this.rec.pointAt(p, pathLength(from, this.pending.concat([p])));
    this.pending = [];
    this.lastSample = p;
  }

  // A floor change is on the map as stairs until confirmed, so Step-Free never uses it.
  private startFloor(to: MapPoint, guess: MappedEdgeKind, lengthM: number): void {
    this.rec.nextFloor();
    if (this.rec.pointAt(to, lengthM) !== null) {
      const edge = this.rec.lastEdgeId() as string;
      this.rec.tagEdge(edge, "stairs");
      this.floor = { edge, guess };
    }
    this.base = to.y;
    this.lastSample = this.lastOn = to;
    this.climb = null;
  }

  private jitter(ys: { t: number; y: number }[]): number {
    const speeds: number[] = [];
    for (let i = 1; i < ys.length; i++) speeds.push(Math.abs(ys[i].y - ys[i - 1].y) / Math.max(ys[i].t - ys[i - 1].t, 1e-3));
    if (speeds.length < 2) return 1;
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    if (mean < 1e-6) return 1;
    return Math.sqrt(speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length) / mean;
  }

  sample(raw: MapPoint, now: number): void {
    if (!this.lastSample) return;
    const feet = this.lift(raw);
    const off = Math.abs(feet.y - this.base);
    if (off > LEVEL_BAND) {
      if (!this.climb) {
        this.climb = { from: this.lastOn as MapPoint, since: now, ys: [{ t: now, y: feet.y }] };
        this.holdY = feet.y;
        this.holdSince = now;
      }
      const ys = this.climb.ys;
      if (now - ys[ys.length - 1].t >= 0.5) ys.push({ t: now, y: feet.y });
      if (Math.abs(feet.y - this.holdY) > LEVEL_BAND) {
        this.holdY = feet.y;
        this.holdSince = now;
      }
      if (off >= FLOOR_RISE && now - this.holdSince >= FLOOR_HOLD) {
        const from = this.climb.from;
        const seconds = this.holdSince - this.climb.since;
        // Steady over the climb itself: the samples while it holds at the top don't count.
        const guess = guessConnection(from, feet, seconds, this.jitter(ys.filter((y) => y.t <= this.holdSince)));
        this.flushTo(from);
        this.startFloor(feet, guess, d3(from, feet));
      }
      return;
    }
    this.climb = null;
    this.lastOn = feet;
    if (d3(feet, this.lastSample) < SAMPLE_GAP) return;
    this.pending.push(feet);
    this.lastSample = feet;
    const j = this.rec.nearJoin(feet, JOIN_RADIUS);
    if (j) {
      this.rec.join(j, pathLength(this.anchor(), this.pending));
      this.pending = [];
      return;
    }
    this.corner(feet);
  }

  // Commits the sample furthest from the straight line, once it is past the tolerance.
  private corner(feet: MapPoint): void {
    const a = this.anchor();
    const dx = feet.x - a.x;
    const dz = feet.z - a.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 1e-6) return;
    let worst = -1;
    let worstD = CORNER_TOLERANCE;
    for (let i = 0; i < this.pending.length; i++) {
      const p = this.pending[i];
      const d = Math.abs((p.x - a.x) * dz - (p.z - a.z) * dx) / len;
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst < 0) return;
    this.rec.pointAt(this.pending[worst], pathLength(a, this.pending.slice(0, worst + 1)));
    this.pending = this.pending.slice(worst + 1);
  }

  // "Next floor": the manual fallback when the height doesn't change (a lift on real Specs). The
  // next points count as a floor up; the guess is a lift.
  nextFloor(raw: MapPoint, _now: number): boolean {
    if (!this.lastSample) return false;
    this.flushTo(this.lift(raw));
    const offset = this.yOffset;
    this.yOffset += MANUAL_FLOOR_RISE;
    this.startFloor(this.lift(raw), "lift", MANUAL_FLOOR_RISE);
    this.rises.push({ steps: this.rec.stepCount(), offset });
    return true;
  }

  markShop(raw: MapPoint, headingDeg: number): { id: string; label: string; replaced: boolean } | null {
    if (!this.lastSample) return null;
    const feet = this.lift(raw);
    this.flushTo(feet);
    return this.rec.markShop(feet, headingDeg);
  }

  finish(raw: MapPoint): void {
    if (this.lastSample) this.flushTo(this.lift(raw));
  }

  // Removes the last point (the entrance sign stays).
  undo(): boolean {
    if (!this.rec.canUndo()) return false;
    this.rec.undo();
    while (this.rises.length > 0 && this.rises[this.rises.length - 1].steps > this.rec.stepCount()) {
      this.yOffset = (this.rises.pop() as { offset: number }).offset;
    }
    const at = this.rec.lastPoint() as MapPoint;
    this.pending = [];
    this.climb = null;
    this.lastSample = this.lastOn = at;
    this.base = at.y;
    if (this.floor && !this.rec.hasEdge(this.floor.edge)) this.floor = null;
    return true;
  }
}

function checksum(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}

// Upload: a Lens must not hold a git token, so the map goes through the log between markers.
// tools/map-publish.mjs reads it back with parseMapLog.
export function mapLogLines(text: string, name: string): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += LOG_CHUNK) parts.push(text.slice(i, i + LOG_CHUNK).replace(/\\/g, "\\\\").replace(/\n/g, "\\n"));
  const out = [LOG_TAG + " BEGIN " + name + " " + parts.length + " " + checksum(text)];
  for (let i = 0; i < parts.length; i++) out.push(LOG_TAG + " " + i + " " + parts[i]);
  out.push(LOG_TAG + " END");
  return out;
}

// The last map block in a log: null when there is none; throws when it was cut off or changed.
export function parseMapLog(log: string): { name: string; text: string } | null {
  let found: { name: string; count: number; sum: string; parts: { [i: number]: string } } | null = null;
  for (const raw of log.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const at = line.indexOf(LOG_TAG + " ");
    if (at < 0) continue;
    const body = line.slice(at + LOG_TAG.length + 1);
    if (body.indexOf("BEGIN ") === 0) {
      const f = body.split(" ");
      found = { name: f[1], count: Number(f[2]), sum: f[3], parts: {} };
      continue;
    }
    const m = /^(\d+) ([\s\S]*)$/.exec(body);
    if (m && found) found.parts[Number(m[1])] = m[2];
  }
  if (!found) return null;
  let text = "";
  for (let i = 0; i < found.count; i++) {
    if (found.parts[i] === undefined) throw new Error("map block in the log: part " + i + " of " + found.count + " is missing (cut off?)");
    text += found.parts[i].replace(/\\(.)/g, (_, c) => (c === "n" ? "\n" : c));
  }
  if (checksum(text) !== found.sum) throw new Error("map block in the log: checksum differs (cut off or changed)");
  return { name: found.name, text };
}
