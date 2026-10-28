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

export interface Path {
  nodes: string[];
  edges: MapEdge[];
  length: number;
}

export type RouteResult =
  | ({ status: "route"; profile: Profile } & Path)
  | { status: "arrived"; profile: Profile; nodes: string[]; edges: MapEdge[]; length: 0 }
  | { status: "askStaff"; profile: Profile; message: string; assistance?: Path }
  | { status: "error"; profile: Profile; message: string };

export const EDGE_KINDS: EdgeKind[] = ["walk", "stairs", "escalator", "lift", "ramp"];

export const ASK_STAFF_MESSAGE = "No step-free route. Ask staff at the assistance point.";
export const NO_ROUTE_MESSAGE = "No route right now. Ask staff at the assistance point.";
export const SIGN_NOT_IN_MAP = "This sign isn't in the map";
export const MAP_LOAD_FAILED = "Map couldn't load";

// Distances in metres from the brief's scenarios.
export const ARRIVAL_RADIUS = 3;
export const OFF_ROUTE_DISTANCE = 5;

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

interface Tree {
  dist: { [id: string]: number };
  prev: { [id: string]: Step & { from: string } };
}

// Dijkstra over edge length. Both profiles minimise distance; Step-Free just
// never sees stairs or escalators. The graph is small, so a linear scan for the
// closest unvisited node is plenty.
function shortestTree(map: MapData, from: string, profile: Profile): Tree {
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
    if (current === null) break;
    done[current] = true;
    for (const step of adj[current]) {
      const d = dist[current] + step.edge.length;
      if (d < dist[step.to]) {
        dist[step.to] = d;
        prev[step.to] = { from: current, to: step.to, edge: step.edge };
      }
    }
  }
  return { dist, prev };
}

function pathTo(tree: Tree, from: string, to: string): Path {
  const nodes: string[] = [to];
  const edges: MapEdge[] = [];
  let at = to;
  while (at !== from) {
    const p = tree.prev[at];
    edges.unshift(p.edge);
    at = p.from;
    nodes.unshift(at);
  }
  return { nodes, edges, length: Math.round(tree.dist[to] * 1000) / 1000 };
}

export function findRoute(map: MapData, from: string, to: string, profile: Profile): RouteResult {
  if (!findNode(map, from)) return { status: "error", profile, message: "unknown start " + from };
  if (!findNode(map, to)) return { status: "error", profile, message: "unknown destination " + to };
  if (from === to) return { status: "arrived", profile, nodes: [from], edges: [], length: 0 };

  const tree = shortestTree(map, from, profile);
  if (tree.dist[to] < Infinity) return { status: "route", profile, ...pathTo(tree, from, to) };

  // No way through: point the traveller at the nearest assistance point they can reach.
  let help: string | null = null;
  for (const n of map.nodes) {
    if (n.kind === "assistance" && tree.dist[n.id] < Infinity && (help === null || tree.dist[n.id] < tree.dist[help])) help = n.id;
  }
  const message = profile === "stepFree" ? ASK_STAFF_MESSAGE : NO_ROUTE_MESSAGE;
  if (help === null) return { status: "askStaff", profile, message };
  return { status: "askStaff", profile, message, assistance: pathTo(tree, from, help) };
}

// The sign's code tells us where the traveller is standing.
export function locateSign(map: MapData, signId: string): { ok: true; node: MapNode } | { ok: false; message: string } {
  const node = findNode(map, signId);
  if (!node || node.kind !== "sign") return { ok: false, message: SIGN_NOT_IN_MAP };
  return { ok: true, node };
}

export type MapSource = "online" | "offline";

// Picks the map to use: the downloaded copy if it arrived and is valid,
// otherwise the copy shipped in the Lens. `downloaded` is null when the
// download failed or timed out.
export function chooseMap(downloaded: string | null, builtIn: string): { map: MapData; source: MapSource; notice: string | null } {
  if (downloaded !== null) {
    const parsed = parseMap(downloaded);
    if (parsed.ok) return { map: parsed.map, source: "online", notice: null };
  }
  const fallback = parseMap(builtIn);
  if (!fallback.ok) throw new Error("built-in map is broken: " + fallback.error);
  return { map: fallback.map, source: "offline", notice: downloaded === null ? null : MAP_LOAD_FAILED };
}

export const DOWNLOAD_TIMEOUT_MS = 5000;

// `fetchText` is whatever the platform provides (the Lens wraps InternetModule;
// tests pass a fake). It should resolve with the body text or reject. Anything
// slower than `timeoutMs`, a rejection, or an invalid body falls back to the
// built-in map, so the route always works.
export function loadMapWithTimeout(
  fetchText: (url: string) => Promise<string>,
  url: string,
  builtIn: string,
  timeoutMs: number = DOWNLOAD_TIMEOUT_MS,
): Promise<{ map: MapData; source: MapSource; notice: string | null }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (downloaded: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(chooseMap(downloaded, builtIn));
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    let request: Promise<string>;
    try {
      request = fetchText(url);
    } catch (e) {
      finish(null);
      return;
    }
    request.then(
      (text) => finish(typeof text === "string" ? text : null),
      () => finish(null),
    );
  });
}

function gateCode(map: MapData, gateId: string): string {
  const n = findNode(map, gateId);
  const label = n && n.label ? n.label : gateId;
  return label.replace(/^Gate\s+/, "");
}

export function gateChangeMessage(map: MapData, oldGate: string, newGate: string): string {
  return "Gate change: " + gateCode(map, oldGate) + " → " + gateCode(map, newGate);
}

export function arrivalMessage(map: MapData, gateId: string, boardingMinutes: number): string {
  return "Gate " + gateCode(map, gateId) + ". Boarding in " + boardingMinutes + " min.";
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

export function nearestNode(map: MapData, pos: Vec3): MapNode {
  let best = map.nodes[0];
  let bestD = Infinity;
  for (const n of map.nodes) {
    const d = dist3(n, pos);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

export function distanceToLine(points: Vec3[], pos: Vec3): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return dist3(points[0], pos);
  const clipped = lineAhead(points, pos, 0);
  return dist3(clipped[0], pos);
}

export type Progress = "onRoute" | "rerouted" | "arrived";

// Holds the traveller's current choices and re-routes whenever one changes:
// a gate change, a profile switch, a lift marked out of service, or walking
// off the line. Once a position is known, re-routes start from the node
// nearest to it.
export class Navigator {
  map: MapData;
  from: string;
  to: string;
  profile: Profile;
  route: RouteResult;
  position: Vec3 | null = null;

  constructor(map: MapData, from: string, to: string, profile: Profile) {
    this.map = map;
    this.from = from;
    this.to = to;
    this.profile = profile;
    this.route = findRoute(map, from, to, profile);
  }

  private recompute(): boolean {
    if (this.position) this.from = nearestNode(this.map, this.position).id;
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

  setEdgeOpen(edgeId: string, open: boolean): boolean {
    this.map = setEdgeOpen(this.map, edgeId, open);
    return this.recompute();
  }

  // Call as the traveller moves. Within ARRIVAL_RADIUS of the gate the route
  // becomes "arrived" (the line stops); more than OFF_ROUTE_DISTANCE from the
  // line it re-routes from the nearest node.
  updatePosition(pos: Vec3): Progress {
    this.position = pos;
    const gate = findNode(this.map, this.to);
    if (gate && dist3(gate, pos) <= ARRIVAL_RADIUS) {
      this.from = this.to;
      this.route = { status: "arrived", profile: this.profile, nodes: [this.to], edges: [], length: 0 };
      return "arrived";
    }
    if (this.route.status === "arrived") {
      if (gate && dist3(gate, pos) <= OFF_ROUTE_DISTANCE) return "arrived";
      this.recompute();
      return "rerouted";
    }
    if (this.route.status === "route" && distanceToLine(routePoints(this.map, this.route), pos) > OFF_ROUTE_DISTANCE) {
      this.recompute();
      return "rerouted";
    }
    return "onRoute";
  }
}
