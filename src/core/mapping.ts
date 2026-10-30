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
  place: { title: string; start?: string; levels: { y: number; name: string }[] };
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

function d3(a: MapPoint, b: MapPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

// Millimetres are plenty for a walked map and keep the file short.
const mm = (v: number) => Math.round(v * 1000) / 1000;

// The trip right after saving, from where the traveller stands: start at the nearest point and go
// to the last named point that is further than NEAR_POINT away, else back to the sign.
export function tripAfterSaving(map: MappedMap, here: MapPoint): { start: string; destination: string } {
  let start = map.nodes[0];
  for (const n of map.nodes) if (d3(n, here) < d3(start, here)) start = n;
  const away = map.nodes.filter((n) => n.kind === "destination" && d3(n, here) > NEAR_POINT);
  return { start: start.id, destination: away.length > 0 ? away[away.length - 1].id : "sign" };
}

// One undoable step: the node it added (if new), the edge it added (if any), the level it
// started (if any) and the point that was last before it.
interface Step {
  node: string | null;
  edge: string | null;
  level: boolean;
  prevLast: string | null;
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
  private newFloor = false;
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
    return {
      version: MAP_FORMAT_VERSION,
      name: this.title,
      units: "m",
      nodes: this.nodes.map((n) => {
        const c: MappedNode = { id: n.id, x: n.x, y: n.y, z: n.z, kind: n.kind };
        if (n.label !== undefined) c.label = n.label;
        return c;
      }),
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
      ids[n.id] = true;
    }
    if (ids["sign"] !== true) return null;
    for (const e of raw.edges) {
      if (!e || ids[e.from] !== true || ids[e.to] !== true || EDGE_KINDS.indexOf(e.kind) < 0) return null;
      if (typeof e.length !== "number" || !(e.length > 0) || !isFinite(e.length)) return null;
    }
    const place = raw.place && typeof raw.place === "object" ? raw.place : {};
    const rec = new MapRecorder(typeof place.title === "string" ? place.title : typeof raw.name === "string" ? raw.name : DEFAULT_TITLE);
    rec.nodes = raw.nodes.map((n: any) => {
      const c: MappedNode = { id: n.id, x: n.x, y: n.y, z: n.z, kind: n.kind };
      if (n.label !== undefined) c.label = n.label;
      return c;
    });
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
    // History: the sign, then each edge in order (adding its far node the first time it appears).
    const seen: { [id: string]: boolean } = Object.create(null);
    seen["sign"] = true;
    rec.history = [{ node: "sign", edge: null, level: false, prevLast: null }];
    let last = "sign";
    for (const e of rec.edges) {
      const isNew = seen[e.to] !== true;
      seen[e.to] = true;
      rec.history.push({ node: isNew ? e.to : null, edge: e.id, level: false, prevLast: e.from });
      last = e.to;
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
