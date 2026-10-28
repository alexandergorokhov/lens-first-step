// Route engine for "Find Your Way Inside". Plain TypeScript, no Lens Studio APIs,
// so it runs under Node for tests and can be copied into Assets/ for the Lens.
//
// Map conventions: positions in metres, y up. Edges are two-way except
// escalators, which only run from -> to.

export type EdgeKind = "walk" | "stairs" | "escalator" | "lift" | "ramp";
export type Profile = "walk" | "stepFree";

export interface MapNode {
  id: string;
  x: number;
  y: number;
  z: number;
  kind: string;
  label?: string;
}

export interface MapEdge {
  id?: string;
  from: string;
  to: string;
  length: number;
  kind: EdgeKind;
  open: boolean;
}

export interface MapData {
  version: number;
  name?: string;
  units?: string;
  nodes: MapNode[];
  edges: MapEdge[];
}

export type ParseResult = { ok: true; map: MapData } | { ok: false; error: string };

export type RouteResult =
  | { status: "route"; profile: Profile; nodes: string[]; edges: MapEdge[]; length: number }
  | { status: "arrived"; profile: Profile; nodes: string[]; edges: MapEdge[]; length: 0 }
  | { status: "askStaff"; profile: Profile; message: string }
  | { status: "error"; profile: Profile; message: string };

export const EDGE_KINDS: EdgeKind[] = ["walk", "stairs", "escalator", "lift", "ramp"];

export const ASK_STAFF_MESSAGE = "No step-free route right now. Please ask a member of staff.";

const STEP_FREE_BLOCKED: EdgeKind[] = ["stairs", "escalator"];

export function edgeAllowed(edge: MapEdge, profile: Profile): boolean {
  if (!edge.open) return false;
  if (profile === "stepFree" && STEP_FREE_BLOCKED.indexOf(edge.kind) >= 0) return false;
  return true;
}

// Validates untrusted JSON text (downloaded or bundled) and returns a map or a readable error.
export function parseMap(text: string): ParseResult {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: "map.json is not valid JSON" };
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "map.json must be an object" };
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) return { ok: false, error: "map.json has no nodes" };
  if (!Array.isArray(raw.edges)) return { ok: false, error: "map.json has no edges" };

  const ids: { [id: string]: boolean } = {};
  for (const n of raw.nodes) {
    if (!n || typeof n.id !== "string" || n.id === "") return { ok: false, error: "a node is missing its id" };
    if (ids[n.id]) return { ok: false, error: "duplicate node id " + n.id };
    for (const axis of ["x", "y", "z"]) {
      if (typeof n[axis] !== "number" || !isFinite(n[axis])) {
        return { ok: false, error: "node " + n.id + " has a bad " + axis };
      }
    }
    if (typeof n.kind !== "string") return { ok: false, error: "node " + n.id + " has no kind" };
    ids[n.id] = true;
  }
  for (const e of raw.edges) {
    if (!e || !ids[e.from] || !ids[e.to]) {
      return { ok: false, error: "edge " + (e && e.from) + " -> " + (e && e.to) + " points at an unknown node" };
    }
    if (EDGE_KINDS.indexOf(e.kind) < 0) return { ok: false, error: "edge " + e.from + " -> " + e.to + " has unknown kind " + e.kind };
    if (typeof e.length !== "number" || !(e.length > 0)) {
      return { ok: false, error: "edge " + e.from + " -> " + e.to + " needs a positive length" };
    }
    if (typeof e.open !== "boolean") return { ok: false, error: "edge " + e.from + " -> " + e.to + " needs open true/false" };
  }
  return { ok: true, map: raw as MapData };
}

export function findNode(map: MapData, id: string): MapNode | undefined {
  for (const n of map.nodes) if (n.id === id) return n;
  return undefined;
}

// Returns a copy of the map with the edge(s) carrying this id opened or closed,
// e.g. setEdgeOpen(map, "lift1", false) when the user pinches the lift's red sign.
export function setEdgeOpen(map: MapData, edgeId: string, open: boolean): MapData {
  return {
    ...map,
    edges: map.edges.map((e) => (e.id === edgeId ? { ...e, open } : e)),
  };
}

interface Step {
  to: string;
  edge: MapEdge;
}

function neighbours(map: MapData, profile: Profile): { [id: string]: Step[] } {
  const adj: { [id: string]: Step[] } = {};
  for (const n of map.nodes) adj[n.id] = [];
  for (const e of map.edges) {
    if (!edgeAllowed(e, profile)) continue;
    adj[e.from].push({ to: e.to, edge: e });
    if (e.kind !== "escalator") adj[e.to].push({ to: e.from, edge: e });
  }
  return adj;
}

// Dijkstra over edge length. Both profiles minimise distance; Step-Free just
// never sees stairs or escalators. The graph is small, so a linear scan for the
// closest unvisited node is plenty.
export function findRoute(map: MapData, from: string, to: string, profile: Profile): RouteResult {
  if (!findNode(map, from)) return { status: "error", profile, message: "unknown start " + from };
  if (!findNode(map, to)) return { status: "error", profile, message: "unknown destination " + to };
  if (from === to) return { status: "arrived", profile, nodes: [from], edges: [], length: 0 };

  const adj = neighbours(map, profile);
  const dist: { [id: string]: number } = {};
  const prev: { [id: string]: Step & { from: string } } = {};
  const done: { [id: string]: boolean } = {};
  for (const n of map.nodes) dist[n.id] = Infinity;
  dist[from] = 0;

  for (;;) {
    let current: string | null = null;
    for (const n of map.nodes) {
      if (!done[n.id] && dist[n.id] < Infinity && (current === null || dist[n.id] < dist[current])) current = n.id;
    }
    if (current === null || current === to) break;
    done[current] = true;
    for (const step of adj[current]) {
      const d = dist[current] + step.edge.length;
      if (d < dist[step.to]) {
        dist[step.to] = d;
        prev[step.to] = { from: current, to: step.to, edge: step.edge };
      }
    }
  }

  if (dist[to] === Infinity) {
    if (profile === "stepFree") return { status: "askStaff", profile, message: ASK_STAFF_MESSAGE };
    return { status: "askStaff", profile, message: "No route right now. Please ask a member of staff." };
  }

  const nodes: string[] = [to];
  const edges: MapEdge[] = [];
  let at = to;
  while (at !== from) {
    const p = prev[at];
    edges.unshift(p.edge);
    at = p.from;
    nodes.unshift(at);
  }
  return { status: "route", profile, nodes, edges, length: Math.round(dist[to] * 1000) / 1000 };
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function routePoints(map: MapData, route: RouteResult): Vec3[] {
  if (route.status !== "route" && route.status !== "arrived") return [];
  return route.nodes.map((id) => {
    const n = findNode(map, id) as MapNode;
    return { x: n.x, y: n.y, z: n.z };
  });
}

function dist3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

// The part of the floor line to draw: from the point on the route closest to
// the user, forward along the route for at most `ahead` metres (the line fades
// out at its end). Returns at least two points unless the route is empty.
export function lineAhead(points: Vec3[], user: Vec3, ahead: number = 10): Vec3[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];

  let bestSeg = 0;
  let bestT = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2;
    let t = len2 === 0 ? 0 : ((user.x - a.x) * (b.x - a.x) + (user.y - a.y) * (b.y - a.y) + (user.z - a.z) * (b.z - a.z)) / len2;
    t = Math.max(0, Math.min(1, t));
    const d = dist3(user, lerp(a, b, t));
    if (d < bestD) {
      bestD = d;
      bestSeg = i;
      bestT = t;
    }
  }

  const out: Vec3[] = [lerp(points[bestSeg], points[bestSeg + 1], bestT)];
  let left = ahead;
  for (let i = bestSeg; i < points.length - 1 && left > 0; i++) {
    const start = out[out.length - 1];
    const end = points[i + 1];
    const d = dist3(start, end);
    if (d <= left) {
      out.push(end);
      left -= d;
    } else {
      out.push(lerp(start, end, left / d));
      left = 0;
    }
  }
  if (out.length === 1) out.push(out[0]);
  return out;
}

// Holds the traveller's current choices and re-routes whenever one changes:
// a gate change, a profile switch, or a lift marked out of service.
export class Navigator {
  map: MapData;
  from: string;
  to: string;
  profile: Profile;
  route: RouteResult;

  constructor(map: MapData, from: string, to: string, profile: Profile) {
    this.map = map;
    this.from = from;
    this.to = to;
    this.profile = profile;
    this.route = findRoute(map, from, to, profile);
  }

  private recompute(): boolean {
    const before = this.route.status === "route" ? this.route.nodes.join(">") : this.route.status;
    this.route = findRoute(this.map, this.from, this.to, this.profile);
    const after = this.route.status === "route" ? this.route.nodes.join(">") : this.route.status;
    return before !== after;
  }

  setGate(gate: string): boolean {
    this.to = gate;
    return this.recompute();
  }

  setProfile(profile: Profile): boolean {
    this.profile = profile;
    return this.recompute();
  }

  setPosition(nodeId: string): boolean {
    this.from = nodeId;
    return this.recompute();
  }

  setEdgeOpen(edgeId: string, open: boolean): boolean {
    this.map = setEdgeOpen(this.map, edgeId, open);
    return this.recompute();
  }
}
